import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

describe('BB session muscle validator', () => {
  it('reports an upper-body session containing a leg exercise', () => {
    const exercise: any = {
      muscle: 'quads', name: 'Гакк-присед', role: 'primary', character: 'тяж', sets: 2,
      repsRange: [8, 10], rir: 2,
      workSets: [{ reps: 8, rir: 2, weight: 100 }, { reps: 8, rir: 2, weight: 100 }],
    };
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Push', exercises: [exercise] }] }], rotationMuscleVolume: {}, rationale: [] });
    expect(result.issues.some(issue => issue.code === 'session_muscle_leak')).toBe(true);
  });

  it('allows legs in a FullBody session', () => {
    const exercise: any = {
      muscle: 'quads', name: 'Гакк-присед', role: 'primary', character: 'тяж', sets: 2,
      repsRange: [8, 10], rir: 2,
      workSets: [{ reps: 8, rir: 2, weight: 100 }, { reps: 8, rir: 2, weight: 100 }],
    };
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'FullBody', exercises: [exercise] }] }], rotationMuscleVolume: {}, rationale: [] });
    expect(result.issues.some(issue => issue.code === 'session_muscle_leak')).toBe(false);
  });
});
