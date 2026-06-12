import type { Exercise, TrainingInput, TrainingOutput } from '../core/types';
import { TRAINING_LEVEL_CONFIGS, TRAINING_GOAL_CONFIGS, TRAINING_SPLITS } from './training.engine';
import { PROGRESSION_RULES, selectProgressionRule } from './progression.engine';

/**
 * RIR MATRIX ENGINE
 *goal × level × mesocyclePhase × weekNumber
 */

export type MesocyclePhase = 'base' | 'build' | 'peak' | 'deload';

export const MesoPhaseConfigs: Record<MesocyclePhase, { 
  volumeMod: number; 
  intensityMod: number; 
  rirBase: number; 
  description: string 
}> = {
  base: { 
    volumeMod: 1.0, 
    intensityMod: 0.7, 
    rirBase: 3, 
    description: 'Базовый этап: накопление объёма, низкая интенсивность' 
  },
  build: { 
    volumeMod: 0.9, 
    intensityMod: 0.85, 
    rirBase: 2, 
    description: 'Усиление: баланс объёма и интенсивности' 
  },
  peak: { 
    volumeMod: 0.6, 
    intensityMod: 1.0, 
    rirBase: 1, 
    description: 'Пик: минимум объёма, максимум интенсивности' 
  },
  deload: { 
    volumeMod: 0.5, 
    intensityMod: 0.6, 
    rirBase: 4, 
    description: 'Делоад: 50% объёма, RIR 4, восстановление' 
  }
};

/**
 * RIR MATRIX: goal × level × mesocyclePhase
 * Каждый уровень имеет базовый RIR, который корректируется на фазу и цель
 */
export const RIR_MATRIX: Record<string, Record<string, Record<MesocyclePhase, number>>> = {
  bulk: {
    beginner: { base: 3, build: 2, peak: 1, deload: 4 },
    intermediate: { base: 2, build: 2, peak: 1, deload: 4 },
    advanced: { base: 2, build: 1, peak: 1, deload: 4 },
    enhanced: { base: 1, build: 1, peak: 0, deload: 4 },
  },
  cut: {
    beginner: { base: 3, build: 3, peak: 2, deload: 4 },
    intermediate: { base: 2, build: 2, peak: 1, deload: 4 },
    advanced: { base: 2, build: 1, peak: 1, deload: 4 },
    enhanced: { base: 1, build: 1, peak: 0, deload: 4 },
  },
  strength: {
    beginner: { base: 3, build: 3, peak: 2, deload: 4 },
    intermediate: { base: 2, build: 2, peak: 1, deload: 4 },
    advanced: { base: 2, build: 1, peak: 1, deload: 4 },
    enhanced: { base: 2, build: 1, peak: 0, deload: 4 },
  },
  hypertrophy: {
    beginner: { base: 2, build: 2, peak: 1, deload: 4 },
    intermediate: { base: 2, build: 1, peak: 1, deload: 4 },
    advanced: { base: 1, build: 1, peak: 0, deload: 4 },
    enhanced: { base: 1, build: 0, peak: 0, deload: 4 },
  },
  maintenance: {
    beginner: { base: 3, build: 3, peak: 2, deload: 4 },
    intermediate: { base: 2, build: 2, peak: 2, deload: 4 },
    advanced: { base: 2, build: 1, peak: 1, deload: 4 },
    enhanced: { base: 1, build: 1, peak: 0, deload: 4 },
  },
  recomp: {
    beginner: { base: 3, build: 2, peak: 2, deload: 4 },
    intermediate: { base: 2, build: 2, peak: 1, deload: 4 },
    advanced: { base: 2, build: 1, peak: 1, deload: 4 },
    enhanced: { base: 1, build: 1, peak: 0, deload: 4 },
  },
  rehab: {
    beginner: { base: 4, build: 4, peak: 3, deload: 5 },
    intermediate: { base: 4, build: 3, peak: 3, deload: 5 },
    advanced: { base: 3, build: 3, peak: 2, deload: 5 },
    enhanced: { base: 3, build: 2, peak: 2, deload: 5 },
  }
};

/**
 * Weekly Progression Logic
 * Генерирует план прогрессии на 4-6 недель с учётом:
 * - текущей фазы макроксикла
 * - уровня тренирующегося
 * - цели
 * - текущей недели
 */
export interface WeeklyProgression {
  weekNumber: number;
  phase: MesocyclePhase;
  phaseName: string;
  volumeTotal: number;
  volumePerGroup: Record<string, number>;
  rir: number;
  progressionType: 'linear' | 'double' | 'undulating' | 'conjugate';
  weeklyWeightIncrement: number;
  intensityTechnique?: string;
  deloadWeek: boolean;
  recoveryFocus: boolean;
  notes: string[];
}

export function calculateWeeklyProgression(
  input: TrainingInput,
  weekNumber: number,
  totalWeeks: number = 12
): WeeklyProgression {
  const { goal, level, weakPoints, recovery, fatigue } = input;
  
  // Определение фазы макроксикла
  let phase: MesocyclePhase = 'base';
  let phaseName = MesoPhaseConfigs.base.description;
  
  if (weekNumber >= totalWeeks - 2) {
    phase = 'peak';
    phaseName = MesoPhaseConfigs.peak.description;
  } else if (weekNumber >= totalWeeks - 5) {
    phase = 'build';
    phaseName = MesoPhaseConfigs.build.description;
  } else if (weekNumber % 4 === 0 && weekNumber > 0) {
    phase = 'deload';
    phaseName = MesoPhaseConfigs.deload.description;
  } else {
    phase = 'base';
    phaseName = MesoPhaseConfigs.base.description;
  }

  // Базовый RIR из матрицы
  let rirBase = RIR_MATRIX[goal]?.[level]?.[phase] ?? 2;
  
  // Корректировка на слабые группы (на 1 RIR ниже для акцента)
  const weakPointRir = weakPoints.length > 0 && phase !== 'deload' ? 1 : 0;
  
  // Корректировка на состояние (восстановление/усталость)
  let rirAdjustment = 0;
  if (recovery < 50) rirAdjustment = 1;
  if (fatigue > 70) rirAdjustment = 1;
  if (phase === 'deload') rirAdjustment = 2;
  
  const rir = Math.max(0, rirBase - weakPointRir + rirAdjustment);
  
  // Выбор типа прогрессии по уровню
  const progressionRule = selectProgressionRule(level);
  
  // Расчёт объёма с учётом фазы
  const levelConfig = TRAINING_LEVEL_CONFIGS[level] || TRAINING_LEVEL_CONFIGS.intermediate;
  let volumeBase = levelConfig.volumeBase;
  
  if (phase === 'deload') {
    volumeBase *= MesoPhaseConfigs.deload.volumeMod;
  } else if (phase === 'peak') {
    volumeBase *= MesoPhaseConfigs.peak.volumeMod;
  } else if (phase === 'build') {
    volumeBase *= MesoPhaseConfigs.build.volumeMod;
  }
  
  // Goal-based volume modification
  const goalConfig = TRAINING_GOAL_CONFIGS[goal] || TRAINING_GOAL_CONFIGS.maintenance;
  volumeBase *= goalConfig.volumeMod;
  
  // Восстановительный акцент для низкого восстановления
  const recoveryFocus = recovery < 50 || fatigue > 70;
  const volumeTotal = Math.round(volumeBase * (recoveryFocus ? 0.8 : 1.0));
  
  // Формирование групп с учётом слабых мест
  const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const volumePerGroup: Record<string, number> = {};
  
  const wpFactor = 1.2;
  const nonWpFactor = Math.max(0.7, 1.0 - (0.1 * weakPoints.length));
  const weakCount = groups.filter(g => weakPoints.includes(g)).length;
  const normFactor = weakCount * wpFactor + (groups.length - weakCount) * nonWpFactor;

  groups.forEach(g => { 
    volumePerGroup[g] = weakPoints.includes(g) 
      ? Math.round(volumeTotal * wpFactor / normFactor) 
      : Math.round(volumeTotal * nonWpFactor / normFactor); 
  });

  // Подбор техники интенсивности по фазе
  let intensityTechnique: string | undefined;
  if (phase === 'build' || phase === 'peak') {
    if (level === 'advanced' || level === 'enhanced') {
      intensityTechnique = weekNumber % 2 === 0 ? 'rest_pause' : 'myo_rep';
    } else if (level === 'intermediate') {
      intensityTechnique = 'superset';
    }
  }

  // Формирование заметок
  const notes: string[] = [];
  
  if (phase === 'base') {
    notes.push('Фокус на технике, акклиматизация к объёму');
  } else if (phase === 'build') {
    notes.push('Прогрессия весов, удержание техники');
  } else if (phase === 'peak') {
    notes.push('Максимальная интенсивность, минимум объёма');
    notes.push('Готовимся к тесту силы');
  } else if (phase === 'deload') {
    notes.push('50% объёма, RIR 4, восстановление');
    notes.push('Акцент на мобильность и технику');
  }
  
  if (recoveryFocus) {
    notes.push(`Восстановление ${recovery}% < 50% → снижение объёма на 20%`);
  }
  
  if (weakPoints.length > 0) {
    notes.push(`Акцент на отстающие группы: ${weakPoints.join(', ')}`);
  }

  return {
    weekNumber,
    phase,
    phaseName,
    volumeTotal,
    volumePerGroup,
    rir,
    progressionType: progressionRule.type,
    weeklyWeightIncrement: progressionRule.weeklyWeightIncrement,
    intensityTechnique,
    deloadWeek: phase === 'deload',
    recoveryFocus,
    notes
  };
}

/**
 * RIR Calculator для конкретного подхода
 */
export function calculateRIR(
  goal: string,
  level: string,
  phase: MesocyclePhase,
  weekNumber: number,
  isCompound: boolean,
  isWeakGroup: boolean,
  recovery: number,
  fatigue: number
): { rir: number; rationale: string } {
  let rirBase = RIR_MATRIX[goal]?.[level]?.[phase] ?? 2;
  let rationale = `База: ${rirBase} RIR (${phase} фаза, ${level} уровень, цель: ${goal})`;
  
  // Корректировка на слабую группу
  if (isWeakGroup && phase !== 'deload') {
    rirBase = Math.max(0, rirBase - 1);
    rationale += ` → -1 RIR для акцента на ${isWeakGroup ? 'слабой группе' : ''}`;
  }
  
  // Корректировка на состояние
  if (recovery < 50) {
    rirBase = Math.max(0, rirBase + 1);
    rationale += ` +1 RIR (восстановление ${recovery}%)`;
  }
  
  if (fatigue > 70) {
    rirBase = Math.max(0, rirBase + 1);
    rationale += ` +1 RIR (усталость ${fatigue}%)`;
  }
  
  if (phase === 'deload') {
    rirBase = 4;
    rationale += ` +0 RIR (делоад)`;
  }
  
  // Compound vs Isolation
  if (isCompound && phase !== 'deload') {
    rirBase = Math.max(0, rirBase - 0.5);
    rationale += ` -0.5 RIR (compound упражнение)`;
  }
  
  return {
    rir: Math.max(0, Math.round(rirBase * 2) / 2), // округление до 0.5
    rationale
  };
}

/**
 * Generate 4-6 week plan with weekly progression
 */
export function generateWeeklyPlan(
  input: TrainingInput,
  totalWeeks: number = 6
): WeeklyProgression[] {
  const weeks: WeeklyProgression[] = [];
  
  for (let week = 1; week <= totalWeeks; week++) {
    weeks.push(calculateWeeklyProgression(input, week, totalWeeks));
  }
  
  return weeks;
}

/**
 * Get progression rationale for UI
 */
export function getProgressionRationale(
  goal: string,
  level: string,
  phase: MesocyclePhase,
  weekNumber: number,
  totalWeeks: number
): string {
  const rule = selectProgressionRule(level);
  
  const phaseDesc = MesoPhaseConfigs[phase].description;
  const progressionDesc = rule.description;
  
  const isDeload = phase === 'deload';
  const isPeak = phase === 'peak' && weekNumber >= totalWeeks - 2;
  
  let rationale = `Неделя ${weekNumber} из ${totalWeeks}. ${phaseDesc}. ${progressionDesc}`;
  
  if (isDeload) {
    rationale += ` → Делоад: 50% объёма, RIR 4, восстановление.`;
  } else if (isPeak) {
    rationale += ` → Пик: минимум объёма, максимум интенсивности. Готовимся к тесту.`;
  } else {
    rationale += ` → Прогрессия: +${rule.weeklyWeightIncrement} кг/нед (compound) или +${rule.weeklyVolumeIncrement} сет/нед.`;
  }
  
  return rationale;
}
