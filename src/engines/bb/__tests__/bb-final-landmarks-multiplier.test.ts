import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB final landmarks multiplier', () => {
  it('preserves the effective MRV multiplier after final recomputation', () => {
    const plan: any = {
      pattern: { name: 'Test', sessionsPerRotation: 1 },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 3,
        repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
      }] }] }], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: false, level: 'intermediate', mrvMultiplier: 1.2 });
    expect(result.volumeLandmarks?.find(row => row.group === 'chest')?.mrv).toBe(24);
  });
});
