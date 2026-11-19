/**
 * bb-plan-snapshot.engine.ts — ЕДИНАЯ точка «снимков факта плана».
 *
 * Зачем. План несёт производные объекты, которые читают отчёт, печать, CSV,
 * карточки качества и UI: `weeklyVolume`, `validation`, `balanceReport`,
 * `fatigueReport`, `expandedSummary`, `report` + текст `rationale`
 * («Частота на группу/нед», «⚠ Валидация: …»). Каждый из них — ОБЕЩАНИЕ
 * пользователю: «в неделе 1 у спины 12.5 эффективных сетов», «план валиден»,
 * «итого 84 рабочих сета/нед».
 *
 * Проблема была в том, что снимки делались в одном месте (конец `finalizeBBPlan`)
 * и НЕ пересчитывались после последующих изменений плана:
 *  - билдер после финализатора делает ещё ~15 проходов (rehab-возврат, VBT,
 *    RIR-волна, схемы интенсивности, BFR, blast/cruise, рампа) — замер
 *    192 плана: weeklyVolume расходился в 191/192, в 20 планах validation
 *    хранил ошибки, которых в итоговом плане нет;
 *  - UI-правки (`revalidateEditedPlan`: finalize + prioritizeBackSessions +
 *    рампа) — замер 12 планов: expandedSummary расходился в 9/12;
 *  - внутри самого финализатора `fatigueReport`/`expandedSummary` снимались до
 *    поздних проходов (рампа, доводка PPL, финальный трим).
 *
 * Правило: любой, кто изменил состав/сеты плана, вызывает
 * `refreshBBPlanSnapshots` последним. Отчёт собирается ВНУТРИ последним, иначе
 * он скопирует устаревшие цифры.
 *
 * Модуль листовой (импортирует только движки, у которых из builder — лишь
 * `import type`), поэтому его можно звать и из билдера, и из финализатора, и из
 * UI без циклов.
 */
import { aggregateBBVolume } from './bb-volume.engine';
import { validateBBPlan } from './bb-validator.engine';
import { analyzeBBBalance } from './bb-balance.engine';
import { estimateBBSessionCost } from './bb-fatigue.engine';
import { buildBBPlanReport } from './bb-report.engine';
import { buildBBExpandedSummary } from './bb-summary.engine';
import { analyzeBBRotation } from './bb-rotation.engine';
import { backQualityIssues, armQualityIssues } from './bb-back-quality.engine';
import { analyzePlanStress } from './bb-injury-prevention.engine';
import {
  applyFrequencyDriftNote,
  frequencyDriftNote,
  reconcileFrequencyClaim,
} from './bb-frequency';
import { ruCount, RU_ERRORS, RU_WARNINGS } from '../ru-plural';

export interface BBPlanSnapshotOptions {
  /** Опции валидатора. Без них `plan.validation` не пересчитывается (остаётся как есть). */
  validationOptions?: Record<string, unknown>;
  /** Приоритетные/спец-мышцы для баланса; по умолчанию `plan.priorityMuscles`. */
  specTargets?: string[];
  /** Канонизация алиасов мышц (`chest_upper` → `chest`). Нужна для сверки частоты. */
  canonicalMuscle?: (muscle: string) => string;
  /** Пересчитать строку «Частота на группу/нед (факт)» и заметку о расхождении. */
  refreshFrequency?: boolean;
  /** Пересобрать строки «⚠ Валидация: …» в rationale (иначе они описывают старое состояние). */
  refreshValidationRationale?: boolean;
  /** Пересобрать строки «⚠ Ротация: …» в rationale (иначе описывают до-финальный состав). */
  refreshRotationRationale?: boolean;
}

export const VALIDATION_LINE_PREFIX = '⚠ Валидация:';
export const ROTATION_LINE_PREFIX = '⚠ Ротация:';
const BACK_SUMMARY_PREFIX = '🧩 Спина по паттернам:';
const ARM_SUMMARY_PREFIX = '💪 Руки по паттернам:';
const BACK_ISSUE_PREFIX = '⚠ Качество спины:';
const ARM_ISSUE_PREFIX = '⚠ Качество рук:';
const JOINT_LINE_PREFIX = '🦿 Суставы:';
export const ERROR_LINE_PREFIX = '🚫 Валидация:';

/** Сколько строк валидации максимум попадает в rationale (прежний `slice(0, 20)`). */
export const VALIDATION_RATIONALE_LIMIT = 20;

/** Важность диагностики для ТЕКСТА плана: пользователь ищет в rationale сначала
 *  «чего не хватает / что перегружено», а не мелкие замечания по отдельным подходам.
 *
 *  Аудит 2026-11 (P3-7): строки брались «первыми 20 в порядке выдачи валидатора»
 *  (`slice(0, 20)` в 4 местах). В плане с 52 предупреждениями (bro_5/mass) реальный
 *  дефицит объёма до MEV в текст не попадал вовсе — при этом он важнее всего списка.
 *  Полный список остаётся в панели валидации, в rationale — приоритетные + честная
 *  строка «ещё N предупреждений». */
const VALIDATION_PRIORITY: Record<string, number> = {
  target_volume_deficit: 0,
  effective_mrv_overflow: 1,
  session_working_set_cap: 2,
  session_volume_puos: 2,
  no_working_sets: 2,
  low_training_frequency: 3,
};

export function validationIssuePriority(issue: any): number {
  const known = VALIDATION_PRIORITY[String(issue?.code || '')];
  return known == null ? 4 : known;
}

/** Стабильная сортировка по важности (порядок внутри группы сохраняется). */
export function orderValidationIssues<T>(issues: readonly T[]): T[] {
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => validationIssuePriority(a.issue) - validationIssuePriority(b.issue) || a.index - b.index)
    .map((entry) => entry.issue);
}

/** Строки валидации для rationale: приоритетные сначала, не больше `limit`, а
 *  скрытое честно суммируется строкой «…и ещё N … — полный список в панели валидации».
 *  Одинаковые сообщения (одна и та же претензия в разных неделях) схлопываются:
 *  иначе «ещё N» считал бы дубли, а пользователь видел бы одну и ту же строку дважды. */
export function validationRationaleLines(
  issues: readonly any[] | undefined,
  prefix: string,
  options: { level?: 'warning' | 'error'; limit?: number } = {},
): string[] {
  const limit = options.limit ?? VALIDATION_RATIONALE_LIMIT;
  const seen = new Set<string>();
  const pool = (issues || [])
    .filter((issue: any) => (options.level ? issue?.level === options.level : true))
    .filter((issue: any) => {
      const key = `${issue?.code || ''}|${issue?.message || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const ordered = orderValidationIssues(pool);
  const lines = ordered.slice(0, limit).map((issue: any) => `${prefix} ${issue.message}`);
  const hidden = ordered.length - lines.length;
  if (hidden > 0) {
    const forms = options.level === 'error' ? RU_ERRORS : RU_WARNINGS;
    lines.push(`${prefix} …и ещё ${ruCount(hidden, forms)} — полный список в панели валидации.`);
  }
  return lines;
}

/** Строки ротации для rationale: важность → предел → честная строка «…и ещё N».
 *  Аудит 2026-11 (продолжение P3-7): тот же дефект, что у валидации, — здесь тоже
 *  стоял `slice(0, 20)` в порядке выдачи анализатора, поэтому в плане с 25+
 *  замечаниями пользователь видел 20 локальных повторов угла изоляции и не видел
 *  ни одного «основное движение сменилось внутри фазы». Полный список остаётся в
 *  отчёте качества, в rationale — приоритетные и честный счётчик скрытого. */
export const ROTATION_RATIONALE_LIMIT = 20;

/** Важность замечаний ротации: смена базы внутри фазы мешает прогрессу сильнее
 *  всего; «нет ротации весь план» — методическое замечание ко всему плану;
 *  локальный повтор угла изоляции — самое частное. */
const ROTATION_PRIORITY: Record<string, number> = {
  primary_changed: 0,
  no_accessory_rotation: 1,
  accessory_repeated: 2,
};

export function rotationIssuePriority(issue: any): number {
  const known = ROTATION_PRIORITY[String(issue?.code || '')];
  return known == null ? 3 : known;
}

export function rotationRationaleLines(
  issues: readonly any[] | undefined,
  prefix: string,
  options: { limit?: number; hiddenHint?: string } = {},
): string[] {
  const limit = options.limit ?? ROTATION_RATIONALE_LIMIT;
  const seen = new Set<string>();
  const pool = (issues || []).filter((issue: any) => {
    const key = `${issue?.code || ''}|${issue?.message || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ordered = pool
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => rotationIssuePriority(a.issue) - rotationIssuePriority(b.issue) || a.index - b.index)
    .map((entry) => entry.issue);
  const lines = ordered.slice(0, Math.max(0, limit)).map((issue: any) => `${prefix} ${issue.message}`);
  const hidden = ordered.length - lines.length;
  if (hidden > 0) {
    lines.push(`${prefix} …и ещё ${ruCount(hidden, RU_WARNINGS)} — ${options.hiddenHint || 'полный список в отчёте качества'}.`);
  }
  return lines;
}

/** Итоговые строки ротации для rationale: сохраняем уже показанные финализатором
 *  «primary_changed» (только если они всё ещё актуальны) и добираем остальные
 *  по важности в пределах общего лимита 20. Одна точка правды для снимка и тестов. */
export function rotationRationaleFor(
  issues: readonly any[] | undefined,
  prevLines: readonly string[] | undefined,
): string[] {
  const list = (issues || []) as any[];
  const message = (issue: any) => `${ROTATION_LINE_PREFIX} ${issue.message}`;
  // «primary_changed» сохраняем, только если финализатор уже решил его
  // показать (reorder=false); остальные строки — по фактическому составу.
  const keptPrimary = (prevLines || []).filter((line) =>
    list.some((issue) => issue.code === 'primary_changed' && message(issue) === line));
  // Предел 20 общий на все строки ротации: сколько заняли оставленные
  // «primary_changed», столько снимаем у остальных, чтобы список не разрастался.
  const fresh = rotationRationaleLines(
    list.filter((issue) => issue.code !== 'primary_changed'),
    ROTATION_LINE_PREFIX,
    { limit: Math.max(0, ROTATION_RATIONALE_LIMIT - keptPrimary.length) },
  );
  return [...new Set([...keptPrimary, ...fresh])];
}

/** Сумма сетов по movement-паттернам для выбранных мышц (как в финализаторе). */
function patternSummary(weeks: any[], muscles: string[]): string {
  const acc: Record<string, number> = {};
  for (const week of weeks) {
    for (const session of week.sessions || []) {
      for (const exercise of session.exercises || []) {
        if (!muscles.includes(exercise.muscle)) continue;
        const pattern = exercise.movementPattern || 'other';
        acc[pattern] = (acc[pattern] || 0) + (exercise.sets || 0);
      }
    }
  }
  return Object.entries(acc).map(([key, value]) => `${key}=${value}`).join(', ') || 'нет прямой работы';
}
// P3-3 (аудит 2026-11): здесь был фильтр «промежуточных» кодов
// (`target_volume_deficit`, `effective_mrv_overflow`) — они не попадали в строки
// «⚠ Валидация». Но КАЖДЫЙ вызов `refreshBBPlanSnapshots` в проекте — терминальный
// снимок (билдер, финализатор, replan, оба cycle-пути, UI-перевалидация): снимок
// зовётся последним, после всех мутирующих проходов. Значит эти коды в нём не
// промежуточные, а настоящие: дефицит объёма до MEV и перебор MRV — то, что
// пользователю нужно видеть в плане, а не только в панели валидации. Фильтр убран.

/**
 * Пересчитывает все производные объекты плана по его текущему содержимому.
 * Идемпотентна: повторный вызов на неизменённом плане даёт те же значения.
 */
export function refreshBBPlanSnapshots(plan: any, opts: BBPlanSnapshotOptions = {}): void {
  if (!plan || !Array.isArray(plan.weeks)) return;

  plan.weeklyVolume = Object.fromEntries(
    plan.weeks.map((week: any) => [week.week, aggregateBBVolume(week.sessions || [])]),
  );

  if (opts.validationOptions) {
    plan.validation = validateBBPlan(plan, opts.validationOptions as any);
  }

  plan.balanceReport = analyzeBBBalance(plan, { specTargets: opts.specTargets ?? plan.priorityMuscles ?? [] });
  plan.fatigueReport = plan.weeks.map((week: any) => ({
    week: week.week,
    sessions: (week.sessions || []).map((session: any) => estimateBBSessionCost(session)),
  }));
  plan.expandedSummary = buildBBExpandedSummary(plan);

  // Ротация: стабильность основных движений внутри фазы. В финализаторе она
  // считалась в середине прохода — до поздних замен/удалений (реализм сессии,
  // гарды дней, доводка головок рук). Замер 17 планов (generic/cycle/program):
  // расходились все, например upper_lower_4 — 56 issue в плане против 65
  // фактических; отчёт и карточка качества показывали до-финальное число.
  plan.rotationReport = analyzeBBRotation(plan);
  if (opts.refreshRotationRationale) {
    const issues = ((plan.rotationReport.issues || []) as any[]);
    const prev = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => String(line).startsWith(ROTATION_LINE_PREFIX));
    const lines = rotationRationaleFor(issues, prev);
    plan.rationale = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => !String(line).startsWith(ROTATION_LINE_PREFIX))
      .concat(lines);
  }

  // Паттерны спины/рук и их качество — тоже факт состава: финализатор считал
  // их до поздних замен/удалений (гарантия головок рук, гейт уровней, реализм
  // сессии, пост-финальный MRV-трим цикл/программа-путей). Замер: строка спины
  // расходилась в 14/17 планов, рук — в 9/17, «Качество рук» держало до 14
  // снятых предупреждений.
  {
    const rationale = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => {
        const text = String(line);
        return !text.startsWith(BACK_SUMMARY_PREFIX)
          && !text.startsWith(ARM_SUMMARY_PREFIX)
          && !text.startsWith(BACK_ISSUE_PREFIX)
          && !text.startsWith(ARM_ISSUE_PREFIX);
      });
    rationale.push(`${BACK_SUMMARY_PREFIX} ${patternSummary(plan.weeks, ['back'])}`);
    for (const issue of backQualityIssues(plan.weeks)) rationale.push(`${BACK_ISSUE_PREFIX} ${issue}`);
    rationale.push(`${ARM_SUMMARY_PREFIX} ${patternSummary(plan.weeks, ['biceps', 'triceps', 'forearms'])}`);
    for (const issue of armQualityIssues(plan.weeks)) rationale.push(`${ARM_ISSUE_PREFIX} ${issue}`);
    plan.rationale = rationale;
  }

  // Суставной стресс (объём × вес × RIR-проксимити + PED): в финализаторе он
  // считался до гарантии головок рук, гейта уровней, реализма сессии и
  // пост-финального трима — строка расходилась во всех 23 собранных планах.
  {
    const rationale = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => !String(line).startsWith(JOINT_LINE_PREFIX));
    const jointIssues = analyzePlanStress(plan).issues;
    if (jointIssues.length) rationale.push(`${JOINT_LINE_PREFIX} ${jointIssues.join(' ')}`);
    plan.rationale = rationale;
  }

  if (opts.refreshFrequency && opts.canonicalMuscle) {
    const freq = reconcileFrequencyClaim(plan, { canonical: opts.canonicalMuscle });
    applyFrequencyDriftNote(plan, frequencyDriftNote(freq));
  }

  if (opts.refreshValidationRationale && plan.validation) {
    const issues = ((plan.validation.issues || []) as any[]);
    // Приоритет важности + честная строка «ещё N» (аудит 2026-11, P3-7): раньше
    // обрез `slice(0, 20)` в порядке выдачи валидатора скрывал дефицит объёма.
    const fresh = validationRationaleLines(issues, VALIDATION_LINE_PREFIX, { level: 'warning' });
    // Ошибки — то же обещание: цикл-путь после трима гасил их в плане, а строки
    // «🚫 Валидация» оставались (замер: 3 фантомные ошибки на 3 циклах).
    const freshErrors = validationRationaleLines(issues, ERROR_LINE_PREFIX, { level: 'error' });
    const rationale: string[] = (Array.isArray(plan.rationale) ? plan.rationale : [])
      .filter((line: string) => !String(line).startsWith(VALIDATION_LINE_PREFIX)
        && !String(line).startsWith(ERROR_LINE_PREFIX));
    for (const line of fresh) if (!rationale.includes(line)) rationale.push(line);
    for (const line of freshErrors) if (!rationale.includes(line)) rationale.push(line);
    plan.rationale = rationale;
  }

  // Отчёт — ПОСЛЕДНИМ: он копирует в себя weeklyVolume/validation/balanceReport/
  // expandedSummary и текст rationale.
  plan.report = buildBBPlanReport(plan);
}
