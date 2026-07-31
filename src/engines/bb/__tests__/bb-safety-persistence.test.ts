import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';
import { validateBBPlan } from '../bb-validator.engine';

describe('BB safety constraints persistence', () => {
  it('keeps constraints available for revalidation after edits', () => {
    const plan: any = {
      pattern: {},
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 2,
        repsRange: [6, 8], rir: 2,
        workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
      }] }] }], rotationMuscleVolume: {}, rationale: [],
    };
    const finalized = finalizeBBPlan(plan, { reorder: false, level: 'intermediate', equipment: ['machine'] });
    expect(finalized.safetyConstraints?.equipment).toEqual(['machine']);
    const revalidated = validateBBPlan(finalized, finalized.safetyConstraints);
    expect(revalidated.valid).toBe(false);
    expect(revalidated.issues.some(issue => issue.code === 'equipment_restriction_violation')).toBe(true);
  });
});
