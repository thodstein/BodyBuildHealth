import { EXERCISE_DB, canReplace, getSubstitutes, getExerciseById, calcExercisePrescription } from './training.engine';
import type { Exercise } from '../core/types';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../core/exercise-catalog';

export type MesocycleType = 'accumulation' | 'intensification' | 'peaking' | 'deload' | 'recovery';

export interface Microcycle {
  weekNumber: number;
  mesocycleType: MesocycleType;
  isDeload: boolean;
  days: TrainingDayPlan[];
  volumeMultiplier: number;
  rirRange: [number, number];
  rpeTarget: number;
  notes: string;
}

export interface TrainingDayPlan {
  day: string;
  isTraining: boolean;
  split: string;
  exercises: PlannedExercise[];
  duration: number;
  intensity: 'low' | 'medium' | 'high' | 'very_high';
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  group: string;
  sets: number;
  reps: string;
  rir: number;
  rpe?: number;
  weight?: number;
  restSeconds: number;
  isCompound: boolean;
  notes?: string;
  targetMuscle?: string;
  technique?: string;
  pauseSeconds?: number;
  peakContraction?: boolean;
  stretchPhase?: boolean;
  dropSet?: boolean;
  dropSetReps?: string;
  backoffSet?: boolean;
  substitutionGroup?: string;
  canReplace?: string[];
  cannotReplace?: string[];
  comments?: string;
}

export interface MacrocyclePlan {
  id: string;
  goal: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
  totalWeeks: number;
  mesocycles: MesocyclePlan[];
  currentWeek: number;
}

export interface MesocyclePlan {
  type: MesocycleType;
  weeks: number;
  weekStart: number;
  microcycles: Microcycle[];
}

export interface MacrocycleInput {
  goal: 'bulk' | 'cut' | 'strength' | 'maintenance' | 'recomp' | 'rehab';
  level: 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
  daysPerWeek: number;
  readinessScore: number;
  isOnCourse: boolean;
  weakPoints: string[];
  injuries: string[];
  experience: 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
  currentWeek?: number;
}

const LEVEL_CONFIGS: Record<string, { volumeBase: number; rirBase: number; deloadFreq: number; progressionPct: number }> = {
  beginner: { volumeBase: 12, rirBase: 3, deloadFreq: 8, progressionPct: 5 },
  intermediate: { volumeBase: 16, rirBase: 2, deloadFreq: 6, progressionPct: 3.75 },
  advanced: { volumeBase: 20, rirBase: 1, deloadFreq: 5, progressionPct: 2.5 },
  enhanced: { volumeBase: 24, rirBase: 1, deloadFreq: 4, progressionPct: 2 },
};

const GOAL_CONFIGS: Record<string, { volumeMod: number; intensityMod: number; repsRange: [number, number]; restSeconds: number }> = {
  bulk: { volumeMod: 1.1, intensityMod: 0.9, repsRange: [8, 12], restSeconds: 90 },
  cut: { volumeMod: 0.85, intensityMod: 1.0, repsRange: [10, 15], restSeconds: 60 },
  strength: { volumeMod: 0.9, intensityMod: 1.15, repsRange: [3, 6], restSeconds: 180 },
  maintenance: { volumeMod: 1.0, intensityMod: 1.0, repsRange: [8, 12], restSeconds: 90 },
  recomp: { volumeMod: 1.0, intensityMod: 1.05, repsRange: [6, 10], restSeconds: 90 },
  rehab: { volumeMod: 0.7, intensityMod: 0.7, repsRange: [12, 20], restSeconds: 60 },
};

const EXTENDED_SPLITS: Record<string, { name: string; desc: string; groupsPerDay: string[][]; minDays: number; maxDays: number; level: string[] }> = {
  fullbody_3: { name: 'Фулбоди 3 дня', desc: '3 дня в неделю, всё тело на каждой тренировке. Идеально для новичков.', groupsPerDay: [['chest','back','legs','shoulders','arms','core']], minDays: 3, maxDays: 3, level: ['beginner'] },
  fullbody_3alt: { name: 'Фулбоди Альтернативная', desc: '3 дня с чередованием акцентов: A — грудь/спина/квадрицепс, B — плечи/руки/задняя поверхность.', groupsPerDay: [['chest','back','legs'],['shoulders','arms','core']], minDays: 3, maxDays: 3, level: ['beginner','intermediate'] },
  upper_lower_4: { name: 'Верх/Эиз 4 дня', desc: 'Чередование верхних и нижних дней. Базовый сплит для среднего уровня.', groupsPerDay: [['chest','back','shoulders','arms'],['legs','core']], minDays: 4, maxDays: 4, level: ['beginner','intermediate'] },
  push_pull_legs_5: { name: 'PPL 5 дней', desc: 'Жим/тяга/Ноги с одним повторным днём. Популярный сплит.', groupsPerDay: [['chest','shoulders','arms'],['back','arms'],['legs','core']], minDays: 5, maxDays: 5, level: ['intermediate','advanced'] },
  push_pull_legs_6: { name: 'PPL 6 дней', desc: 'Жим/тяга/Ноги × 2. Максимальный объём для продвинутых.', groupsPerDay: [['chest','shoulders'],['back','arms'],['legs','core']], minDays: 6, maxDays: 6, level: ['advanced','enhanced'] },
  bro_5: { name: 'Сро-сплит 5 дней', desc: 'Грудь/спина/Ноги/Плечи/ауки. Классический бодибилдинг.', groupsPerDay: [['chest'],['back'],['legs'],['shoulders','arms'],['arms','core']], minDays: 5, maxDays: 5, level: ['intermediate','advanced'] },
  strength_4: { name: 'силовой 4 дня', desc: 'Присед/Жим/тяга/ЮдЯ. Фля пауэрлифтеров.', groupsPerDay: [['legs','core'],['chest','shoulders'],['back','arms'],['legs','shoulders']], minDays: 4, maxDays: 4, level: ['intermediate','advanced','enhanced'] },
  hypertrophy_5: { name: 'Гипертрофия 5 дней', desc: 'Грудь+трицепс/спина+бицепс/Ноги/Плечи+руки/Ноги повтор. Максимум объёма.', groupsPerDay: [['chest','arms'],['back','arms'],['legs','core'],['shoulders','arms'],['legs','core']], minDays: 5, maxDays: 5, level: ['advanced','enhanced'] },
  torso_limbs_4: { name: 'торсо/Конечности 4 дня', desc: 'Верхняя/нижняя части с акцентом на слабые группы.', groupsPerDay: [['chest','back','shoulders'],['legs','core'],['chest','shoulders','arms'],['legs','core']], minDays: 4, maxDays: 4, level: ['intermediate'] },
  powerbuilding_4: { name: 'Пауэрбилдинг 4 дня', desc: 'силовое + гипертрофийное. День 1: силовое присед/жим. День 3: силовая тяга.', groupsPerDay: [['chest','shoulders','arms'],['legs','core'],['back','arms'],['legs','shoulders','core']], minDays: 4, maxDays: 4, level: ['intermediate','advanced'] },
  recovery_3: { name: 'Восстановительный 3 дня', desc: 'Лёгкие нагрузки, полный диапазон, низкий RIR. Фля реабилитации и делодов.', groupsPerDay: [['chest','back','shoulders'],['legs','core'],['full_body_light']], minDays: 3, maxDays: 3, level: ['beginner'] },
  arnold_6: { name: 'Арнольд-сплит 6 дней', desc: 'Грудь+спина / Плечи+руки / Ноги × 2. Фля продвинутых на курсе.', groupsPerDay: [['chest','back'],['shoulders','arms'],['legs','core']], minDays: 6, maxDays: 6, level: ['advanced','enhanced'] },
};

const REST_DAY_NAME = { 0: 'Ян', 1: 'Тт', 2: 'бр', 3: 'зт', 4: 'Ят', 5: 'бб', 6: 'Тс' };

const MESOCYCLE_SEQUENCES: Record<string, MesocycleType[][]> = {
  beginner: [
    ['accumulation', 'accumulation', 'accumulation', 'deload'],
    ['accumulation', 'accumulation', 'intensification', 'deload'],
  ],
  intermediate: [
    ['accumulation', 'intensification', 'intensification', 'deload'],
    ['accumulation', 'intensification', 'peaking', 'deload'],
  ],
  advanced: [
    ['accumulation', 'accumulation', 'intensification', 'intensification', 'peaking', 'deload'],
    ['accumulation', 'intensification', 'peaking', 'deload'],
  ],
  enhanced: [
    ['accumulation', 'accumulation', 'intensification', 'intensification', 'peaking', 'peaking', 'deload'],
    ['accumulation', 'intensification', 'intensification', 'peaking', 'deload'],
  ],
};

export const MESOCYCLE_PARAMS: Record<MesocycleType, { volumeMultiplier: number; rirRange: [number, number]; rpeTarget: number; description: string }> = {
  accumulation: { volumeMultiplier: 1.0, rirRange: [2, 4], rpeTarget: 7, description: 'Накопительный объём. Высокий тоннаж, умеренная интенсивность. форма работы: 3-4 подхода, 8-12 повторений.' },
  intensification: { volumeMultiplier: 0.85, rirRange: [1, 2], rpeTarget: 8.5, description: 'Интенсификация. Объём снижается, интенсивность растёт. рабочие веса тЖС, повторения тЖУ.' },
  peaking: { volumeMultiplier: 0.7, rirRange: [0, 1], rpeTarget: 9.5, description: 'Пиковый блок. Максимальные веса, минимальный объём. Подход к 1-3 ЯЬ.' },
  deload: { volumeMultiplier: 0.5, rirRange: [3, 5], rpeTarget: 6, description: 'разгрузка. 50-60% объёма, RIR 3-5. Восстановление бЭб, сверхкомпенсация.' },
  recovery: { volumeMultiplier: 0.4, rirRange: [4, 6], rpeTarget: 5, description: 'Восстановительный блок. Лёгкая активность, полный диапазон. Фля реабилитации и делодов.' },
};

export function generateMacrocycle(input: MacrocycleInput): MacrocyclePlan {
  const { goal, level, daysPerWeek, readinessScore, isOnCourse, weakPoints, injuries } = input;
  const levelConfig = LEVEL_CONFIGS[level] || LEVEL_CONFIGS.intermediate;
  const goalConfig = GOAL_CONFIGS[goal] || GOAL_CONFIGS.maintenance;

  const totalWeeks = level === 'beginner' ? 12 : level === 'intermediate' ? 16 : level === 'advanced' ? 16 : 20;

  const sequences = MESOCYCLE_SEQUENCES[level] || MESOCYCLE_SEQUENCES.intermediate;
  const sequenceIdx = isOnCourse ? 0 : (goal === 'strength' ? 1 : 0);
  const sequence = sequences[Math.min(sequenceIdx, sequences.length - 1)];

  let adjustedReadiness = readinessScore;
  if (isOnCourse) adjustedReadiness = Math.min(100, readinessScore + 15);

  const mesocycles: MesocyclePlan[] = [];
  let weekOffset = 0;

  for (const mesoType of sequence) {
    const params = MESOCYCLE_PARAMS[mesoType];
    const mesoWeeks = mesoType === 'deload' ? 1 : mesoType === 'peaking' ? 2 : level === 'beginner' ? 3 : 4;
    const micros: Microcycle[] = [];

    for (let w = 0; w < mesoWeeks; w++) {
      const isDeload = mesoType === 'deload' || (w === mesoWeeks - 1 && (mesoType as string) !== 'deload' && mesoWeeks > 3);
      const readinessMod = adjustedReadiness < 40 ? 0.6 : adjustedReadiness < 60 ? 0.8 : adjustedReadiness < 75 ? 0.9 : 1.0;
      const courseMod = isOnCourse ? 1.15 : 1.0;
      const weekRir = params.rirRange[0] + Math.round((params.rirRange[1] - params.rirRange[0]) * (w / Math.max(1, mesoWeeks - 1)));
      const adjustedVolume = params.volumeMultiplier * goalConfig.volumeMod * readinessMod * courseMod;

      const days = generateWeekDays(
        daysPerWeek, goal, level, adjustedVolume, weekRir, params.rpeTarget,
        goalConfig.repsRange, goalConfig.restSeconds,
        isDeload, weakPoints, injuries
      );

      micros.push({
        weekNumber: weekOffset + w + 1,
        mesocycleType: mesoType,
        isDeload,
        days,
        volumeMultiplier: isDeload ? 0.5 : adjustedVolume,
        rirRange: [Math.max(0, weekRir - 1), weekRir + 1],
        rpeTarget: isDeload ? 6 : params.rpeTarget,
        notes: isDeload ? 'разгрузочная неделя — сниженный объём и интенсивность' : params.description,
      });
    }

    mesocycles.push({
      type: mesoType,
      weeks: mesoWeeks,
      weekStart: weekOffset + 1,
      microcycles: micros,
    });

    weekOffset += mesoWeeks;
  }

  return {
    id: `macro_${goal}_${level}_${Date.now()}`,
    goal,
    level,
    totalWeeks,
    mesocycles,
    currentWeek: input.currentWeek || 1,
  };
}

function generateWeekDays(
  daysPerWeek: number,
  goal: string,
  level: string,
  volumeMultiplier: number,
  rir: number,
  rpe: number,
  repsRange: [number, number],
  restSeconds: number,
  isDeload: boolean,
  weakPoints: string[],
  injuries: string[]
): TrainingDayPlan[] {
  const dayNames = ['Ян', 'Тт', 'бр', 'зт', 'Ят', 'бб', 'Тс'];
  const trainingDays = getTrainingDayPattern(daysPerWeek);
  const splitKey = selectSplit(daysPerWeek, level, goal);
  const splitData = EXTENDED_SPLITS[splitKey];
  if (!splitData) return [];

  return dayNames.map((day, i) => {
    const isTraining = trainingDays[i];
    if (!isTraining) {
      return { day, isTraining: false, split: 'Отдых', exercises: [], duration: 0, intensity: 'low' as const };
    }

    const dayPattern = splitData.groupsPerDay[i % splitData.groupsPerDay.length];
    const exercises: PlannedExercise[] = [];
    const avoidHighJoint = injuries.length > 0;

      for (const group of dayPattern) {
        const groupExercises = getExercisesByGroup(group);

        const isWeak = weakPoints.includes(group);
        const compounds = groupExercises
          .filter(e => e.type === 'compound' && (!avoidHighJoint || e.jointStress !== 'high') && (!isDeload || e.fatigueCost <= 6) && (level === 'beginner' ? e.difficulty !== 'advanced' : true))
          .sort((a, b) => (a.order ?? 2) - (b.order ?? 2))
          .slice(0, isDeload ? 1 : 2);
        const isolations = groupExercises
          .filter(e => e.type === 'isolation' && (!avoidHighJoint || e.jointStress !== 'high') && (!isDeload || e.fatigueCost <= 4))
          .sort((a, b) => (a.order ?? 3) - (b.order ?? 3))
          .slice(0, isWeak && !isDeload ? 2 : 1);

        for (const ex of [...compounds, ...isolations]) {
          const prescription = calcExercisePrescription(ex, goal, level, isWeak, isDeload, volumeMultiplier);
          exercises.push({
            exerciseId: ex.id,
            name: ex.name,
            group: ex.group,
            sets: prescription.sets,
            reps: prescription.reps,
            rir: prescription.rir,
            rpe: isDeload ? 6 : rpe,
            restSeconds: (ex.type === 'compound' ? restSeconds : Math.max(45, restSeconds - 30)),
            isCompound: ex.type === 'compound',
            notes: isWeak ? 'Акцент на отстающую группу' : undefined,
            targetMuscle: ex.targetMuscle,
            technique: ex.technique,
            pauseSeconds: ex.pauseSeconds,
            peakContraction: ex.peakContraction,
            stretchPhase: ex.stretchPhase,
            dropSet: prescription.dropSet,
            dropSetReps: prescription.dropSetReps,
            backoffSet: prescription.backoffSet,
            substitutionGroup: ex.substitutionGroup,
            canReplace: ex.canReplace,
            cannotReplace: ex.cannotReplace,
            comments: ex.comments,
          });
        }
      }

    const intensity: 'low' | 'medium' | 'high' | 'very_high' = isDeload ? 'low' : rpe >= 9 ? 'very_high' : rpe >= 8 ? 'high' : rpe >= 7 ? 'medium' : 'low';

    return {
      day,
      isTraining: true,
      split: `${splitData.name} — ${dayPattern.map(g => getGroupLabel(g)).join('+')}`,
      exercises,
      duration: Math.round(exercises.length * 5 + exercises.filter(e => e.isCompound).length * 3),
      intensity,
    };
  });
}

function getTrainingDayPattern(daysPerWeek: number): boolean[] {
  const patterns: Record<number, boolean[]> = {
    3: [true, false, true, false, true, false, false],
    4: [true, true, false, true, true, false, false],
    5: [true, true, false, true, true, false, true],
    6: [true, true, true, false, true, true, true],
  };
  return patterns[daysPerWeek] || patterns[3];
}

function selectSplit(daysPerWeek: number, level: string, goal: string): string {
  if (goal === 'rehab') return 'recovery_3';
  if (goal === 'strength' && daysPerWeek >= 4) return 'strength_4';

  const candidates = Object.entries(EXTENDED_SPLITS)
    .filter(([, s]) => s.minDays <= daysPerWeek && s.maxDays >= daysPerWeek && s.level.includes(level))
    .sort((a, b) => {
      const aScore = a[1].level.indexOf(level);
      const bScore = b[1].level.indexOf(level);
      return aScore - bScore;
    });

  if (candidates.length > 0) return candidates[0][0];

  if (daysPerWeek <= 3) return 'fullbody_3';
  if (daysPerWeek === 4) return 'upper_lower_4';
  if (daysPerWeek === 5) return 'push_pull_legs_5';
  return 'push_pull_legs_6';
}

function getGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    chest: 'Грудь', back: 'спина', legs: 'Ноги', shoulders: 'Плечи',
    arms: 'ауки', core: 'Ъор', full_body_light: 'Лёгкое дв',
  };
  return labels[group] || group;
}

export function getAvailableSplits(level: string): Array<{ key: string; name: string; desc: string; minDays: number; maxDays: number }> {
  return Object.entries(EXTENDED_SPLITS)
    .filter(([, s]) => s.level.includes(level))
    .map(([key, s]) => ({ key, name: s.name, desc: s.desc, minDays: s.minDays, maxDays: s.maxDays }));
}

export function getCurrentWeekPlan(macro: MacrocyclePlan, weekNumber: number): Microcycle | null {
  for (const meso of macro.mesocycles) {
    for (const micro of meso.microcycles) {
      if (micro.weekNumber === weekNumber) return micro;
    }
  }
  return null;
}

export function adaptWeekForReadiness(micro: Microcycle, readinessScore: number): Microcycle {
  if (readinessScore >= 75) return micro;
  if (readinessScore < 40) {
    return {
      ...micro,
      isDeload: true,
      volumeMultiplier: micro.volumeMultiplier * 0.5,
      rirRange: [3, 5],
      rpeTarget: 5,
      notes: 'Тяжёлое низкое восстановление (<40). Делод: : сниженный объём и интенсивность.',
      days: micro.days.map(d => ({
        ...d,
        exercises: d.exercises.map(e => ({ ...e, sets: Math.max(2, Math.round(e.sets * 0.6)), rir: 4, rpe: 5 })),
        intensity: 'low' as const,
      })),
    };
  }
  if (readinessScore < 60) {
    return {
      ...micro,
      volumeMultiplier: micro.volumeMultiplier * 0.75,
      rirRange: [2, micro.rirRange[1]],
      notes: 'Тяжёлое умеренное восстановление. Объём снижен на 25%.',
      days: micro.days.map(d => ({
        ...d,
        exercises: d.exercises.map(e => ({ ...e, sets: Math.max(2, Math.round(e.sets * 0.8)) })),
      })),
    };
  }
  return micro;
}

export const EXTENDED_EXERCISE_DB = EXERCISE_CATALOG;
