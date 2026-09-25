import { describe, expect, it } from 'vitest';
import { armWorkSetsMismatches, syncArmExerciseWorkSets, syncArmPlanWorkSets } from '../arm-sets-integrity.engine';

describe('arm PRO-7 sets/workSets integrity', () => {
  it('resize keeps existing set data and clones the tail', () => {
    const exercise = syncArmExerciseWorkSets({
      name: 'Жим',
      sets: 4,
      repsRange: [8, 10],
      workSets: [
        { weight: 40, reps: 8, rir: 2 },
        { weight: 42, reps: 8, rir: 2 },
      ],
    });
    expect(exercise.workSets).toHaveLength(4);
    expect(exercise.workSets?.[1]).toEqual({ weight: 42, reps: 8, rir: 2 });
    expect(exercise.workSets?.[3]).toEqual({ weight: 42, reps: 8, rir: 2 });
  });

  it('shrinks deterministically', () => {
    const exercise = syncArmExerciseWorkSets({
      name: 'Тяга',
      sets: 2,
      workSets: [
        { weight: 30, reps: 10 },
        { weight: 32, reps: 10 },
        { weight: 34, reps: 10 },
      ],
    });
    expect(exercise.sets).toBe(2);
    expect(exercise.workSets).toEqual([
      { weight: 30, reps: 10 },
      { weight: 32, reps: 10 },
    ]);
  });

  it('creates sets from repsRange when workSets is empty', () => {
    const exercise = syncArmExerciseWorkSets({ name: 'Сгибание', sets: 3, repsRange: [12, 15] });
    expect(exercise.workSets).toEqual([
      { weight: 0, reps: 12 },
      { weight: 0, reps: 12 },
      { weight: 0, reps: 12 },
    ]);
  });

  it('normalizes a whole plan and reports mismatches', () => {
    const plan = {
      weeks: [{
        week: 1,
        sessions: [{ exercises: [{ name: 'A', sets: 3, workSets: [{ weight: 10, reps: 5 }] }] }],
      }],
    };
    expect(armWorkSetsMismatches(plan)).toHaveLength(1);
    syncArmPlanWorkSets(plan);
    expect(armWorkSetsMismatches(plan)).toEqual([]);
    expect(plan.weeks[0].sessions[0].exercises[0].workSets).toHaveLength(3);
  });
});
