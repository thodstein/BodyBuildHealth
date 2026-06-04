import { 
  EXERCISE_DB, 
  canReplace, 
  getSubstitutes, 
  getExerciseById, 
  calcExercisePrescription,
  TRAINING_LEVEL_CONFIGS,
  TRAINING_GOAL_CONFIGS,
  TRAINING_SPLITS 
} from './training.engine';
import { RIR_MATRIX, MesocyclePhase, calculateWeeklyProgression, generateWeeklyPlan, getProgressionRationale } from './rir-matrix.engine';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../core/exercise-catalog';
import type { Exercise, PlannedExercise, TrainingDayPlan, MacrocyclePlan, MesocyclePlan, Microcycle, MacrocycleInput } from '../core/types';

// Типы макроксиков
export type MesocycleType = 'accumulation' | 'intensification' | 'peaking' | 'deload' | 'recovery';

// Прогрессия макроксиков по уровням
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

// Параметры макроксиков с учётом RIR матрицы
export const MESOCYCLE_PARAMS: Record<MesocycleType, { 
  volumeMultiplier: number; 
  rirRange: [number, number]; 
  rpeTarget: number; 
  description: string 
}> = {
  accumulation: { 
    volumeMultiplier: 1.0, 
    rirRange: [2, 4], 
    rpeTarget: 7, 
    description: 'Накопительный объём. Высокий тоннаж, умеренная интенсивность. Форма работы: 3-4 подхода, 8-12 повторений.' 
  },
  intensification: { 
    volumeMultiplier: 0.85, 
    rirRange: [1, 2], 
    rpeTarget: 8.5, 
    description: 'Интенсификация. Объём снижается, интенсивность растёт. Рабочие веса ↑, повторения ↓.' 
  },
  peaking: { 
    volumeMultiplier: 0.7, 
    rirRange: [0, 1], 
    rpeTarget: 9.5, 
    description: 'Пиковый блок. Максимальные веса, минимальный объём. Подход к 1-3 ПМ.' 
  },
  deload: { 
    volumeMultiplier: 0.5, 
    rirRange: [3, 5], 
    rpeTarget: 6, 
    description: 'Разгрузка. 50-60% объёма, RIR 3-5. Восстановление СНС, сверхкомпенсация.' 
  },
  recovery: { 
    volumeMultiplier: 0.4, 
    rirRange: [4, 6], 
    rpeTarget: 5, 
    description: 'Восстановительный блок. Лёгкая активность, полный диапазон. Для реабилитации и делодов.' 
  },
};

/**
 * Генерация макроксика с интеграцией RIR матрицы и weekly progression
 */
export function generateMacrocycle(input: MacrocycleInput): MacrocyclePlan {
  const { goal, level, daysPerWeek, readinessScore, isOnCourse, weakPoints, injuries, currentWeek } = input;
  
  // Используем унифицированные конфиги
  const levelConfig = TRAINING_LEVEL_CONFIGS[level] || TRAINING_LEVEL_CONFIGS.intermediate;
  const goalConfig = TRAINING_GOAL_CONFIGS[goal] || TRAINING_GOAL_CONFIGS.maintenance;

  // Длительность макроксика
  const totalWeeks = level === 'beginner' ? 12 : level === 'intermediate' ? 16 : level === 'advanced' ? 16 : 20;

  // Выбор последовательности макроксиков
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
      // Расчёт фазы для RIR матрицы
      let phase: MesocyclePhase = 'base';
      if (mesoType === 'peaking') phase = 'peak';
      else if (mesoType === 'intensification') phase = 'build';
      else if (mesoType === 'deload') phase = 'deload';
      
      // Проверка на авто-делод
      const isAutoDeload = adjustedReadiness < 40;
      const isDeload = mesoType === 'deload' || isAutoDeload;
      
      const readinessMod = isAutoDeload ? 0.5 : adjustedReadiness < 60 ? 0.8 : adjustedReadiness < 75 ? 0.9 : 1.0;
      const courseMod = isOnCourse ? 1.15 : 1.0;
      
      // RIR из матрицы с учётом фазы
      const weekRir = RIR_MATRIX[goal]?.[level]?.[phase] ?? 2;
      const adjustedVolume = params.volumeMultiplier * goalConfig.volumeMod * readinessMod * courseMod;

      const days = generateWeekDays(
        daysPerWeek, goal, level, adjustedVolume, weekRir, params.rpeTarget,
        goalConfig.repsRange, goalConfig.restSeconds,
        isDeload, weakPoints, injuries, weekOffset + w + 1
      );

      micros.push({
        weekNumber: weekOffset + w + 1,
        mesocycleType: mesoType,
        isDeload,
        days,
        volumeMultiplier: isDeload ? 0.5 : adjustedVolume,
        rirRange: [Math.max(0, weekRir - 1), weekRir + 1],
        rpeTarget: isDeload ? 6 : params.rpeTarget,
        notes: isDeload 
          ? 'Разгрузочная неделя — сниженный объём и интенсивность' 
          : params.description,
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
    currentWeek: currentWeek || 1,
  };
}

/**
 * Генерация плана тренировок на неделю с RIR матрицей
 */
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
  injuries: string[],
  weekNumber: number
): TrainingDayPlan[] {
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const trainingDays = getTrainingDayPattern(daysPerWeek);
  
  // Выбор сплита через TRAINING_SPLITS
  const availableSplits = Object.entries(TRAINING_SPLITS).filter(([, s]) => 
    s.minDays <= daysPerWeek && s.maxDays >= daysPerWeek && s.level.includes(level)
  );
  
  let splitKey = availableSplits.length > 0 ? availableSplits[0][0] : 'upper_lower_4';
  if (goal === 'rehab') splitKey = 'recovery_3';
  if (goal === 'strength' && daysPerWeek >= 4) splitKey = 'strength_4';
  
  const splitData = TRAINING_SPLITS[splitKey];
  if (!splitData) return [];

  return dayNames.map((day, i) => {
    const isTraining = trainingDays[i];
    if (!isTraining) {
      return { 
        day, 
        isTraining: false, 
        split: 'Отдых', 
        exercises: [], 
        duration: 0, 
        intensity: 'low' as const 
      };
    }

    const dayPattern = splitData.groupsPerDay[i % splitData.groupsPerDay.length];
    const exercises: PlannedExercise[] = [];
    const avoidHighJoint = injuries.length > 0;

    for (const group of dayPattern) {
      const groupExercises = getExercisesByGroup(group);

      const isWeak = weakPoints.includes(group);
      const compounds = groupExercises
        .filter(e => 
          e.type === 'compound' && 
          (!avoidHighJoint || e.jointStress !== 'high') && 
          (!isDeload || e.fatigueCost <= 6) && 
          (level === 'beginner' ? e.difficulty !== 'advanced' : true)
        )
        .sort((a, b) => (a.order ?? 2) - (b.order ?? 2))
        .slice(0, isDeload ? 1 : 2);
      
      const isolations = groupExercises
        .filter(e => 
          e.type === 'isolation' && 
          (!avoidHighJoint || e.jointStress !== 'high') && 
          (!isDeload || e.fatigueCost <= 4)
        )
        .sort((a, b) => (a.order ?? 3) - (b.order ?? 3))
        .slice(0, isWeak && !isDeload ? 2 : 1);

      for (const ex of [...compounds, ...isolations]) {
        // Используем calcExercisePrescription с weekNumber для RIR матрицы
        const prescription = calcExercisePrescription(
          ex, 
          goal, 
          level, 
          isWeak, 
          isDeload, 
          volumeMultiplier, 
          weekNumber, 
          12 // totalWeeks
        );
        
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

    const intensity: 'low' | 'medium' | 'high' | 'very_high' = 
      isDeload ? 'low' : rpe >= 9 ? 'very_high' : rpe >= 8 ? 'high' : rpe >= 7 ? 'medium' : 'low';

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

function getGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи',
    arms: 'Руки', core: 'Кор', full_body_light: 'Лёгкое ФТ',
  };
  return labels[group] || group;
}

/**
 * Получить доступные сплиты для уровня
 */
export function getAvailableSplits(level: string): Array<{ key: string; name: string; desc: string; minDays: number; maxDays: number }> {
  return Object.entries(TRAINING_SPLITS)
    .filter(([, s]) => s.level.includes(level))
    .map(([key, s]) => ({ key, name: s.name, desc: s.desc, minDays: s.minDays, maxDays: s.maxDays }));
}

/**
 * Получить план на конкретную неделю
 */
export function getCurrentWeekPlan(macro: MacrocyclePlan, weekNumber: number): Microcycle | null {
  for (const meso of macro.mesocycles) {
    for (const micro of meso.microcycles) {
      if (micro.weekNumber === weekNumber) return micro;
    }
  }
  return null;
}

/**
 * Адаптация недели под уровень готовности
 */
export function adaptWeekForReadiness(micro: Microcycle, readinessScore: number): Microcycle {
  if (readinessScore >= 75) return micro;
  
  if (readinessScore < 40) {
    return {
      ...micro,
      isDeload: true,
      volumeMultiplier: micro.volumeMultiplier * 0.5,
      rirRange: [3, 5],
      rpeTarget: 5,
      notes: '⚠️ Низкое восстановление (<40). Автоделоды: сниженный объём и интенсивность.',
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
      notes: '⚠️ Умеренное восстановление. Объём снижен на 25%.',
      days: micro.days.map(d => ({
        ...d,
        exercises: d.exercises.map(e => ({ ...e, sets: Math.max(2, Math.round(e.sets * 0.8)) })),
      })),
    };
  }
  
  return micro;
}

// Экспорт для совместимости (устаревшие конфиги)
export const LEVEL_CONFIGS = TRAINING_LEVEL_CONFIGS;
export const GOAL_CONFIGS = TRAINING_GOAL_CONFIGS;
export const EXTENDED_SPLITS = TRAINING_SPLITS;
export const EXERCISE_CATALOG = EXERCISE_CATALOG;
