/**
 * bb-plan-validation-view.ts — адаптация валидации плана под реальные настройки
 * пользователя (аудит 2026-09).
 *
 * Проблема: шаг «План» показывал сырой список issues валидатора — технические
 * коды (muscle_attribution, equipment_unknown_exercise), повторы одного и того
 * же предупреждения на каждую неделю/сессию и советы, противоречащие выбору
 * пользователя (специализация на спине → «добавьте жимов»). Превращаем issues
 * в человекочитаемую сводку: только то, что реально относится к плану и
 * настройкам, сгруппированное, с действием и учётом акцентов.
 */
import type { BBPlan, BBExercise, BBSession } from '../../../engines/bb/bb-builder.engine';
import { validateBBPlan, type BBPlanValidationIssue } from '../../../engines/bb/bb-validator.engine';
import { generateActionableRecommendations } from '../../../engines/bb/bb-validator.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { canonicalBBIssueText } from '../../../engines/bb/bb-validation-format';
import { sessionTagLabel } from './bb-labels';

export interface PlanValidationView {
  /** План без блокирующих ошибок. */
  ok: boolean;
  /** Блокирующие проблемы (исправление обязательно). */
  errors: { code: string; text: string; hint?: string; count: number }[];
  /** Предупреждения, требующие внимания. */
  warnings: { code: string; text: string; hint?: string; count: number }[];
  /** Информационные заметки (не проблемы). */
  infos: { code: string; text: string; count: number }[];
  /** Строка про акцент специализации (если цели заданы). */
  accentNote: string | null;
  /** Сколько технических/дублирующих строк скрыто (для честной подписи). */
  hiddenCount: number;
}

/** Технические коды: не относятся к качеству плана с точки зрения пользователя. */
const HIDDEN_CODES = new Set([
  'muscle_attribution',          // классификация каталога vs план (инженерная проверка)
  'equipment_unknown_exercise',  // упражнение вне каталога — не пользовательская проблема
  'session_muscle_leak',         // добивки малых мышц в чужой день — легитимны
  'deload_volume_not_reduced',   // контролируется финализатором (effort-deload)
  'deload_rir_too_low',
  'taper_volume_increased',      // предупреждение уровня движка, не действия
]);

/** Коды, которые показываются как ИНФО (не требуют правок). */
const INFO_CODES = new Set([
  'session_duration',
  'axial_fatigue',
  'session_volume_puos',
  'order_primary_after_accessory',
  'primary_not_compound',
]);

const HINT_BY_CODE: Record<string, string> = {
  session_exercise_cap: 'Уберите 1–2 добивочных упражнения — план уже на пределе сессионного лимита.',
  session_working_set_cap: 'Снимите 1–2 подхода с добивок: лимит сессии — это потолок восстановления.',
  effective_mrv_overflow: 'Уменьшите объём перегруженной группы: уберите изоляцию или подходы у базы.',
  target_volume_deficit: 'Добавьте фидер-сеты или упражнение целевой группы в ближайший её день.',
  low_training_frequency: 'Смените сплит на 2×/нед частоту (PPL / Верх-Низ) или добавьте второй стимул.',
  goal_focus_mismatch: 'Согласуйте цель и фокус: сушка + сила на длинном цикле теряет мышцы.',
  single_work_set: 'Доведите упражнение до 2+ подходов или уберите его.',
  excluded_exercise_present: 'Уберите упражнение из плана — оно в списке исключённых.',
  excluded_muscle_present: 'Замените упражнение: мышца исключена травмой.',
  axial_restriction_violation: 'Замените осевое движение на не-осевое (режим «без осевой»).',
  equipment_restriction_violation: 'Замените упражнение на доступное в вашем оборудовании.',
  invalid_work_set: 'Проверьте вес/повторы/RIR — есть некорректные значения.',
  sets_mismatch: 'Техническая синхронизация подходов — сохраните план заново.',
  empty_plan: 'Соберите план заново.',
  invalid_input: 'План повреждён или имеет неполную структуру. Пересоберите его перед применением.',
};

function muscleLabel(m?: string): string {
  if (!m) return '';
  return MUSCLE_LABEL_RU[m] || m;
}

/** Краткая человекочитаемая формулировка из issue (RU-мышцы, сессия, неделя). */
function formatIssue(plan: BBPlan, i: BBPlanValidationIssue): string {
  const text = canonicalBBIssueText(i);
  const parts: string[] = [];
  if (i.week) parts.push(`нед ${i.week}`);
  if (i.session) {
    const w = plan.weeks.find(x => x.week === i.week) || plan.weeks[0];
    const tag = w?.sessions?.[(i.session || 1) - 1]?.sessionTag;
    parts.push(tag ? sessionTagLabel(tag) : `сессия ${i.session}`);
  }
  return parts.length ? `${parts.join(' · ')}: ${text}` : text;
}

function invalidInputView(text: string): PlanValidationView {
  return {
    ok: false,
    errors: [{ code: 'invalid_input', text, hint: HINT_BY_CODE.invalid_input, count: 1 }],
    warnings: [],
    infos: [],
    accentNote: null,
    hiddenCount: 0,
  };
}

export function buildPlanValidationView(plan: BBPlan | null): PlanValidationView {
  if (!plan) return invalidInputView('План отсутствует. Соберите план перед применением.');
  let validation;
  try {
    validation = validateBBPlan(plan, {
      level: plan.level,
      trainingYears: (plan as any).trainingYears,
      equipment: (plan as any).safetyConstraints?.equipment,
      excludedExercises: (plan as any).safetyConstraints?.excludedExercises,
      excludedMuscles: (plan as any).safetyConstraints?.excludedMuscles || (plan as any).gradedMuscles,
      avoidAxialLoad: (plan as any).safetyConstraints?.avoidAxialLoad,
      methodology: (plan as any).methodology,
      specializationTargets: (plan as any).priorityMuscles,
    });
  } catch {
    return invalidInputView('План не прошёл проверку структуры. Пересоберите его перед применением.');
  }

  const grouped = new Map<string, { code: string; text: string; count: number }>();
  let hiddenCount = 0;
  const errors: PlanValidationView['errors'] = [];
  const warnings: PlanValidationView['warnings'] = [];
  const infos: PlanValidationView['infos'] = [];

  for (const issue of validation.issues) {
    if (HIDDEN_CODES.has(issue.code)) { hiddenCount++; continue; }
    const key = `${issue.code}|${issue.message}`;
    const existing = grouped.get(key);
    if (existing) { existing.count++; continue; }
    const entry = { code: issue.code, text: formatIssue(plan, issue), count: 1 };
    grouped.set(key, entry);
    if (issue.level === 'error') errors.push({ ...entry, hint: HINT_BY_CODE[issue.code] });
    else if (INFO_CODES.has(issue.code)) infos.push(entry);
    else warnings.push({ ...entry, hint: HINT_BY_CODE[issue.code] });
  }

  // Действия из actionable-рекомендаций движка (дедуп по тексту hint).
  try {
    const recs = generateActionableRecommendations(plan, validation.issues.filter(i => !HIDDEN_CODES.has(i.code)));
    for (const w of warnings) {
      if (w.hint) continue;
      const rec = recs.find(r => r.code === w.code);
      if (rec) w.hint = rec.action;
    }
  } catch { /* рекомендации опциональны */ }

  // Акцент специализации: объясняем, почему часть групп ниже MEV/MAV — это дизайн.
  const targets: string[] = Array.isArray((plan as any).priorityMuscles) ? (plan as any).priorityMuscles : [];
  const accentNote = targets.length
    ? `Акцент плана: ${targets.map(m => muscleLabel(m) || m).join(', ')} — эти группы получают приоритет объёма/частоты/RIR; остальные сознательно держатся на поддерживающем минимуме (MEV). Предупреждения о «дисбалансе» для них не выводятся.`
    : null;

  return { ok: errors.length === 0, errors, warnings, infos, accentNote, hiddenCount };
}

/** Сводная строка статуса для бейджа (адаптирована под реальные настройки). */
export function planValidationBadge(view: PlanValidationView): { label: string; ok: boolean } {
  if (view.errors.length > 0) return { label: `⛔ ${view.errors.length} к исправлению · ${view.warnings.length} предупрежд.`, ok: false };
  if (view.warnings.length > 0) return { label: `✓ ошибок нет · ${view.warnings.length} предупрежд.`, ok: true };
  return { label: '✓ план соответствует вашим настройкам', ok: true };
}

/** Считает сессии, превышающие лимиты (для быстрой подписи «план в норме»). */
export function planSessionStats(plan: BBPlan | null): { sessions: number; maxExercises: number; maxSets: number } {
  if (!plan) return { sessions: 0, maxExercises: 0, maxSets: 0 };
  let sessions = 0, maxExercises = 0, maxSets = 0;
  for (const w of plan.weeks) for (const s of (w.sessions || [])) {
    const working = (s.exercises || []).filter((e: BBExercise) => !(e as any).warmupActivator && !(e as any).optional);
    sessions++;
    maxExercises = Math.max(maxExercises, working.length);
    maxSets = Math.max(maxSets, working.reduce((a: number, e: BBExercise) => a + (e.sets || 0), 0));
  }
  return { sessions, maxExercises, maxSets };
}
