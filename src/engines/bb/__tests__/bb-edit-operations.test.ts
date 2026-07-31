import { describe, expect, it } from 'vitest';
import { syncBBPlanSetShape, validateBBPlan } from '../bb-validator.engine';

describe('BB manual edit operations', () => {
  it('keeps sets/workSets consistent after volume edits', () => {
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 4,
        repsRange: [6, 8], rir: 2,
        workSets: Array.from({ length: 4 }, () => ({ reps: 8, rir: 2, weight: 80 })),
      }] }] }], rotationMuscleVolume: {}, rationale: [],
    };
    plan.weeks[0].sessions[0].exercises[0].sets = 2;
    syncBBPlanSetShape(plan);
    plan.validation = validateBBPlan(plan);
    expect(plan.weeks[0].sessions[0].exercises[0].workSets).toHaveLength(2);
    expect(plan.validation.valid).toBe(true);
  });
});
