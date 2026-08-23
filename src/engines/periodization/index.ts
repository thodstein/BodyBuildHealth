/**
 * periodization/index.ts — Re-export движка фазовой периодизации.
 * Файлы остаются в UI-слое (phase-periodization.ts), чтобы не нарушать
 * существующие импорты program-types.ts. Этот модуль — единая точка входа
 * для всех движков/UI, которым нужен распределитель фаз.
 */
export {
  PHASES,
  PHASE_CONFIGS,
  PHASE_LABELS,
  getPhaseConfig,
  distributePhases,
  getRirForWeek,
  calcPhaseWeight,
  classifyExercise,
  getPerMuscleMrv,
  getPhaseVolumeMult,
  getDupReps,
  getVolumeWaveFactor,
  getDeloadOverride,
  applyExerciseRotation,
  buildPhasePlan,
  type BBPhase,
  type PhaseDistribution,
  type PhaseConfig,
  type ExerciseRole,
  type ManualWeek,
} from '../../ui/screens/TrainingScreen_parts/phase-periodization';
