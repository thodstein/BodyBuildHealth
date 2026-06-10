import { TrainingInput, TrainingOutput, Exercise } from '../core/types';
import { EXERCISE_CATALOG, getExercisesByGroup, canReplace, getSubstitutes, getExerciseById } from '../core/exercise-catalog';
import { RIR_MATRIX, MesocyclePhase, calculateWeeklyProgression, generateWeeklyPlan, getProgressionRationale } from './rir-matrix.engine';

export { EXERCISE_CATALOG as EXERCISE_DB, getExercisesByGroup as selectExercises, canReplace, getSubstitutes, getExerciseById };

// вЧ §5.1: Матрица MV-MRV по уровням (унифицировано с LEVEL_CONFIGS)
const LEVEL_VOLUMES: Record<string, { mv: number; mev: number; mav: number; mrv: number }> = {
  beginner:    { mv: 4,  mev: 8,  mav: 12, mrv: 16 },
  intermediate:{ mv: 6,  mev: 10, mav: 16, mrv: 20 },
  advanced:    { mv: 8,  mev: 12, mav: 18, mrv: 24 },
  enhanced:    { mv: 10, mev: 14, mav: 22, mrv: 28 }
} as const;

// унифицированные конфиги уровней (для calcTraining и макроцикла)
export const TRAINING_LEVEL_CONFIGS: Record<string, { volumeBase: number; rirBase: number; deloadFreq: number; progressionPct: number }> = {
  beginner: { volumeBase: 12, rirBase: 3, deloadFreq: 8, progressionPct: 5 },
  intermediate: { volumeBase: 16, rirBase: 2, deloadFreq: 6, progressionPct: 3.75 },
  advanced: { volumeBase: 20, rirBase: 1, deloadFreq: 5, progressionPct: 2.5 },
  enhanced: { volumeBase: 24, rirBase: 1, deloadFreq: 4, progressionPct: 2 },
};

// унифицированные конфиги целей
export const TRAINING_GOAL_CONFIGS: Record<string, { volumeMod: number; intensityMod: number; repsRange: [number, number]; restSeconds: number }> = {
  bulk: { volumeMod: 1.1, intensityMod: 0.9, repsRange: [8, 12], restSeconds: 90 },
  cut: { volumeMod: 0.85, intensityMod: 1.0, repsRange: [10, 15], restSeconds: 60 },
  strength: { volumeMod: 0.9, intensityMod: 1.15, repsRange: [3, 6], restSeconds: 180 },
  maintenance: { volumeMod: 1.0, intensityMod: 1.0, repsRange: [8, 12], restSeconds: 90 },
  recomp: { volumeMod: 1.0, intensityMod: 1.05, repsRange: [6, 10], restSeconds: 90 },
  rehab: { volumeMod: 0.7, intensityMod: 0.7, repsRange: [12, 20], restSeconds: 60 },
};

// унифицированный каталог сплитов (EXTENDED_SPLITS)
export const TRAINING_SPLITS: Record<string, { name: string; desc: string; groupsPerDay: string[][]; minDays: number; maxDays: number; level: string[] }> = {
  fullbody_3: { name: 'Фулбоди 3 дня', desc: 'Все группы на каждой тренировке. Частота 3×/нед на каждую группу.', groupsPerDay: [['chest','back','legs','shoulders','arms','core']], minDays: 3, maxDays: 3, level: ['beginner'] },
  fullbody_3alt: { name: 'Фулбоди Альтернативная', desc: '3 дня с чередованием акцентов: A — грудь/спина/квадрицепс, B — плечи/руки/задняя поверхность.', groupsPerDay: [['chest','back','legs'],['shoulders','arms','core']], minDays: 3, maxDays: 3, level: ['beginner','intermediate'] },
  upper_lower_4: { name: 'Верх/Низ 4 дня', desc: 'Чередование верхних и нижних дней. Каждая группа 2×/нед, оптимальный баланс.', groupsPerDay: [['chest','back','shoulders','arms'],['legs','core']], minDays: 4, maxDays: 4, level: ['beginner','intermediate'] },
  push_pull_legs_5: { name: 'PPL 5 дней', desc: 'Жим/тяга/Ноги с одним повторным днём. Популярный сплит.', groupsPerDay: [['chest','shoulders','arms'],['back','arms'],['legs','core']], minDays: 5, maxDays: 5, level: ['intermediate','advanced'] },
  push_pull_legs_6: { name: 'Push/Pull/Legs 6x', desc: 'PPL × 2 с вариациями упражнений. Максимальный объём.', groupsPerDay: [['chest','shoulders'],['back','arms'],['legs','core']], minDays: 6, maxDays: 6, level: ['advanced','enhanced'] },
  bro_5: { name: 'Бро-сплит 5 дней', desc: 'Одна группа в день. Максимальный объём на группу, но частота 1×/нед.', groupsPerDay: [['chest'],['back'],['legs'],['shoulders','arms'],['arms','core']], minDays: 5, maxDays: 5, level: ['intermediate','advanced'] },
  strength_4: { name: 'Силовой 4 дня', desc: 'Compound фокус, RIR 2-3, длинный отдых. Присед/Жим/Тяга/ОФП.', groupsPerDay: [['legs','core'],['chest','shoulders'],['back','arms'],['legs','shoulders']], minDays: 4, maxDays: 4, level: ['intermediate','advanced','enhanced'] },
  hypertrophy_5: { name: 'Гипертрофия 5 дней', desc: 'Грудь+трицепс/Спина+бицепс/Ноги/Плечи+руки/Повтор ног. Макс. объём.', groupsPerDay: [['chest','arms'],['back','arms'],['legs','core'],['shoulders','arms'],['legs','core']], minDays: 5, maxDays: 5, level: ['advanced','enhanced'] },
  torso_limbs_4: { name: 'Торс/Конечности 4 дня', desc: 'Для травм поясницы и коленей. Минимум нагрузки на суставы.', groupsPerDay: [['chest','back','shoulders'],['legs','core'],['chest','shoulders','arms'],['legs','core']], minDays: 4, maxDays: 4, level: ['intermediate'] },
  powerbuilding_4: { name: 'Пауэрбилдинг 4 дня', desc: 'Силовое + гипертрофийное. День 1,3: сила. День 2,4: объём.', groupsPerDay: [['chest','shoulders','arms'],['legs','core'],['back','arms'],['legs','shoulders','core']], minDays: 4, maxDays: 4, level: ['intermediate','advanced'] },
  recovery_3: { name: 'Восстановительный 3x', desc: '50% объёма, RIR 4, безопасные движения. Для делеода и реабилитации.', groupsPerDay: [['chest','back','shoulders'],['legs','core'],['full_body_light']], minDays: 3, maxDays: 3, level: ['beginner'] },
  arnold_6: { name: 'Сплит Арнольда 6x', desc: 'Грудь+Спина / Плечи+Руки / Ноги × 2. Высокочастотный для продвинутых.', groupsPerDay: [['chest','back'],['shoulders','arms'],['legs','core']], minDays: 6, maxDays: 6, level: ['advanced','enhanced'] },
};

// вЧ §5.5: RIR по целям
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
  volumeMultiplier: number,
  weekNumber: number = 1,
  totalWeeks: number = 12
): { sets: number; reps: string; rir: number; dropSet: boolean; dropSetReps: string; backoffSet: boolean; rest: number; progressionNote: string } {
  // Определение текущей фазы
  let phase: MesocyclePhase = 'base';
  if (weekNumber >= totalWeeks - 2) phase = 'peak';
  else if (weekNumber >= totalWeeks - 5) phase = 'build';
  else if (weekNumber % 4 === 0 && weekNumber > 0) phase = 'deload';
  
  // RIR из матрицы
  const goalRir = RIR_MATRIX[goal]?.[level]?.[phase] ?? 2;
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

  const progressionNote = !isDeload ? ` | Нед ${weekNumber}: +2.5-5% весов или +1 сет на группу` : '';

  return { sets, reps, rir, dropSet, dropSetReps: dropSet ? `${Math.max(4, range[0] - 2)}-${range[1]}` : '', backoffSet, rest, progressionNote };
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
  // Unified volume calculation using TRAINING_LEVEL_CONFIGS
  const levelConfig = TRAINING_LEVEL_CONFIGS[i.level] || TRAINING_LEVEL_CONFIGS.intermediate;
  let volume = levelConfig.volumeBase;

  // Volume modifiers based on status
  if (i.recovery < 50) volume *= 0.8;
  if (i.fatigue > 60) volume *= 0.9;
  if (i.nutrition < 60) volume *= 0.85;

  // Goal-based volume modification
  const goalConfig = TRAINING_GOAL_CONFIGS[i.goal] || TRAINING_GOAL_CONFIGS.maintenance;
  volume *= goalConfig.volumeMod;

  const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const volMap: Record<string, number> = {};
  const wpFactor = 1.2;
  const nonWpFactor = Math.max(0.7, 1.0 - (0.1 * i.weakPoints.length));

  groups.forEach(g => { 
    volMap[g] = i.weakPoints.includes(g) ? volume * wpFactor : volume * nonWpFactor; 
  });

  // Use unified TRAINING_SPLITS with groupsPerDay format
  const availableSplits = Object.entries(TRAINING_SPLITS).filter(([, s]) => 
    s.minDays <= i.daysPerWeek && s.maxDays >= i.daysPerWeek && s.level.includes(i.level)
  );

  let selectedKey = availableSplits.length > 0 ? availableSplits[0][0] : 'upper_lower_4';
  if (i.goal === 'rehab') selectedKey = 'recovery_3';
  if (i.goal === 'strength' && i.daysPerWeek >= 4) selectedKey = 'strength_4';

  const selected = TRAINING_SPLITS[selectedKey];
  let splitName = selected.name;
  let splitDesc = selected.desc;

  // Определение фазы
  let phase: MesocyclePhase = 'base';
  let isDeload = false;
  let deloadReason = '';

  if (i.recovery < 55) { isDeload = true; deloadReason = 'Восстановление < 55'; phase = 'deload'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.5; }); }
  else if (i.fatigue > 70) { isDeload = true; deloadReason = 'Усталость > 70'; phase = 'deload'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.6; }); }
  else if (i.nutrition < 55) { isDeload = true; deloadReason = 'Питание < 55'; phase = 'deload'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.7; }); }

  // RIR из матрицы
  const levelConfigRir = levelConfig.rirBase;
  const goalConfigRir = goalConfig.intensityMod > 1.1 ? 2 : goalConfig.intensityMod < 0.9 ? 3 : 2;
  let rir = isDeload ? 4 : RIR_MATRIX[i.goal]?.[i.level]?.[phase] ?? 2;
  if (i.recovery < 50) rir = Math.max(0, rir + 1);
  if (i.fatigue > 70) rir = Math.max(0, rir + 1);

  const roundedVol: Record<string, number> = {};
  Object.entries(volMap).forEach(([k, v]) => { roundedVol[k] = Math.round(v); });

  // Генерация недельного плана
  const weeklyProgression = generateWeeklyPlan(i, 6);
  
  // Формирование плана на неделю
  const weekNum = 1;
  const PHASE_NAMES_RU: Record<string, string> = { base: 'База', build: 'Накопление', peak: 'Пик', deload: 'Разгрузка' };
  const PROGRESSION_NAMES_RU: Record<string, string> = { linear: 'Линейная', double: 'Двойная', undulating: 'Волнообразная', conjugate: 'Конъюгейт' };
  const phaseName = PHASE_NAMES_RU[phase] || phase;
  const progName = PROGRESSION_NAMES_RU[weeklyProgression[0].progressionType] || weeklyProgression[0].progressionType;
  const weekPlan = isDeload
    ? `Неделя ${weekNum} (Разгрузка): 50% объёма, RIR 4, без отказов, акцент на технику и мобильность`
    : `Неделя ${weekNum} (${phaseName}): ${Math.round(weeklyProgression[0].volumeTotal)} общих подходов, RIR ${rir}, прогрессия ${progName}`;

  const progressionNote = !isDeload ? ` | Нед 2-6: +2.5-5% весов или +1 сет на группу` : '';

  splitDesc += ` (${progName})`;

  return {
    splitName,
    splitDesc: splitDesc + progressionNote,
    volumePerGroup: roundedVol,
    rir: rir.toString(),
    isDeload,
    deloadReason,
    weekPlan,
    plan: [], // Will be populated by PlanScreen with exercise-level details
    weeklyVolume: roundedVol['chest'] + roundedVol['back'] + roundedVol['legs'] + roundedVol['shoulders'] + roundedVol['arms'] + roundedVol['core'],
    estimatedProgress: isDeload ? 0 : 2.5
  };
}

export function getAvailableSplits(level: string): Array<{ key: string; name: string; desc: string; minDays: number; maxDays: number }> {
  return Object.entries(TRAINING_SPLITS)
    .filter(([, s]) => s.level.includes(level))
    .map(([key, s]) => ({ key, name: s.name, desc: s.desc, minDays: s.minDays, maxDays: s.maxDays }));
}

export function replaceExercise(originalId: string, replacementId: string): Exercise | null {
  if (!canReplace(originalId, replacementId)) return null;
  return getExerciseById(replacementId) || null;
}
