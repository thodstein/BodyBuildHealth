import type { StrengthLogEntry, WorkoutLog } from '../core/types';

export interface ProgressionRule {
  type: 'linear' | 'double' | 'undulating' | 'conjugate';
  name: string;
  description: string;
  weeklyWeightIncrement: number;
  weeklyVolumeIncrement: number;
  deloadTrigger: { plateauWeeks: number; rpeFloor: number };
  deloadProtocol: { volumeMultiplier: number; rirAdd: number; weeks: number };
}

export const PROGRESSION_RULES: Record<string, ProgressionRule> = {
  linear: {
    type: 'linear',
    name: 'Линейная прогрессия',
    description: 'Еженедельное увеличение рабочего веса на фиксированную величину. Для новичков.',
    weeklyWeightIncrement: 2.5,
    weeklyVolumeIncrement: 0,
    deloadTrigger: { plateauWeeks: 3, rpeFloor: 9.5 },
    deloadProtocol: { volumeMultiplier: 0.6, rirAdd: 2, weeks: 1 },
  },
  double: {
    type: 'double',
    name: 'Двойная прогрессия',
    description: 'Сначала растут повторы (8→12), затем вес. Для среднего уровня.',
    weeklyWeightIncrement: 0,
    weeklyVolumeIncrement: 1,
    deloadTrigger: { plateauWeeks: 4, rpeFloor: 9 },
    deloadProtocol: { volumeMultiplier: 0.65, rirAdd: 2, weeks: 1 },
  },
  undulating: {
    type: 'undulating',
    name: 'Волнообразная прогрессия',
    description: 'RPE/RIR варьируется по неделе (4/6/8/3). Для продвинутых.',
    weeklyWeightIncrement: 1.25,
    weeklyVolumeIncrement: 0,
    deloadTrigger: { plateauWeeks: 3, rpeFloor: 9.5 },
    deloadProtocol: { volumeMultiplier: 0.6, rirAdd: 3, weeks: 1 },
  },
  conjugate: {
    type: 'conjugate',
    name: 'Конъюгейт',
    description: 'Упражнения ротируются каждые 1-3 недели. Максимум силы + вариативность.',
    weeklyWeightIncrement: 2.5,
    weeklyVolumeIncrement: 0,
    deloadTrigger: { plateauWeeks: 4, rpeFloor: 9.5 },
    deloadProtocol: { volumeMultiplier: 0.55, rirAdd: 3, weeks: 1 },
  },
};

export function selectProgressionRule(level: string): ProgressionRule {
  switch (level) {
    case 'beginner': return PROGRESSION_RULES.linear;
    case 'intermediate': return PROGRESSION_RULES.double;
    case 'advanced': return PROGRESSION_RULES.undulating;
    case 'enhanced': return PROGRESSION_RULES.conjugate;
    default: return PROGRESSION_RULES.double;
  }
}

export function estimate1RM(weight: number, reps: number): number {
  // AUD-FIX-5: реп-диапазонный blend (Epley <=10reps, Brzycki >10reps, зажим reps<=15)
  if (reps <= 1) return weight;
  if (weight <= 0) return 0;
  if (reps <= 10) return Math.round(weight * (1 + reps / 30) * 10) / 10;
  const r = Math.min(reps, 15);
  return Math.round((weight * 36) / (37 - r) * 10) / 10;
}

export function calcSuggestedWeight(
  exerciseId: string,
  logs: StrengthLogEntry[],
  currentWeek: number,
  rule: ProgressionRule,
  goal: string,
  isCompound: boolean,
  rpe?: number
): {
  suggestedWeight: number;
  increment: number;
  rationale: string;
  isDeload: boolean;
  deloadWeight: number;
  weeksAtCurrentWeight: number;
  plateauFlag: boolean;
} {
  const exerciseLogs = logs
    .filter(l => l.exerciseId === exerciseId && l.isCompound === isCompound)
    .sort((a, b) => b.date.localeCompare(a.date));

  const lastLog = exerciseLogs[0];
  const lastWeight = lastLog?.sets?.[0]?.weight ?? 0;
  const lastReps = lastLog?.sets?.[0]?.reps ?? 0;

  let weeksAtCurrentWeight = 0;
  let plateauFlag = false;

  if (exerciseLogs.length >= 2) {
    const recentWeights = exerciseLogs.slice(0, Math.min(4, exerciseLogs.length)).map(l => l.sets[0]?.weight ?? 0);
    const allSame = recentWeights.every(w => Math.abs(w - recentWeights[0]) < 0.5);
    if (allSame) {
      weeksAtCurrentWeight = recentWeights.length;
      if (weeksAtCurrentWeight >= rule.deloadTrigger.plateauWeeks) {
        plateauFlag = true;
      }
    }
  }

  const isDeload = plateauFlag || (rpe !== undefined && rpe >= rule.deloadTrigger.rpeFloor && weeksAtCurrentWeight >= 2);
  const deloadMultiplier = isDeload ? rule.deloadProtocol.volumeMultiplier : 1;
  const deloadWeight = lastWeight > 0 ? Math.round(lastWeight * deloadMultiplier * 10) / 10 : 0;

  let increment = 0;
  let suggestedWeight = 0;
  let rationale = '';

  if (lastWeight === 0) {
    if (goal === 'strength') suggestedWeight = isCompound ? 40 : 10;
    else if (goal === 'hypertrophy' || goal === 'bulk') suggestedWeight = isCompound ? 30 : 8;
    else suggestedWeight = isCompound ? 20 : 5;
    increment = 0;
    rationale = 'Начальный вес — первый подход. Оцените по самочувствию.';
  } else if (isDeload) {
    suggestedWeight = deloadWeight;
    increment = 0;
    rationale = `Делоад! Вес снижен до ${Math.round(deloadMultiplier * 100)}%. ${plateauFlag ? 'Плато обнаружено.' : `RPE ${rpe} ≥ ${rule.deloadTrigger.rpeFloor}.`} Восстановление ${rule.deloadProtocol.weeks} нед.`;
  } else if (rule.type === 'linear') {
    increment = rule.weeklyWeightIncrement * (isCompound ? 1 : 0.4);
    suggestedWeight = Math.round((lastWeight + increment) * 10) / 10;
    rationale = `Линейная прогрессия: +${increment} кг к прошлому рабочему весу (${lastWeight} кг × ${lastReps})`;
  } else if (rule.type === 'double') {
    if (lastReps >= 12) {
      increment = isCompound ? 2.5 : 1.25;
      suggestedWeight = Math.round((lastWeight + increment) * 10) / 10;
      rationale = `Двойная прогрессия: повторений ${lastReps} ≥ 12 → повышение веса на ${increment} кг (сброс повторений до 8)`;
    } else {
      suggestedWeight = lastWeight;
      increment = 0;
      rationale = `Двойная прогрессия: ${lastReps}/12 повторений. Добейте до 12 перед повышением веса.`;
    }
  } else if (rule.type === 'undulating') {
    const weekMod = currentWeek % 4;
    const undulatingRir = [4, 2, 1, 3][weekMod];
    increment = isCompound ? 1.25 : 0.5;
    const weightMod = weekMod === 0 ? 1.0 : weekMod === 2 ? 1.05 : weekMod === 3 ? 0.95 : 1.0;
    suggestedWeight = Math.round(lastWeight * weightMod * 10) / 10;
    rationale = `Волнообразная: неделя ${currentWeek} → RIR ${undulatingRir}, вес ×${weightMod} от базы (${lastWeight} кг)`;
  } else {
    increment = rule.weeklyWeightIncrement * (isCompound ? 1 : 0.4);
    suggestedWeight = Math.round((lastWeight + increment) * 10) / 10;
    rationale = `Конъюгейт: ротация упражнений + прогрессия +${increment} кг`;
  }

  return {
    suggestedWeight,
    increment,
    rationale,
    isDeload,
    deloadWeight,
    weeksAtCurrentWeight,
    plateauFlag,
  };
}

// Реэкспорт из единого deload-engine
export { getDeloadRecommendation } from './deload-engine';