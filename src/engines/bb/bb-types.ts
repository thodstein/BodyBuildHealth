/**
 * bb-types.ts — общие интерфейсы BB-auto.
 *
 * Разрывает циклические зависимости между bb-builder.engine.ts,
 * bb-autocoach.engine.ts, bb-finalize.engine.ts, bb-validator.engine.ts.
 *
 * Только базовые типы данных (BBSet, BBExercise, BBSession, BBWeek, BBPlan).
 * Валидационные типы остаются в bb-validator.engine.ts (единственный источник).
 */
import type { DayCharacter } from './bb-day-types';
import type { SplitPattern } from './bb-split-patterns';
import type { VolumeLandmarkRow } from '../volume-landmarks.engine';
import type { AthleteContext, AthleteMode } from '../athlete-context.engine';

export type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';
export type BBGoal = 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
export type BBVolumeGoal = 'mev' | 'mav' | 'mrv';

export interface BBSet {
  reps: number;
  rir: number;
  weight: number;
  technique?: string;
  tempo?: string;
  restSeconds?: number;
}

export interface BBExercise {
  muscle: string;
  name: string;
  role: 'primary' | 'accessory';
  character: DayCharacter;
  sets: number;
  repsRange: [number, number];
  rir: number;
  workSets: BBSet[];
  exerciseName?: string;
  exerciseType?: string;
  tempoSpec?: string;
  restSeconds?: number;
  comment?: string;
  warmupSets?: { load: number; reps: number }[];
  rationale?: string;
  executionProfile?: import('./bb-exercise-instructions.engine').ExerciseInstructionProfile;
  /** Функциональная подгруппа/паттерн для quality-aware распределения объёма. */
  backSubgroup?: 'back_width' | 'back_thickness' | 'upper_back' | 'rear_delts' | 'traps' | 'erectors';
  /** Подгруппа рук по головкам (длинная/короткая/brachialis, overhead/pushdown). */
  armSubgroup?: string;
  movementPattern?: string;
  /** Разминочное упражнение на целевую группу (3×10-15 лёгких). Не входит в объём/бюджет. */
  warmupActivator?: boolean;
  /** Суперсет-антагонист: имя партнёра по паре (грудь↔спина, бицепс↔трицепс и т.д.). */
  supersetWith?: string;
}

export interface BBSession {
  day: number;
  weekOffset: number;
  character: DayCharacter;
  sessionTag?: string;
  exercises: BBExercise[];
}

export interface BBWeek {
  week: number;
  phase?: BBPhase;
  deload?: boolean;
  taper?: boolean;
  sessions: BBSession[];
}

export interface BBPlan {
  pattern: SplitPattern;
  weeks: BBWeek[];
  rotationMuscleVolume: Record<string, number>;
  rationale: string[];
  level?: string;
  athleteMode?: AthleteMode;
  athleteContext?: AthleteContext;
  volumeLandmarks?: VolumeLandmarkRow[];
  muscleFrequency?: Record<string, number>;
  volumeTargets?: Record<string, any>;
  rotationReport?: any;
  fatigueReport?: Array<{ week: number; sessions: Array<any> }>;
  weeklyVolume?: Record<number, Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }>>;
  report?: any;
  balanceReport?: import('./bb-balance.engine').BBBalanceReport;
  validation?: any;
  safetyConstraints?: {
    equipment?: string[];
    excludedExercises?: string[];
    excludedMuscles?: string[];
    avoidAxialLoad?: boolean;
  };
}

export interface MusclePlan {
  muscle: string;
  resolved: string;
  role: 'primary' | 'accessory';
  sets: number;
  exerciseCount: number;
  rir: number;
  reps: number;
  weight: number;
  pool: any[];
  exDatas: any[];
  selType: string;
  rationaleMap: Map<string, string>;
  phaseEquip?: string[];
}
