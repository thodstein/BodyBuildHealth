import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB finalizer safety merge', () => {
  it('reuses persisted restrictions when options are omitted', () => {
    const plan: any = {
      pattern: {},
      safetyConstraints: { equipment: ['machine'], avoidAxialLoad: true },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [{
        muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 2,
        repsRange: [6, 8], rir: 2,
        workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
      }] }] }],
      rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: false, level: 'intermediate' });
    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.issues.some(issue => issue.code === 'equipment_restriction_violation')).toBe(true);
    expect(result.safetyConstraints).toEqual(plan.safetyConstraints);
  });
});
