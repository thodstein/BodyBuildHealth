import { TrainingInput, TrainingOutput, Exercise } from '../core/types';
import { EXERCISE_CATALOG, getExercisesByGroup, canReplace, getSubstitutes, getExerciseById } from '../core/exercise-catalog';

export { EXERCISE_CATALOG as EXERCISE_DB, getExercisesByGroup as selectExercises, canReplace, getSubstitutes, getExerciseById };

// ТЗ §5.1: Матрица MV-MRV по уровням
const MV_MR_V: Record<string, { mv: number; mev: number; mav: number; mrv: number }> = {
  beginner:    { mv: 4,  mev: 8,  mav: 12, mrv: 16 },
  intermediate:{ mv: 6,  mev: 10, mav: 16, mrv: 20 },
  advanced:    { mv: 8,  mev: 12, mav: 18, mrv: 24 },
  enhanced:    { mv: 10, mev: 14, mav: 22, mrv: 28 }
} as const;

// ТЗ §6.1: Дерево выбора сплита (15 вариантов)
const SPLITS: Record<string, { name: string; days: number; desc: string; condition: (i: TrainingInput) => boolean; volumeModifier?: Record<string, number> }> = {
  recovery_3:   { name: 'Восстановительный 3x', days: 3, desc: '50% объёма, RIR 4, безопасные движения', condition: i => i.recovery < 50 || i.fatigue > 70 || i.nutrition < 50, volumeModifier: { chest: 0.5, back: 0.5, legs: 0.5, shoulders: 0.5, arms: 0.5, core: 0.5 } },
  fullbody_3:   { name: 'Фулбоди 3x', days: 3, desc: 'Все группы на каждой тренировке', condition: i => i.daysPerWeek === 3 && i.recovery >= 50 },
  upperlower_4: { name: 'Верх/Низ 4x', days: 4, desc: 'Верх/низ чередуются', condition: i => i.daysPerWeek === 4 && i.recovery >= 55 },
  upperlower_5: { name: 'Верх/Низ 5x', days: 5, desc: '3 верх / 2 низ', condition: i => i.daysPerWeek === 5 && i.level === 'advanced' && i.recovery >= 65 },
  ppl_accent_5: { name: 'PPL + Акцент 5x', days: 5, desc: 'Push/Pull/Legs + 2 акцентных', condition: i => i.daysPerWeek === 5 && i.weakPoints.length > 0 },
  ppl_2x_6:     { name: 'PPL 2x 6x', days: 6, desc: 'PPL дважды в неделю', condition: i => i.daysPerWeek >= 6 && i.recovery >= 70 && i.fatigue < 60 },
  ppl_hybrid_4: { name: 'PPL Гибрид 4x', days: 4, desc: 'Push, Pull, Legs, Upper', condition: i => i.daysPerWeek === 4 && i.level === 'intermediate' },
  arnold_6:     { name: 'Сплит Арнольда 6x', days: 6, desc: 'Грудь+спина, плечи+руки, ноги', condition: i => i.daysPerWeek === 6 && i.goal !== 'strength' && i.recovery >= 65 },
  bro_5:        { name: 'Бро-сплит 5x', days: 5, desc: 'Одна группа в день', condition: i => i.daysPerWeek === 5 && i.level !== 'beginner' && i.goal === 'hypertrophy' },
  strength_4:   { name: 'Силовой 4x', days: 4, desc: 'Compound фокус, RIR 2-3', condition: i => i.goal === 'strength' },
  hypertrophy_6:{ name: 'Гипертрофийный 6x', days: 6, desc: 'Высокий объём, акцент ROM', condition: i => i.daysPerWeek === 6 && i.goal === 'hypertrophy' && i.recovery >= 60 },
  torso_limbs_4:{ name: 'Торс/Конечности 4x', days: 4, desc: 'Торс отдельно, конечности отдельно', condition: i => i.daysPerWeek === 4 && !!(i.injuries?.some(inj => typeof inj === 'object' ? inj.location === 'Поясница' || inj.location === 'Колено' : inj === 'lower' || inj === 'back')) },
  pushpull_la_5:{ name: 'Push/Pull + Ноги/Руки 5x', days: 5, desc: 'Компромисс PPL/Bro', condition: i => i.daysPerWeek === 5 && i.weakPoints.length === 0 },
  cbs_da_5:     { name: 'Грудь/Спина/Ноги/Дельты/Руки 5x', days: 5, desc: 'Классический раздельный', condition: i => i.daysPerWeek === 5 && i.recovery >= 65 && i.level !== 'beginner' },
  spec_5:       { name: 'Специализация 5x', days: 5, desc: 'Частота на 1-2 отстающих', condition: i => i.daysPerWeek === 5 && i.weakPoints.length === 1 }
} as const;

// ТЗ §5.5: RIR по целям
const RIR_MAP: Record<string, string> = {
  strength: '2-3', hypertrophy: '1-2', endurance: '3-4', recovery: '4',
  maintenance: '2-3', bulk: '2-3', cut: '1-2', rehab: '3-4'
} as const;

// Расчёт подходов, повторений, RIR, дроп-сетов
export function calcExercisePrescription(
  exercise: Exercise,
  goal: string,
  level: string,
  isWeakGroup: boolean,
  isDeload: boolean,
  volumeMultiplier: number
): { sets: number; reps: string; rir: number; dropSet: boolean; dropSetReps: string; backoffSet: boolean; rest: number } {
  const goalRir = goal === 'strength' ? 2 : goal === 'hypertrophy' || goal === 'bulk' ? 1 : goal === 'cut' ? 2 : 3;
  const baseSets = level === 'beginner' ? 3 : level === 'intermediate' ? 3 : 4;
  let sets = Math.max(2, Math.round(baseSets * volumeMultiplier * (isWeakGroup ? 1.2 : 1.0)));
  if (isDeload) sets = Math.max(2, Math.round(sets * 0.6));

  const repRanges: Record<string, [number, number]> = {
    strength: [3, 6], hypertrophy: [8, 12], bulk: [6, 10], cut: [10, 15],
    maintenance: [8, 12], endurance: [12, 20], rehab: [12, 20], recomp: [6, 10],
  };
  const range = repRanges[goal] || [8, 12];
  if (exercise.type === 'compound') { range[0] = Math.max(3, range[0] - 2); range[1] = Math.max(6, range[1] - 2); }
  const reps = `${range[0]}-${range[1]}`;

  let rir = isDeload ? 4 : goalRir;
  if (isWeakGroup && !isDeload) rir = Math.max(0, rir - 1);

  const dropSet = !isDeload && exercise.type === 'isolation' && (goal === 'hypertrophy' || goal === 'bulk');
  const dropSetReps = dropSet ? `${Math.max(4, range[0] - 2)}-${range[1]}` : '';
  const backoffSet = !isDeload && exercise.type === 'compound' && (goal === 'strength' || goal === 'hypertrophy');

  const rest = exercise.type === 'compound'
    ? (goal === 'strength' ? 180 : 120)
    : (goal === 'cut' ? 45 : 60);

  return { sets, reps, rir, dropSet, dropSetReps: dropSet ? `${Math.max(4, range[0] - 2)}-${range[1]}` : '', backoffSet, rest };
}

export function assignIntensityTechnique(
  exercise: Exercise,
  goal: string,
  level: string,
  dayIndex: number,
  weekNum: number,
): import('../core/types').SetFormat | undefined {
  const isCompound = exercise.type === 'compound';
  const isIsolation = exercise.type === 'isolation';
  const isAdvancedLevel = level === 'advanced' || level === 'enhanced';
  const isStrengthGoal = goal === 'strength';
  const isHypGoal = goal === 'hypertrophy' || goal === 'bulk';

  if (isStrengthGoal && isCompound) {
    if (weekNum > 2 && dayIndex % 2 === 0) {
      return { technique: 'cluster', exercises: [exercise.id], clusterReps: '1.1.1', intraSetRest: 20 };
    }
    if (weekNum > 3 && isAdvancedLevel) {
      return { technique: 'rest_pause', exercises: [exercise.id], intraSetRest: 15, activationReps: undefined };
    }
  }

  if (isHypGoal && isIsolation && isAdvancedLevel) {
    const variant = dayIndex % 3;
    if (variant === 0) return { technique: 'myo_rep', exercises: [exercise.id], activationReps: 15, miniSetReps: 3, miniSetRestSeconds: 5 };
    if (variant === 1) return { technique: 'rest_pause', exercises: [exercise.id], intraSetRest: 15 };
    if (variant === 2) return { technique: 'drop_set', exercises: [exercise.id], dropWeightPct: 25 };
  }

  if ((goal === 'recomp' || goal === 'cut') && isIsolation && dayIndex % 2 === 1) {
    const pairGroup = exercise.group === 'chest' ? 'back' : exercise.group === 'back' ? 'chest' : exercise.group === 'arms' ? 'shoulders' : 'arms';
    return { technique: 'superset', exercises: [exercise.id], restBetweenExercises: 0 };
  }

  if (isHypGoal && isCompound && weekNum >= 2 && isAdvancedLevel) {
    return { technique: 'backoff_set', exercises: [exercise.id] };
  }

  return undefined;
}

export function calcTraining(i: TrainingInput): TrainingOutput {
  const base = MV_MR_V[i.level];
  let volume = base.mav;

  if (i.recovery < 50) volume *= 0.8;
  if (i.fatigue > 60) volume *= 0.9;
  if (i.nutrition < 60) volume *= 0.85;

  const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const volMap: Record<string, number> = {};
  const wpFactor = 1.2;
  const nonWpFactor = Math.max(0.7, 1.0 - (0.1 * i.weakPoints.length));

  groups.forEach(g => { volMap[g] = i.weakPoints.includes(g) ? volume * wpFactor : volume * nonWpFactor; });

  let selected = Object.values(SPLITS).find(s => s.condition(i)) || SPLITS['upperlower_4'];
  let splitName = selected.name;
  let splitDesc = selected.desc;

  if (selected.volumeModifier) {
    Object.entries(selected.volumeModifier).forEach(([g, mod]) => { if (volMap[g] !== undefined) volMap[g] *= mod; });
  }

  let rir = RIR_MAP[i.goal] || '2-3';
  let isDeload = false;
  let deloadReason = '';

  if (i.recovery < 55) { isDeload = true; deloadReason = 'Recovery < 55'; rir = '4'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.5; }); }
  else if (i.fatigue > 70) { isDeload = true; deloadReason = 'Fatigue > 70'; rir = '4'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.6; }); }
  else if (i.nutrition < 55) { isDeload = true; deloadReason = 'Nutrition < 55'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.7; }); }

  const roundedVol: Record<string, number> = {};
  Object.entries(volMap).forEach(([k, v]) => { roundedVol[k] = Math.round(v); });

  const weekPlan = isDeload
    ? 'НЕДЕЛЯ 1 (ДЕЛОД): 50% объёма, RIR 4, без отказов, акцент на технику и мобильность'
    : 'НЕДЕЛЯ 1 (ВХОД): 70% MAV, RIR 3, фокус на технику, прогрессия весов со 2-й недели';

  const progressionNote = !isDeload ? ' | Нед 2-4: +2.5-5% весов или +1 сет на группу' : '';

  return {
    splitName,
    splitDesc: splitDesc + progressionNote,
    volumePerGroup: roundedVol,
    rir,
    isDeload,
    deloadReason,
    weekPlan
  };
}

export function getAvailableSplits(days: number, recovery: number): Array<{ id: string; name: string; desc: string }> {
  return Object.entries(SPLITS)
    .filter(([, s]) => s.days === days && s.condition({ daysPerWeek: days, recovery, fatigue: 50, nutrition: 70, level: 'intermediate', goal: 'hypertrophy', weakPoints: [] } as TrainingInput))
    .map(([id, s]) => ({ id, name: s.name, desc: s.desc }));
}

export function replaceExercise(originalId: string, replacementId: string): Exercise | null {
  if (!canReplace(originalId, replacementId)) return null;
  return getExerciseById(replacementId) || null;
}