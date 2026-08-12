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

  it('uses plan.mrvByMuscle actual cap instead of landmarks when provided', () => {
    const sets = 26;
    const ex: any = {
      muscle: 'back', name: 'Тяга штанги', role: 'primary', character: 'тяж', sets,
      repsRange: [6, 8], rir: 2,
      workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 80 })),
    };
    const result = validateBBPlan({
      pattern: {} as any,
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [ex] }] }],
      rotationMuscleVolume: {}, rationale: [],
      // enhanced 6+ лет: фактический кап спины 70 — эффективный 26 не overflow,
      // хотя landmarks.mrv (32) был бы ниже.
      mrvByMuscle: { back: 70 },
    }, { level: 'enhanced' });
    expect(result.issues.some(issue => issue.code === 'effective_mrv_overflow' && issue.message.includes('back'))).toBe(false);
  });

  it('falls back to landmarks.mrv when mrvByMuscle missing', () => {
    const sets = 40;
    const ex: any = {
      muscle: 'back', name: 'Тяга штанги', role: 'primary', character: 'тяж', sets,
      repsRange: [6, 8], rir: 2,
      workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 80 })),
    };
    const result = validateBBPlan({
      pattern: {} as any,
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [ex] }] }],
      rotationMuscleVolume: {}, rationale: [],
    }, { level: 'enhanced' });
    expect(result.issues.some(issue => issue.code === 'effective_mrv_overflow' && issue.message.includes('back'))).toBe(true);
  });
});
