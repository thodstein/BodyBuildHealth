import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB final weekly volume contract', () => {
  it('stores actual post-processing volume per week', () => {
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
    expect(result.weeklyVolume?.[1].chest.directSets).toBe(3);
    expect(result.weeklyVolume?.[1].triceps.effectiveSets).toBeGreaterThan(0);
  });
});
