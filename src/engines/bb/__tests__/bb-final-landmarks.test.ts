import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB final landmarks parity', () => {
  it('recomputes landmarks after final processing', () => {
    const plan: any = {
      pattern: {},
      weeks: [{ week: 1, phase: 'accumulation', sessions: [{
        day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [{
          muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 3,
          repsRange: [6, 8], rir: 2,
          workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
        }],
      }] }], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, level: 'intermediate' });
    const chest = result.volumeLandmarks?.find(row => row.group === 'chest');
    expect(chest?.sets).toBe(result.weeklyVolume?.[1].chest.directSets);
  });
});
