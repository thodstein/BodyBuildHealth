import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

describe('BB execution safety contract', () => {
  it('rejects plans with blocking validation errors', () => {
    const exercise: any = {
      muscle: 'quads', name: 'Присед со штангой', role: 'primary', character: 'тяж', sets: 2,
      repsRange: [6, 8], rir: 2,
      workSets: [{ reps: 8, rir: 2, weight: 100 }, { reps: 8, rir: 2, weight: 100 }],
    };
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise] }] }], rotationMuscleVolume: {}, rationale: [] }, {
      avoidAxialLoad: true,
      excludedMuscles: ['quads'],
    });
    expect(result.valid).toBe(false);
  });
});
