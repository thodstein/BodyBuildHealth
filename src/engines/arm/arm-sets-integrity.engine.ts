export interface ArmWorkSetLike {
  weight?: number;
  reps?: number;
  rir?: number;
  [key: string]: unknown;
}

export interface ArmExerciseWorkSetsLike {
  sets?: number;
  repsRange?: [number, number];
  workSets?: ArmWorkSetLike[];
  [key: string]: unknown;
}

function normalizedSets(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1;
}

function normalizedReps(exercise: ArmExerciseWorkSetsLike, source: ArmWorkSetLike[]): number {
  const setReps = Number(source[source.length - 1]?.reps);
  if (Number.isFinite(setReps) && setReps > 0) return Math.round(setReps);
  const rangeReps = Number(exercise.repsRange?.[0]);
  return Number.isFinite(rangeReps) && rangeReps > 0 ? Math.round(rangeReps) : 8;
}

export function syncArmExerciseWorkSets<T extends ArmExerciseWorkSetsLike>(exercise: T): T {
  const target = normalizedSets(exercise.sets);
  const source = Array.isArray(exercise.workSets) ? exercise.workSets : [];
  const fallbackReps = normalizedReps(exercise, source);
  const fallbackWeight = Number(source[source.length - 1]?.weight);
  const weight = Number.isFinite(fallbackWeight) ? fallbackWeight : 0;
  const fallbackRir = source[source.length - 1]?.rir;
  exercise.sets = target;
  exercise.workSets = Array.from({ length: target }, (_, index) => {
    const existing = source[index];
    if (existing) return { ...existing };
    return {
      weight,
      reps: fallbackReps,
      ...(Number.isFinite(Number(fallbackRir)) ? { rir: Number(fallbackRir) } : {}),
    };
  });
  return exercise;
}

interface ArmPlanLike {
  weeks?: unknown;
}

function weeksOf(plan: ArmPlanLike): Array<{ week?: number; sessions?: Array<{ exercises?: ArmExerciseWorkSetsLike[] }> }> {
  const weeks = plan?.weeks;
  return Array.isArray(weeks) ? (weeks as Array<{ week?: number; sessions?: Array<{ exercises?: ArmExerciseWorkSetsLike[] }> }>) : [];
}

export function syncArmPlanWorkSets<T extends ArmPlanLike>(plan: T): T {
  for (const week of weeksOf(plan)) {
    for (const session of week.sessions || []) {
      for (const exercise of session.exercises || []) syncArmExerciseWorkSets(exercise);
    }
  }
  return plan;
}

export function armWorkSetsMismatches(plan: ArmPlanLike): string[] {
  const out: string[] = [];
  for (const week of weeksOf(plan)) {
    for (const session of week.sessions || []) {
      for (const exercise of session.exercises || []) {
        if ((exercise.workSets || []).length !== normalizedSets(exercise.sets)) {
          out.push(`Н${week.week ?? '?'} ${exercise.name ?? exercise.muscle ?? 'упражнение'}: sets=${exercise.sets ?? 0}, workSets=${(exercise.workSets || []).length}`);
        }
      }
    }
  }
  return out;
}
