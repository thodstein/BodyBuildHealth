import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

describe('BB validator volume contract', () => {
  it('warns when effective peak-week volume exceeds MRV', () => {
    const sets = 21;
    const ex: any = {
      muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets,
      repsRange: [6, 8], rir: 2,
      workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 80 })),
    };
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [ex] }] }], rotationMuscleVolume: {}, rationale: [] }, { level: 'intermediate' });
    expect(result.issues.some(issue => issue.code === 'effective_mrv_overflow')).toBe(true);
  });
});
