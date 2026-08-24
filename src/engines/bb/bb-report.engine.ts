import type { BBPlan } from './bb-builder.engine';
import type { BBBalanceReport } from './bb-balance.engine';
import { trueMuscleOf } from '../movement-pattern';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

export interface BBPlanReport {
  pattern: string;
  weeks: number;
  sessionsPerWeek: number;
  totalDirectSets: number;
  peakDirectSets: number;
  peakWeek: number;
  peakVolume: Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }>;
  rotationWarnings: number;
  maxSessionMinutes: number;
  maxAxialCost: number;
  validationValid: boolean;
  validationErrors: number;
  validationWarnings: number;
  sessionLeakWarnings: number;
  balance?: BBBalanceReport;
  /** Расширенная недельная сводка (сессии/рабочие/разминочные/паттерны/direct/косвенная). */
  expandedSummary?: import('./bb-summary.engine').BBExpandedSummary;
  /** Число optional-упражнений «при наличии сил» (⚡). */
  optionalExercises: number;
  /** Слабые группы (акцент +20%/+1 упр без капа). */
  weakPoints: string[];
}

export function buildBBPlanReport(plan: BBPlan): BBPlanReport {
  const weekly = plan.weeklyVolume || {};
  const peak = Object.entries(weekly).reduce((best, [week, volume]) => {
    const total = Object.values(volume).reduce((sum, item) => sum + item.directSets, 0);
    return total > best.total ? { total, week: Number(week), volume } : best;
  }, { total: -1, week: 1, volume: {} as Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }> });
  const fatigue = plan.fatigueReport || [];
  let optionalExercises = 0;
  for (const w of plan.weeks) for (const s of (w.sessions || [])) for (const e of (s.exercises || [])) if ((e as any).optional) optionalExercises++;
  const weakPoints = plan.priorityMuscles?.filter(m => !['delt_front','delt_mid','delt_rear'].includes(m)) || [];
  return {
    pattern: plan.pattern.name,
    weeks: plan.weeks.length,
    sessionsPerWeek: plan.pattern.sessionsPerRotation,
    totalDirectSets: Object.values(weekly).reduce((sum, volume) => sum + Object.values(volume).reduce((s, item) => s + item.directSets, 0), 0),
    peakDirectSets: peak.total,
    peakWeek: peak.week,
    peakVolume: peak.volume,
    rotationWarnings: plan.rotationReport?.issues.length || 0,
    maxSessionMinutes: Math.round(Math.max(0, ...fatigue.flatMap(item => item.sessions.map(session => session.timeSeconds))) / 60),
    maxAxialCost: Math.round(Math.max(0, ...fatigue.flatMap(item => item.sessions.map(session => session.axial))) * 10) / 10,
    validationValid: plan.validation?.valid ?? true,
    validationErrors: plan.validation?.issues.filter(issue => issue.level === 'error').length || 0,
    validationWarnings: plan.validation?.issues.filter(issue => issue.level === 'warning').length || 0,
    sessionLeakWarnings: plan.validation?.issues.filter(issue => issue.code === 'session_muscle_leak').length || 0,
    balance: plan.balanceReport,
    expandedSummary: plan.expandedSummary,
    optionalExercises,
    weakPoints,
  };
}

/** RU-подписи мышц (компактно). */
const MUSCLE_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', quads: 'Квадрицепсы', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', biceps: 'Бицепс', triceps: 'Трицепс', forearms: 'Предплечья', abs: 'Пресс', traps: 'Трапеции', arms: 'Руки', legs: 'Ноги', core: 'Кор' };

const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', deload: 'Разгрузка', peaking: 'Пик' };

/** Распределение фаз по неделям: «Накопление: нед 1-4 · Интенсификация: нед 5-7». */
function phaseSummary(plan: BBPlan): string {
  const seq: Array<{ phase: string; from: number; to: number }> = [];
  for (const wk of plan.weeks) {
    const phase = String((wk as any).phase || '').toLowerCase() || 'рабочая';
    const last = seq[seq.length - 1];
    if (last && last.phase === phase) last.to = wk.week;
    else seq.push({ phase, from: wk.week, to: wk.week });
  }
  return seq.map(s => `${PHASE_RU[s.phase] || s.phase}: нед ${s.from}${s.to !== s.from ? '-' + s.to : ''}${(plan.weeks.find(w => w.week === s.to) as any)?.deload ? ' (делод)' : ''}`).join(' · ');
}

/** Покрытие функций сложных мышц (evidence: разные функции требуют разных паттернов —
 *  спина ≥3 функций (ширина/толщина/задняя дельта), грудь (верх/середина/низ) и т.д.).
 *  Проверка по ПАТТЕРНУ упражнения (надёжнее подгрупп — наклонные жимы не всегда
 *  попадают в подгруппу chest_upper). */
const FUNCTION_REQ: Record<string, { labelRu: string; test: (n: string, m: string) => boolean }[]> = {
  back: [
    { labelRu: 'ширина (вертикальная тяга)', test: (n, m) => m === 'back' && /подтяг|верхн.*блок|lat.?pull|пулдаун|вертикальн|широчайш/i.test(n) },
    { labelRu: 'толщина (горизонтальная тяга)', test: (n, m) => m === 'back' && /тяга|гребн|row/i.test(n) && !/верхн|вертик|подтяг|блок/i.test(n) },
    { labelRu: 'задняя дельта', test: (n) => /задн.*дельт|обратн.*свед|face.?pull|тяга к лиц|rear.?delt/i.test(n) },
  ],
  chest: [
    { labelRu: 'верх (наклон 30°)', test: (n, m) => m === 'chest' && /наклон|incline/i.test(n) },
    { labelRu: 'середина (горизонтальный жим)', test: (n, m) => m === 'chest' && /лёжа|лежа|гориз|bench/i.test(n) && !/наклон/i.test(n) },
    { labelRu: 'низ (брусья)', test: (n, m) => m === 'chest' && /брус|dip/i.test(n) },
  ],
  hamstrings: [
    { labelRu: 'таз (RDL/шарнир)', test: (n, m) => m === 'hamstrings' && /румын|rdl|гудморнинг|шарнир|наклон.*штанг/i.test(n) },
    { labelRu: 'колено (сгибания)', test: (n, m) => m === 'hamstrings' && /сгибан.*ног|leg.?curl/i.test(n) },
  ],
  triceps: [
    { labelRu: 'длинная (overhead)', test: (n, m) => m === 'triceps' && /француз|french|overhead|из.?за.*голов/i.test(n) },
    { labelRu: 'латеральная (блок)', test: (n, m) => m === 'triceps' && /блок|pushdown|разгибан/i.test(n) && !/француз/i.test(n) },
  ],
};

const MUSCLE_RU_NAME: Record<string, string> = { back: 'Спина', chest: 'Грудь', hamstrings: 'Бицепс бедра', triceps: 'Трицепс' };

/** Проверить покрытие функций сложных мышц по паттернам упражнений. Возвращает RU-issues. */
export function checkBBFunctionCoverage(plan: BBPlan): string[] {
  const all = plan.weeks.flatMap(w => (w.sessions || [])).flatMap(s => (s.exercises || [])).filter((e: any) => !(e as any).warmupActivator);
  if (!all.length) return [];
  const issues: string[] = [];
  for (const [muscle, reqs] of Object.entries(FUNCTION_REQ)) {
    const muscleExs = all.filter((e: any) => e.muscle === muscle);
    if (!muscleExs.length) continue;
    const missing = reqs.filter(r => !all.some((e: any) => r.test(e.name || '', e.muscle || '')));
    if (missing.length) {
      issues.push(`${MUSCLE_RU_NAME[muscle] || muscle}: не покрыта функция — ${missing.map(r => r.labelRu).join(', ')}.`);
    }
  }
  return issues;
}

/** Проверить адекватность выбранных упражнений: жимы в decline (низкая ценность для
 *  гипертрофии) и кросс-мышечные несоответствия (упражнение тренирует не ту мышцу,
 *  что в слоте плана — напр. пуловер с group='chest', но trueMuscleOf='back'). */
export function checkBBExerciseAppropriateness(plan: BBPlan): string[] {
  const issues: string[] = [];
  for (const week of plan.weeks) for (const s of week.sessions || []) for (const ex of s.exercises || []) {
    if ((ex as any).warmupActivator) continue;
    const n = ex.name || '';
    // Decline-жим: низкая практическая ценность (горизонталь+наклон покрывают грудь).
    if (/отриц|decline|отрицательн/.test(n)) {
      issues.push(`Жим в негативном наклоне «${n}» — низкая ценность для гипертрофии груди (лучше заменить на горизонтальный/наклонный жим).`);
      continue;
    }
    // Кросс-мышечное несоответствие: trueMuscleOf ≠ слот плана.
    // Резолвим через каталог (полные group/type/movementPattern), иначе пуловер
    // (каталог-group 'chest', но по имени 'back') давал ложное срабатывание.
    const catalogEx = EXERCISE_CATALOG.find(c => c.name === ex.name || c.id === (ex as any).exerciseName);
    const tm = catalogEx
      ? trueMuscleOf({ name: ex.name, muscle: ex.muscle, group: (catalogEx as any).group, type: (catalogEx as any).type, movementPattern: (catalogEx as any).movementPattern, targetMuscle: (catalogEx as any).targetMuscle } as any)
      : trueMuscleOf({ name: ex.name, muscle: ex.muscle } as any);
    if (tm && tm !== ex.muscle) {
      issues.push(`«${n}» поставлен в слот «${ex.muscle}», но реально тренирует «${tm}» (проверьте соответствие).`);
    }
  }
  return issues;
}

/** Прогрессия нагрузки: средний прирост рабочего веса от недели 1 к пиковой неделе. */
function progressionSummary(plan: BBPlan): string {  const byName = new Map<string, { w1: number; pk: number; muscle: string }>();
  for (const week of plan.weeks) {
    const isPeak = week.week === plan.report?.peakWeek || week.week === plan.weeks.length;
    for (const s of week.sessions || []) for (const ex of s.exercises || []) {
      if ((ex as any).warmupActivator || ex.role !== 'primary') continue;
      const w = ex.workSets?.[0]?.weight ?? 0;
      if (!w) continue;
      const key = ex.name;
      const cur = byName.get(key);
      if (week.week === 1) byName.set(key, { w1: w, pk: w, muscle: ex.muscle });
      else if (isPeak && cur) byName.set(key, { ...cur, pk: w });
    }
  }
  const rows = [...byName.values()].filter(r => r.w1 > 0 && r.pk > 0);
  if (!rows.length) return '';
  const gains = rows.map(r => (r.pk / r.w1 - 1) * 100);
  const avg = gains.reduce((a, b) => a + b, 0) / gains.length;
  const peakWeek = plan.report?.peakWeek || plan.weeks.length;
  if (Math.abs(avg) < 0.5) return `Прогрессия: веса стабильны (нед 1 → пик нед ${peakWeek}, Δ ~0%)`;
  const dir = avg > 0 ? '↑' : '↓';
  return `Прогрессия: рабочие веса ${dir} ~${Math.abs(Math.round(avg))}% к пику (нед 1 → нед ${peakWeek}, ${rows.length} первичных упражнений)`;
}

/** Сводка применённых методик (памп/дропы/суперсеты/схемы объёма/DUP/порядок) —
 *  чтобы пользователь видел, что реально включено в план. */
export function buildBBMethodologySummary(plan: BBPlan): string[] {
  const out: string[] = [];
  const p: any = plan as any;
  // Порядок упражнений (методика pre/post-exhaust / compound_first).
  const methodLabel: Record<string, string> = { compound_first: 'базы → изоляция', pre_exhaust: 'изоляция → база (пред-истощение)', post_exhaust: 'база → изоляция' };
  if (p.methodology && p.methodology !== 'compound_first') out.push(`Порядок: ${methodLabel[p.methodology] || p.methodology}`);
  // Суперсеты: антагонисты vs одна группа (только 🔗 Суперсет; пре/гигант — отдельно).
  let samePairs = 0, antaPairs = 0;
  for (const w of plan.weeks) for (const s of w.sessions || []) for (const ex of s.exercises || []) {
    if (!(ex as any).supersetWith) continue;
    if (!((ex.comment || '').includes('🔗 Суперсет'))) continue;
    if ((ex.comment || '').includes('одна группа')) samePairs++;
    else antaPairs++;
  }
  if (antaPairs > 0) out.push(`Суперсеты (антагонисты): ${antaPairs} упражнений в парах`);
  if (samePairs > 0) out.push(`Суперсеты (одна группа — «пробить»): ${samePairs} упражнений в парах`);
  // Pre-exhaust-пары и гигант-сеты.
  let preCount = 0, giantCount = 0;
  for (const w of plan.weeks) for (const s of w.sessions || []) for (const ex of s.exercises || []) {
    const c = ex.comment || '';
    if (c.includes('⚡ Пред-истощение')) preCount++;
    if (c.includes('🔄 Гигант-сет')) giantCount++;
  }
  if (preCount > 0) out.push(`Pre-exhaust (изоляция → база без отдыха): ${preCount} упражнений в паре`);
  if (giantCount > 0) out.push(`Гигант-сет (3 упражнения одной группы): ${giantCount} упражнений`);
  // Интенсивные техники (дропы/rest-pause/myo-reps/21s) на последнем подходе.
  let techCount = 0;
  const techNames = new Set<string>();
  for (const w of plan.weeks) for (const s of w.sessions || []) for (const ex of s.exercises || []) {
    const c = ex.comment || '';
    const m = c.match(/💥\s*(.+?)\s*на последнем/);
    const wsTech = (ex.workSets || []).some((ws: any) => ws.technique);
    if (wsTech || m) { techCount++; if (m) techNames.add(m[1].trim()); }
  }
  if (techCount > 0) out.push(`Интенсивные техники (${[...techNames].join(', ') || 'дропы/rest-pause'}): ${techCount} упражнений, на последнем подходе`);
  // Схемы объёма памп-дней.
  const schemeMap: Record<string, string> = { gvt: 'GVT 10×10', fst7: 'FST-7', gironda: '8×8 Gironda' };
  let schemeCount = 0; let schemeLabel = '';
  for (const w of plan.weeks) for (const s of w.sessions || []) for (const ex of s.exercises || []) {
    const c = ex.comment || '';
    const m = c.match(/(GVT 10×10|FST-7|8×8 Gironda)/);
    if (m) { schemeCount++; schemeLabel = schemeLabel || m[1]; }
  }
  if (schemeCount > 0) out.push(`Схема объёма памп-дней: ${schemeLabel} на ${schemeCount} упражнениях`);
  // DUP.
  if (p.dupMode && p.dupMode !== 'none') out.push(`DUP: ${p.dupMode}`);
  return out;
}

/** Полный текстовый отчёт ББ-плана (сводка/баланс/фазы/нагрузка). */
export function buildBBPlanReportText(plan: BBPlan): string {
  const lines: string[] = [];
  lines.push(`План: ${plan.pattern.name} · ${plan.weeks.length} нед · ${plan.pattern.sessionsPerRotation} сессий/нед`);
  // Настройки — только реально выбранные параметры, без дублей и внутренних имён.
  const p: any = plan as any;
  const settings: string[] = [];
  if (p.level) settings.push(`Уровень: ${p.level}`);
  if (p.goal) settings.push(`Цель: ${p.goal}`);
  if (p.trainingFocus) settings.push(`Фокус: ${p.trainingFocus}`);
  if (p.methodology) settings.push(`Методика: ${p.methodology}`);
  if (p.supersetMode) settings.push(`Суперсеты: ${p.supersetMode}`);
  if (p.volumeScheme) settings.push(`Схема объёма: ${p.volumeScheme}`);
  if (p.dupMode) settings.push(`DUP: ${p.dupMode}`);
  // Объём — одна запись (не дублировать volumeMode/volumeGoal)
  const volMode = p.trainingVolumeMode === 'high' ? `Объёмный (${p.volumeScheme || 'MRV'}, кап 5 сетов)` : `Обычный (${p.volumeGoal || 'MAV'})`;
  if (p.trainingVolumeMode || p.volumeGoal) settings.push(`Объём: ${volMode}`);
  if (p.trainingYears != null) settings.push(`Стаж: ${p.trainingYears} лет`);
  // Курс/ПЕД — одна запись (PED + множитель, не дублировать courseIntensity/MRV×)
  const peds = p.pedAdaptation?.activePEDs?.length ? `${p.pedAdaptation.activePEDs.join(', ')} ×${p.pedAdaptation.combinedMrvMultiplier?.toFixed(2)}` : (p.courseIntensity ? p.courseIntensity : null);
  if (peds) settings.push(`Курс: ${peds}`);
  if (p.maxWorkingSets) settings.push(`Капы: ${p.maxWorkingSets} сетов / ${p.maxExercises} упр.`);
  const snap = p.inputSnapshot || {};
  if (snap.rotationMode) settings.push(`Ротация: ${snap.rotationMode}`);
  if (snap.intensityLevel) settings.push(`Интенсивность: ${snap.intensityLevel}`);
  if (snap.avoidAxialLoad) settings.push('Без осевой');
  if (snap.equipment?.length) settings.push(`Оборудование: ${snap.equipment.join(', ')}`);
  if (snap.injuries?.length) settings.push(`Травм: ${snap.injuries.length}`);
  if (snap.mobilityRestrictions?.length) settings.push(`Мобильность: ${snap.mobilityRestrictions.join(', ')}`);
  if (snap.autoDeload != null) settings.push(`Авто-делод: ${snap.autoDeload ? 'да' : 'нет'}`);
  if (snap.loadStrategy) settings.push(`Прогрессия: ${snap.loadStrategy}`);
  if (snap.eccentricMult && snap.eccentricMult !== 1) settings.push(`Эксцентрик ×${snap.eccentricMult}`);
  if (settings.length) {
    lines.push(`Настройки: ${settings.join(' · ')}`);
    lines.push('');
  }
  // Применённые методики (памп/дропы/суперсеты/схемы/DUP/порядок).
  const methods = buildBBMethodologySummary(plan);
  if (methods.length) {
    lines.push(`🧩 Методики: ${methods.join(' · ')}`);
  }
  // PED-методика (BFR, joint-guard, insulin window, схемы, blast/cruise, RIR дрифт)
  const pedLines = (plan.rationale || []).filter((l: string) => /💉|🛡|🧬|📋 Схема|🩸 BFR|🔄 Сплит.*фарму|Blast|Cruise|BFR/i.test(l));
  if (pedLines.length) {
    lines.push(`🧬 PED-методика: ${pedLines.slice(0, 8).join(' · ')}`);
    for (const pl of pedLines.slice(0, 6)) if (!methods.join(' ').includes(pl.slice(0, 15))) lines.push(`  ${pl}`);
  }
  if ((plan as any).bfrMode) lines.push(`🩸 BFR-режим: памп-изоляции 30-15-15-15 @25% (тяж без изменений)`);
  if ((plan as any).blastCruiseEnabled) {
    const bw = (plan as any).blastWeeks ?? 8, cw = (plan as any).cruiseWeeks ?? 4;
    lines.push(`🔄 Blast/Cruise: ${bw}н ×1.15 / ${cw}н ×0.85 (повторяется)`);
  }
  // Фазы — чего ждать по неделям (практическая ценность: делод/пик видны заранее).
  const phases = phaseSummary(plan);
  if (phases) lines.push(`📅 Фазы: ${phases}`);
  // Баланс и позиции — симметрия жимов/тяг + растянутая позиция (evidence: lengthened bias).
  const balance = plan.balanceReport;
  if (balance) {
    const ratio = balance.pullPressRatio ? balance.pullPressRatio.toFixed(2) : '—';
    lines.push(`⚖️ Баланс: тяги ${balance.pull} / жимы ${balance.press} (ratio ${ratio}) · compound ${balance.compound} / изоляция ${balance.isolation} · позиции: растянутая ${balance.lengthened} / срединная ${balance.midRange} / сокращённая ${balance.shortened}`);
    for (const issue of (balance.issues || [])) lines.push(`  ${/^Нет/.test(issue) ? '⚠' : 'ℹ'} ${issue}`);
  }
  // Валидация — безопасно ли выполнять план.
  if (plan.validation) {
    const v = plan.validation;
    if (v.valid) lines.push('✅ Валидация: план валиден (0 ошибок).');
    else lines.push(`❌ Валидация: ${(v.issues || []).filter(i => i.level === 'error').length} ошибок, ${(v.issues || []).filter(i => i.level === 'warning').length} предупреждений.`);
  }
  // Покрытие функций сложных мышц — что не закрыто по паттернам (практическая ценность).
  const coverage = checkBBFunctionCoverage(plan);
  if (coverage.length) {
    lines.push('🧩 Покрытие функций:');
    for (const c of coverage) lines.push(`  ⚠ ${c}`);
  }
  // Прогрессия нагрузки к пику.
  const prog = progressionSummary(plan);
  if (prog) lines.push(prog);
  // Адекватность упражнений (низкоценные/кросс-мышечные) — для информации пользователю.
  const approx = checkBBExerciseAppropriateness(plan);
  if (approx.length) {
    lines.push('🧹 Адекватность упражнений:');
    for (const a of approx) lines.push(`  ⚠ ${a}`);
  }
  lines.push('');
  lines.push('📋 Недельная сводка сетов:');
  if (plan.expandedSummary) {
    for (const [muscle, m] of Object.entries(plan.expandedSummary.byMuscle)) {
      lines.push(`  ${MUSCLE_RU[muscle] || muscle} — ${m.sessionsPerWeek} тр/нед · ${m.workingSets} раб · direct ${m.directSets} · косв. ${Math.round(m.indirectSets)}`);
      const sg = (m as any).subGroups as Record<string, any> | undefined;
      if (sg && Object.keys(sg).length) {
        for (const [subId, sub] of Object.entries(sg)) {
          const expl = (sub as any).explanation as { labelRu?: string; patternRu?: string } | undefined;
          const label = expl?.labelRu || subId;
          const subEx = Object.entries(sub.byExercise || {}).map(([e, v]) => `${e} ${v}`).join(', ');
          lines.push(`    └ ${label}: ${sub.workingSets} сетов${subEx ? ` — ${subEx}` : ''}`);
        }
      } else {
        const byEx = Object.entries((m as any).byExercise || {}).map(([e, v]) => `${e} ${v}`).join(', ');
        if (byEx) lines.push(`    ${byEx}`);
      }
    }
    lines.push(`  Итого: ${plan.expandedSummary.totalWorkingSets} рабочих сетов/нед`);
  }
  lines.push('');
  const wps = plan.priorityMuscles?.filter(m => !['delt_front', 'delt_mid', 'delt_rear'].includes(m)) || [];
  if (wps.length) lines.push(`🎯 Слабые группы: ${wps.map(m => MUSCLE_RU[m] || m).join(', ')} (+1 упражнение без капа)`);
  const optionalCount = plan.report?.optionalExercises ?? 0;
  if (optionalCount > 0) lines.push(`⚡ Упражнений «при наличии сил» (optional): ${optionalCount}`);
  lines.push('');
  // Нагрузка — эталонная неделя 1 (без повтора упражнений по всем неделям).
  lines.push('📊 Нагрузка (эталон, неделя 1 — веса/повторы по неделям прогрессируют):');
  const seen = new Set<string>();
  for (const week of plan.weeks) {
    for (const session of (week.sessions || [])) {
      for (const ex of (session.exercises || [])) {
        if ((ex as any).warmupActivator) continue;
        const key = `${ex.muscle}:${ex.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const muscle = MUSCLE_RU[ex.muscle] || ex.muscle;
        const w = ex.workSets?.[0]?.weight ?? 0;
        const r = ex.workSets?.[0]?.reps ?? ex.sets;
        const opt = (ex as any).optional ? ' ⚡' : '';
        lines.push(`  ${muscle}: ${ex.name}${opt} — ${ex.sets}×${r} @ ${w}кг RIR ${ex.rir}`);
      }
    }
    if (week.week === 1) break;
  }
  return lines.join('\n');
}
