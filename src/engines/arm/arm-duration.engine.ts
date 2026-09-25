export type ArmDurationSource = 'estimated' | 'provided';

export interface ArmDurationWorkSetLike {
  reps?: number | 'AMRAP';
  restSeconds?: number;
  tempo?: string;
  holdSeconds?: number;
}

export interface ArmDurationExerciseLike {
  sets?: number;
  repsRange?: [number, number];
  character?: string;
  restSeconds?: number;
  tempoSpec?: string;
  holdSeconds?: number;
  workSets?: ArmDurationWorkSetLike[];
}

export interface ArmDurationSessionLike {
  character?: string;
  durationMin?: number;
  exercises?: ArmDurationExerciseLike[];
}

export interface ArmDurationOptions {
  warmupMinutes?: number;
  exerciseSetupSeconds?: number;
  exerciseTransitionSeconds?: number;
  defaultRepSeconds?: number;
  restSeconds?: Partial<Record<string, number>>;
  includeFinalRest?: boolean;
}

export const ARM_DURATION_DEFAULTS = {
  warmupMinutes: 10,
  exerciseSetupSeconds: 30,
  exerciseTransitionSeconds: 30,
  defaultRepSeconds: 1,
  restSeconds: {
    'тяж': 120,
    'памп': 60,
    'техника': 75,
    'лёг': 45,
  },
  includeFinalRest: false,
} as const;

export interface ArmDurationEstimate {
  durationMin: number;
  totalSeconds: number;
  warmupSeconds: number;
  setupSeconds: number;
  transitionSeconds: number;
  workSeconds: number;
  dynamicSeconds: number;
  holdSeconds: number;
  restSeconds: number;
  exerciseCount: number;
  setCount: number;
  source: ArmDurationSource;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function positive(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function tempoSeconds(value: unknown, fallback: number): number {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const parts = text.split(/[-\s/:]+/).map(Number).filter((part) => Number.isFinite(part) && part >= 0);
  return parts.length > 0 ? parts.reduce((sum, part) => sum + part, 0) : fallback;
}

function repsForSet(set: ArmDurationWorkSetLike | undefined, exercise: ArmDurationExerciseLike, fallbackRepSeconds: number): number {
  const rangeMax = Array.isArray(exercise.repsRange) ? Number(exercise.repsRange[1]) : NaN;
  const value = set?.reps === 'AMRAP' ? rangeMax : Number(set?.reps);
  return Number.isFinite(value) && value > 0 ? value : Number.isFinite(rangeMax) && rangeMax > 0 ? rangeMax : 1;
}

function restForSet(
  set: ArmDurationWorkSetLike | undefined,
  exercise: ArmDurationExerciseLike,
  session: ArmDurationSessionLike,
  options: Required<Pick<ArmDurationOptions, 'restSeconds'>>,
): number {
  const explicit = Number(set?.restSeconds ?? exercise.restSeconds);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const character = String(exercise.character || session.character || '').trim();
  return options.restSeconds[character] ?? options.restSeconds['техника'] ?? 60;
}

export function estimateArmSessionDuration(
  session: ArmDurationSessionLike | null | undefined,
  options: ArmDurationOptions = {},
): ArmDurationEstimate {
  const defaults = ARM_DURATION_DEFAULTS;
  const warmupSeconds = positive(options.warmupMinutes ?? defaults.warmupMinutes, defaults.warmupMinutes) * 60;
  const setupSeconds = positive(options.exerciseSetupSeconds ?? defaults.exerciseSetupSeconds, defaults.exerciseSetupSeconds);
  const transitionSeconds = positive(options.exerciseTransitionSeconds ?? defaults.exerciseTransitionSeconds, defaults.exerciseTransitionSeconds);
  const defaultRepSeconds = positive(options.defaultRepSeconds ?? defaults.defaultRepSeconds, defaults.defaultRepSeconds);
  const restOptions = { ...defaults.restSeconds, ...(options.restSeconds || {}) };
  const exercises = Array.isArray(session?.exercises) ? session!.exercises! : [];
  let dynamicSeconds = 0;
  let holdSeconds = 0;
  let restSeconds = 0;
  let setCount = 0;
  let exerciseCount = 0;
  for (const exercise of exercises) {
    if (!exercise) continue;
    exerciseCount += 1;
    const workSets = Array.isArray(exercise.workSets) ? exercise.workSets : [];
    const setCountForExercise = Number(exercise.sets);
    const count = Number.isFinite(setCountForExercise) && setCountForExercise > 0
      ? setCountForExercise
      : workSets.length;
    for (let index = 0; index < count; index += 1) {
      const set = workSets[index];
      const reps = repsForSet(set, exercise, defaultRepSeconds);
      const repSeconds = tempoSeconds(set?.tempo ?? exercise.tempoSpec, defaultRepSeconds);
      const hold = positive(set?.holdSeconds ?? exercise.holdSeconds, 0);
      dynamicSeconds += reps * repSeconds;
      holdSeconds += hold;
      const isLastSet = setCount + 1 === exercises.reduce((total, item) => {
        if (!item) return total;
        const direct = Number(item.sets);
        return total + (Number.isFinite(direct) && direct > 0 ? direct : Array.isArray(item.workSets) ? item.workSets.length : 0);
      }, 0);
      if (options.includeFinalRest || !isLastSet) {
        restSeconds += restForSet(set, exercise, session || {}, { restSeconds: restOptions });
      }
      setCount += 1;
    }
  }
  const workSeconds = dynamicSeconds + holdSeconds;
  const totalSeconds = warmupSeconds + setupSeconds * exerciseCount + transitionSeconds * Math.max(0, exerciseCount - 1) + workSeconds + restSeconds;
  return {
    durationMin: round2(totalSeconds / 60),
    totalSeconds: Math.round(totalSeconds),
    warmupSeconds: Math.round(warmupSeconds),
    setupSeconds: Math.round(setupSeconds * exerciseCount),
    transitionSeconds: Math.round(transitionSeconds * Math.max(0, exerciseCount - 1)),
    workSeconds: Math.round(workSeconds),
    dynamicSeconds: Math.round(dynamicSeconds),
    holdSeconds: Math.round(holdSeconds),
    restSeconds: Math.round(restSeconds),
    exerciseCount,
    setCount,
    source: 'estimated',
  };
}

export function resolveArmSessionDuration(
  session: ArmDurationSessionLike | null | undefined,
  options: ArmDurationOptions = {},
): ArmDurationEstimate {
  const estimate = estimateArmSessionDuration(session, options);
  const provided = Number(session?.durationMin);
  if (!Number.isFinite(provided) || provided <= 0) return estimate;
  return { ...estimate, durationMin: round2(provided), totalSeconds: Math.round(provided * 60), source: 'provided' };
}

export function estimateArmPlanDuration(
  weeks: Array<{ sessions?: ArmDurationSessionLike[] }> | null | undefined,
  options: ArmDurationOptions = {},
): { durationMin: number; byWeek: Record<number, number>; bySession: number[] } {
  const byWeek: Record<number, number> = {};
  const bySession: number[] = [];
  let total = 0;
  for (const [weekIndex, week] of (weeks || []).entries()) {
    let weekTotal = 0;
    for (const session of week?.sessions || []) {
      const estimate = resolveArmSessionDuration(session, options);
      bySession.push(estimate.durationMin);
      weekTotal += estimate.durationMin;
      total += estimate.durationMin;
    }
    byWeek[weekIndex + 1] = round2(weekTotal);
  }
  return { durationMin: round2(total), byWeek, bySession };
}

export const estimateArmDuration = estimateArmSessionDuration;
