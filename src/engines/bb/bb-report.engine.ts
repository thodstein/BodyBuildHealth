import type { BBPlan } from './bb-builder.engine';
import type { BBBalanceReport } from './bb-balance.engine';

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
    const phase = String((wk as any).phase || '').toLowerCase();
    const last = seq[seq.length - 1];
    if (last && last.phase === phase) last.to = wk.week;
    else seq.push({ phase, from: wk.week, to: wk.week });
  }
  return seq.map(s => `${PHASE_RU[s.phase] || s.phase}: нед ${s.from}${s.to !== s.from ? '-' + s.to : ''}${(plan.weeks.find(w => w.week === s.to) as any)?.deload ? ' (делод)' : ''}`).join(' · ');
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
