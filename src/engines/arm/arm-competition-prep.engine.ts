/**
 * arm-competition-prep.engine.ts — весогонка + календарь + ноги-якорь (эпик H).
 *
 * Весогонка: 0.5-0.75%/нед к потолку WAF-категории (пол-флор как contest-prep:
 * женский темп мягче). Календарь: дата старта → недели до пика → фаза.
 * Ноги-якорь: StrengthLog требует тяжёлые ноги для side-устойчивости —
 * мини-блок 1×/нед вместо заглушки LegsCore.
 */

export interface WeightCutPlan {
  startKg: number;
  targetKg: number;
  lossKg: number;
  weeksOut: number;
  ratePctPerWeek: number; // факт
  targetRatePctPerWeek: number; // цель
  status: 'on_track' | 'too_fast' | 'too_slow' | 'no_data';
  weeklyLossKg: number;
  note: string;
}

export function targetCutRate(sex: string): number {
  return (sex || '').toLowerCase() === 'female' ? 0.4 : 0.5;
}

export function planWeightCut(input: {
  startKg?: number;
  targetKg?: number;
  weeksOut?: number;
  sex?: string;
}): WeightCutPlan {
  const start = Number(input.startKg ?? 0);
  const target = Number(input.targetKg ?? 0);
  const weeks = Math.max(1, Math.round(Number(input.weeksOut ?? 0) || 0));
  const targetRate = targetCutRate(input.sex || 'male');
  if (!Number.isFinite(start) || !Number.isFinite(target) || start <= target || weeks <= 0) {
    return {
      startKg: start || 0,
      targetKg: target || 0,
      lossKg: 0,
      weeksOut: weeks,
      ratePctPerWeek: 0,
      targetRatePctPerWeek: targetRate,
      status: 'no_data',
      weeklyLossKg: 0,
      note: 'Нет сгонки: вес уже в категории или нет даты старта.',
    };
  }
  const lossKg = Math.round((start - target) * 10) / 10;
  const weeklyLossKg = Math.round((lossKg / weeks) * 100) / 100;
  const ratePctPerWeek = Math.round(((weeklyLossKg / start) * 100) * 100) / 100;
  let status: WeightCutPlan['status'] = 'on_track';
  if (ratePctPerWeek > targetRate * 1.3) status = 'too_fast';
  else if (ratePctPerWeek < targetRate * 0.55) status = 'too_slow';
  const note =
    status === 'too_fast'
      ? `Темп ${ratePctPerWeek}%/нед выше цели ${targetRate}% — риск силы, добавить ккал.`
      : status === 'too_slow'
        ? `Темп ${ratePctPerWeek}%/нед ниже цели — не успеете, начать раньше.`
        : `Сгонка ${lossKg} кг за ${weeks} нед (−${weeklyLossKg} кг/нед, ${ratePctPerWeek}%/нед) — в плане.`;
  return { startKg: start, targetKg: target, lossKg, weeksOut: weeks, ratePctPerWeek, targetRatePctPerWeek: targetRate, status, weeklyLossKg, note };
}

/** Недель до старта по датам (ISO). Минимум 1, прошлое → 1 (срочный пик). */
export function weeksUntilStart(fromIso?: string, startIso?: string): number {
  try {
    const from = fromIso ? new Date(fromIso) : new Date();
    const to = startIso ? new Date(startIso) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 8;
    const diffMs = to.getTime() - from.getTime();
    return Math.max(1, Math.ceil(diffMs / (7 * 86400000)));
  } catch {
    return 8;
  }
}

/** Фаза подготовки по неделям до старта: >8 база, 4-8 сила, 2-3 тейпер, 1 пик. */
export function prepPhaseForWeeksOut(weeksOut: number): 'base' | 'strength' | 'taper' | 'peak' {
  if (weeksOut <= 1) return 'peak';
  if (weeksOut <= 3) return 'taper';
  if (weeksOut <= 8) return 'strength';
  return 'base';
}

export interface LegsAnchorExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
}

/** Ноги-якорь 1×/нед: присед + тяга + фермер (side-устойчивость, не быть «тряпкой»). */
export function legsAnchorBlock(level: string): LegsAnchorExercise[] {
  const lvl = (level || '').toLowerCase();
  const sets = lvl === 'beginner' ? 3 : lvl === 'intermediate' ? 4 : 5;
  return [
    { id: 'back_squat_anchor', name: 'Присед со штангой (якорь)', sets, reps: '5-8' },
    { id: 'deadlift_anchor', name: 'Становая (якорь)', sets: sets - 1, reps: '3-5' },
    { id: 'farmer_carry_anchor', name: 'Фермерская прогулка (якорь)', sets: 3, reps: '30-40м' },
  ];
}
