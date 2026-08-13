/**
 * Канонический расчёт объёма ББ-плана.
 *
 * Direct sets отражают прямой target упражнения, effective sets добавляют
 * консервативную долю вторичной работы от compound-движений. Это не замена
 * локальной MRV-модели, а единый слой агрегации для генератора и метрик.
 */
import { trueMuscleOf } from '../movement-pattern';

export type BBVolumeKind = 'direct' | 'effective';

const ALIASES: Record<string, string> = {
  delt_front: 'shoulders',
  delt_mid: 'shoulders',
  delt_rear: 'shoulders',
  delts: 'shoulders',
  arms: 'arms',
  legs: 'legs',
  core: 'abs',
};

export function normalizeBBMuscle(muscle: string | null | undefined): string {
  const value = String(muscle || '').toLowerCase().trim();
  return ALIASES[value] || value;
}

/** Shared recovery soft-cap used by every BB source. */
export function computeBBRecoveryMultiplier(input: {
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
}): number {
  let value = 1;
  if (input.bodyFat != null) value *= input.bodyFat > 25 ? 0.9 : input.bodyFat > 20 ? 0.95 : 1;
  if (input.leanMass != null) value *= input.leanMass >= 90 ? 1.15 : input.leanMass >= 75 ? 1.05 : input.leanMass >= 60 ? 1 : 0.9;
  if (input.hrvMs != null) value *= input.hrvMs > 70 ? 1.1 : input.hrvMs >= 50 ? 1 : 0.85;
  if (input.sleepHours != null) value *= input.sleepHours >= 7 ? 1.05 : input.sleepHours >= 6 ? 1 : 0.85;
  if (input.stressLevel != null) value *= input.stressLevel < 3 ? 1.05 : input.stressLevel < 6 ? 1 : 0.85;
  return Math.max(0.6, Math.min(1.5, value));
}

/** Shared nutrition soft-cap used by every BB source (Helms 2022). */
export function computeBBNutritionMultiplier(input: {
  calorieSurplus?: number;
  proteinPerKg?: number;
}): number {
  let value = 1;
  if (input.calorieSurplus != null) value *= input.calorieSurplus > 300 ? 1.1 : input.calorieSurplus > 100 ? 1.05 : input.calorieSurplus < -200 ? 0.8 : 1.0;
  if (input.proteinPerKg != null) value *= input.proteinPerKg >= 2.0 ? 1.1 : input.proteinPerKg >= 1.6 ? 1.05 : input.proteinPerKg < 1.0 ? 0.85 : 1.0;
  return Math.max(0.6, Math.min(1.5, value));
}

export interface BBVolumeContribution {
  muscle: string;
  directSets: number;
  effectiveSets: number;
  fatigueWeightedSets: number;
  coefficient: number;
  source: 'direct' | 'indirect';
}

export interface BBVolumeTarget {
  muscle: string;
  frequency: number;
  mev: number;
  mav: number;
  mrv: number;
  targetSets: number;
  minSetsPerSession: number;
  maxSetsPerSession: number;
  rationale: string[];
}

/**
 * Строит целевой direct-volume до выбора упражнений.
 * rotationSets передаётся уже в единицах текущей ротации.
 */
export function buildBBVolumeTarget(input: {
  muscle: string;
  frequency: number;
  landmarks: { mev: number; mav: number; mrv: number };
  rotationSets?: number;
  volumeGoal?: 'mev' | 'mav' | 'mrv';
  weakPoint?: boolean;
  focus?: boolean;
  phaseMultiplier?: number;
  recoveryMultiplier?: number;
}): BBVolumeTarget {
  const muscle = normalizeBBMuscle(input.muscle);
  const frequency = Math.max(1, input.frequency || 1);
  const goal = input.volumeGoal || 'mav';
  const base = goal === 'mev' ? input.landmarks.mev : goal === 'mrv' ? input.landmarks.mrv : input.landmarks.mav;
  const emphasis = (input.weakPoint ? 1.2 : 1) * (input.focus ? 1.3 : 1);
  const recovery = Math.max(0.6, Math.min(1.1, input.recoveryMultiplier ?? 1));
  const phase = Math.max(0.4, Math.min(1.1, input.phaseMultiplier ?? 1));
  const targetSets = Math.max(
    input.landmarks.mev,
    Math.min(input.landmarks.mrv * recovery, Math.round((input.rotationSets ?? base) * emphasis * phase)),
  );
  const maxSetsPerSession = Math.max(2, Math.min(8, Math.ceil(input.landmarks.mrv / frequency)));
  const minSetsPerSession = Math.max(2, Math.min(maxSetsPerSession, Math.ceil(input.landmarks.mev / frequency)));
  const rationale: string[] = [`${goal.toUpperCase()} target: ${targetSets} direct sets`];
  if (input.weakPoint) rationale.push('weak-point multiplier ×1.2');
  if (input.focus) rationale.push('focus multiplier ×1.3');
  if (recovery < 1) rationale.push(`recovery cap ×${recovery.toFixed(2)}`);
  if (phase < 1) rationale.push(`phase volume ×${phase.toFixed(2)}`);
  return { muscle, frequency, ...input.landmarks, targetSets, minSetsPerSession, maxSetsPerSession, rationale };
}

export interface BBExerciseVolumeLike {
  name?: string;
  muscle?: string;
  sets?: number;
  workSets?: Array<unknown>;
  role?: 'primary' | 'accessory';
  type?: string;
  exerciseType?: string;
  rir?: number;
  character?: string;
}

function setCount(exercise: BBExerciseVolumeLike): number {
  return Math.max(0, Number(exercise.workSets?.length || exercise.sets || 0));
}

function hasAny(name: string, patterns: RegExp): boolean {
  return patterns.test(name);
}

/** Вторичные мышцы и консервативные коэффициенты для compound-работы. */
export function indirectMuscleContributions(exercise: BBExerciseVolumeLike): Array<{ muscle: string; coefficient: number }> {
  const name = String(exercise.name || '').toLowerCase();
  const type = String(exercise.type || exercise.exerciseType || '').toLowerCase();
  const isIsolation = type === 'isolation' || /разгибан|сгибан|curl|raise|fly|мах|развод|шраг|pushdown|crunch|скручив/i.test(name);
  if (isIsolation) return [];

  if (hasAny(name, /жим|bench|press|dip|отжим.*брус/i)) {
    return [
      // 0.45: трицепс получает ~45% косвенной работы от жимов (EMG-оценки);
      // 0.5 завышал effective — fullbody-сплиты 5x/нед уходили в MRV-overflow.
      { muscle: 'triceps', coefficient: 0.45 },
      { muscle: 'shoulders', coefficient: 0.2 },
    ];
  }
  if (hasAny(name, /подтяг|pull.?up|pulldown|пуллдаун|тяга.*верх/i)) {
    return [
      { muscle: 'biceps', coefficient: 0.4 },
      { muscle: 'shoulders', coefficient: 0.2 },
    ];
  }
  if (hasAny(name, /row|тяга.*наклон|тяга.*гриф|тяга.*гантел|горизонтальн.*тяга/i)) {
    return [
      { muscle: 'biceps', coefficient: 0.4 },
      { muscle: 'shoulders', coefficient: 0.2 },
    ];
  }
  if (hasAny(name, /присед|squat|leg.?press|жим.*ног|выпад|lunge/i)) {
    return [
      { muscle: 'glutes', coefficient: 0.45 },
      { muscle: 'hamstrings', coefficient: 0.25 },
    ];
  }
  if (hasAny(name, /румын|rdl|гудморнинг|good.?morning|гиперэкстенз/i)) {
    return [
      { muscle: 'glutes', coefficient: 0.45 },
      { muscle: 'back', coefficient: 0.25 },
    ];
  }
  return [];
}

export function exerciseVolumeContributions(exercise: BBExerciseVolumeLike): BBVolumeContribution[] {
  // Разминочное упражнение не входит в объём/бюджет.
  if ((exercise as any).warmupActivator) return [];
  const sets = setCount(exercise);
  if (!sets) return [];
  const direct = normalizeBBMuscle(exercise.muscle || trueMuscleOf(exercise as any));
  if (!direct) return [];
  const rir = Math.max(0, Math.min(5, Number(exercise.rir ?? 2)));
  const fatigueWeight = 1 + Math.max(0, 2 - rir) * 0.2;
  const result: BBVolumeContribution[] = [{
    muscle: direct,
    directSets: sets,
    effectiveSets: sets,
    fatigueWeightedSets: sets * fatigueWeight,
    coefficient: 1,
    source: 'direct',
  }];
  for (const secondary of indirectMuscleContributions(exercise)) {
    const muscle = normalizeBBMuscle(secondary.muscle);
    if (!muscle || muscle === direct) continue;
    result.push({
      muscle,
      directSets: 0,
      effectiveSets: sets * secondary.coefficient,
      fatigueWeightedSets: sets * secondary.coefficient * fatigueWeight,
      coefficient: secondary.coefficient,
      source: 'indirect',
    });
  }
  return result;
}

export function aggregateBBVolume(
  sessions: Array<{ exercises: BBExerciseVolumeLike[] }>,
): Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }> {
  const totals: Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }> = {};
  for (const session of sessions) {
    for (const exercise of session.exercises || []) {
      for (const contribution of exerciseVolumeContributions(exercise)) {
        const target = totals[contribution.muscle] || (totals[contribution.muscle] = { directSets: 0, effectiveSets: 0, fatigueWeightedSets: 0 });
        target.directSets += contribution.directSets;
        target.effectiveSets += contribution.effectiveSets;
        target.fatigueWeightedSets += contribution.fatigueWeightedSets;
      }
    }
  }
  return totals;
}
