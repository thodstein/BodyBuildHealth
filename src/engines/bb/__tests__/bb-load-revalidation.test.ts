import { describe, expect, it } from 'vitest';
import { syncBBPlanSetShape, validateBBPlan } from '../bb-validator.engine';

describe('BB saved plan load boundary', () => {
  it('normalizes stale set shape and revalidates persisted constraints', () => {
    const plan: any = {
      safetyConstraints: { equipment: ['machine'] },
      pattern: {},
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 2,
        repsRange: [6, 8], rir: 2,
        workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
      }] }] }], rotationMuscleVolume: {}, rationale: [],
    };
    syncBBPlanSetShape(plan);
    expect(plan.weeks[0].sessions[0].exercises[0].workSets).toHaveLength(2);
    expect(validateBBPlan(plan, plan.safetyConstraints).valid).toBe(false);
  });
});
