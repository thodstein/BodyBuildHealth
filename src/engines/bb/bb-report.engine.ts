import type { BBPlan } from './bb-builder.engine';
import type { BBBalanceReport } from './bb-balance.engine';
import { BB_MRV_TOLERANCE } from './bb-validator.engine';

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

export { BB_MRV_TOLERANCE };

/** RU-подписи мышц (компактно). */
const MUSCLE_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', quads: 'Квадрицепсы', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', biceps: 'Бицепс', triceps: 'Трицепс', forearms: 'Предплечья', abs: 'Пресс', traps: 'Трапеции', arms: 'Руки', legs: 'Ноги', core: 'Кор' };

/** Полный текстовый отчёт ББ-плана (все изменения/выборы пользователя). */
export function buildBBPlanReportText(plan: BBPlan): string {
  const lines: string[] = [];
  lines.push(`План: ${plan.pattern.name} · ${plan.weeks.length} нед · ${plan.pattern.sessionsPerRotation} сессий/нед`);
  // Настройки — все выбранные кнопки, чтобы отчёт не был «от новичка» для объёмного плана
  const p: any = plan as any;
  const settings: string[] = [];
  if (p.level) settings.push(`Уровень: ${p.level}`);
  if (p.goal) settings.push(`Цель: ${p.goal}`);
  if (p.trainingVolumeMode) settings.push(`Режим объёма: ${p.trainingVolumeMode === 'high' ? 'Объёмный (MRV+GVT/FST-7, кап 5)' : 'Обычный (MAV)'}`);
  if (p.volumeGoal) settings.push(`Цель объёма: ${p.volumeGoal}`);
  if (p.trainingFocus) settings.push(`Фокус: ${p.trainingFocus}`);
  if (p.methodology) settings.push(`Методика: ${p.methodology}`);
  if (p.supersetMode) settings.push(`Суперсеты: ${p.supersetMode}`);
  if (p.volumeScheme) settings.push(`Схема объёма: ${p.volumeScheme}`);
  if (p.dupMode) settings.push(`DUP: ${p.dupMode}`);
  if (p.trainingYears != null) settings.push(`Стаж: ${p.trainingYears} лет`);
  if (p.courseIntensity) settings.push(`Курс: ${p.courseIntensity}`);
  if (p.pedAdaptation?.activePEDs?.length) settings.push(`PED: ${p.pedAdaptation.activePEDs.join(', ')} ×${p.pedAdaptation.combinedMrvMultiplier?.toFixed(2)}`);
  if (p.mrvMultiplier) settings.push(`MRV×: ${p.mrvMultiplier.toFixed(2)}`);
  if (p.maxWorkingSets) settings.push(`Капы: ${p.maxWorkingSets} сетов / ${p.maxExercises} упр.`);
  if (p.specializationSchedule?.active) {
    const t = p.priorityMuscles?.join(', ') || '';
    settings.push(`Специализация: ${t}`);
  }
  // Доп. кнопки — чтобы отчёт не был «от новичка» когда выбран объёмный/спец/травмы
  const snap = p.inputSnapshot || {};
  if (snap.fewerCompound) settings.push('Меньше базы: да');
  if (snap.rotationMode) settings.push(`Ротация: ${snap.rotationMode}`);
  if (snap.intensityLevel) settings.push(`Интенсивность: ${snap.intensityLevel}`);
  if (snap.avoidAxialLoad) settings.push('Без осевой: да');
  if (snap.equipment?.length) settings.push(`Оборудование: ${snap.equipment.join(', ')}`);
  if (snap.injuries?.length) settings.push(`Травмы: ${snap.injuries.length}`);
  if (snap.mobilityRestrictions?.length) settings.push(`Мобильность: ${snap.mobilityRestrictions.join(', ')}`);
  if (snap.autoDeload != null) settings.push(`Авто-делод: ${snap.autoDeload ? 'да' : 'нет'}${snap.deloadType ? ` (${snap.deloadType})` : ''}`);
  if (snap.loadStrategy) settings.push(`Прогрессия: ${snap.loadStrategy}`);
  if (snap.eccentricMult && snap.eccentricMult !== 1) settings.push(`Ecc×${snap.eccentricMult}`);
  if (settings.length) {
    lines.push(`Настройки: ${settings.join(' · ')}`);
    lines.push('');
  }
  lines.push('📋 Недельная сводка сетов:');
  if (plan.expandedSummary) {
    for (const [muscle, m] of Object.entries(plan.expandedSummary.byMuscle)) {
      lines.push(`  ${MUSCLE_RU[muscle] || muscle} — ${m.sessionsPerWeek} тр/нед · ${m.workingSets} раб · ${m.warmupSets} разм · direct ${m.directSets} · косв. ${Math.round(m.indirectSets)}`);
      if (m.bySession.length > 0) {
        lines.push(`    ${m.bySession.map((s, i) => `тр${i + 1}: ${s.working}р/${s.warmup}р`).join(', ')}`);
      }
      const patterns = Object.entries((m as any).byPattern || {}).map(([p, v]) => `${p} ${v}`).join(', ');
      if (patterns) lines.push(`    паттерн: ${patterns}`);
      const byEx = Object.entries((m as any).byExercise || {}).map(([e, v]) => `${e} ${v}`).join(', ');
      if (byEx) lines.push(`    упражнения: ${byEx}`);
      // Подгруппы для ВСЕХ мышц (этап 21): не только спина — грудь/плечи/ноги/руки с пояснениями
      const sg = (m as any).subGroups as Record<string, any> | undefined;
      if (sg && Object.keys(sg).length) {
        for (const [subId, sub] of Object.entries(sg)) {
          const expl = (sub as any).explanation as { labelRu?: string; patternRu?: string; why?: string; how?: string } | undefined;
          const label = expl?.labelRu || subId;
          lines.push(`    └ ${label}: ${sub.workingSets} сетов`);
          const subPat = Object.entries(sub.byPattern || {}).map(([p, v]) => `${p} ${v}`).join(', ');
          if (subPat) lines.push(`       паттерн: ${subPat}${expl?.patternRu ? ` (${expl.patternRu})` : ''}`);
          const subEx = Object.entries(sub.byExercise || {}).map(([e, v]) => `${e} ${v}`).join(', ');
          if (subEx) lines.push(`       упражнения: ${subEx}`);
          if (expl?.why) lines.push(`       чем хорошо: ${expl.why}`);
          if (expl?.how) lines.push(`       как работает: ${expl.how}`);
        }
      }
    }
    lines.push(`  Итого: ${plan.expandedSummary.totalWorkingSets} рабочих сетов/нед`);
  }
  lines.push('');
  const wps = plan.priorityMuscles?.filter(m => !['delt_front','delt_mid','delt_rear'].includes(m)) || [];
  if (wps.length) lines.push(`🎯 Слабые группы: ${wps.map(m => MUSCLE_RU[m] || m).join(', ')} (+1 упражнение без капа)`);
  const optionalCount = plan.report?.optionalExercises ?? 0;
  if (optionalCount > 0) lines.push(`⚡ Упражнений «при наличии сил» (optional): ${optionalCount}`);
  lines.push('');
  lines.push('🎯 Нагрузка:');
  for (const week of plan.weeks) {
    for (const session of (week.sessions || [])) {
      for (const ex of (session.exercises || [])) {
        if ((ex as any).warmupActivator) continue;
        const muscle = MUSCLE_RU[ex.muscle] || ex.muscle;
        const w = ex.workSets?.[0]?.weight ?? 0;
        const opt = (ex as any).optional ? ' ⚡' : '';
        lines.push(`  ${muscle}: ${ex.name}${opt} — ${ex.sets}×${ex.workSets?.[0]?.reps ?? ''} @ ${w}кг RIR ${ex.rir}`);
      }
    }
  }
  return lines.join('\n');
}
