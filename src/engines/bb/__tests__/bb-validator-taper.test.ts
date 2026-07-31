import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

const makeExercise = (sets: number) => ({
  muscle: 'chest', name: 'Жим лёжа', role: 'primary' as const, character: 'тяж' as const,
  sets, repsRange: [3, 6] as [number, number], rir: 1,
  workSets: Array.from({ length: sets }, () => ({ reps: 5, rir: 1, weight: 100 })),
});

describe('BB taper validator', () => {
  it('warns when peak/taper volume rises', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [
      { week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [makeExercise(2)] }] },
      { week: 2, phase: 'peaking' as any, sessions: [{ day: 1, weekOffset: 2, character: 'тяж', exercises: [makeExercise(4)] }] },
    ], rotationMuscleVolume: {}, rationale: [] });
    expect(result.issues.some(issue => issue.code === 'taper_volume_increased')).toBe(true);
  });
});
