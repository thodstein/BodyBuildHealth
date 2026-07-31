import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

const exercise = (sets: number, workSets = sets) => ({
  muscle: 'chest', name: 'Жим лёжа', role: 'primary' as const, character: 'тяж' as const,
  sets, repsRange: [6, 8] as [number, number], rir: 2,
  workSets: Array.from({ length: workSets }, () => ({ reps: 8, rir: 2, weight: 80 })),
});

describe('BB final validator', () => {
  it('accepts a structurally valid exercise', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise(3)] }] }], rotationMuscleVolume: {}, rationale: [] });
    expect(result.valid).toBe(true);
  });

  it('reports sets/workSets mismatch', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise(3, 2)] }] }], rotationMuscleVolume: {}, rationale: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'sets_mismatch')).toBe(true);
  });
});
