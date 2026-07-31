import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

const exercise = (sets: number, rir: number) => ({
  muscle: 'chest', name: 'Жим лёжа', role: 'primary' as const, character: 'тяж' as const, sets,
  repsRange: [6, 8] as [number, number], rir,
  workSets: Array.from({ length: sets }, () => ({ reps: 8, rir, weight: 80 })),
});

describe('BB phase validator', () => {
  it('warns on an unsafe deload volume/RIR', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [
      { week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise(4, 2)] }] },
      { week: 2, phase: 'deload' as any, sessions: [{ day: 1, weekOffset: 2, character: 'тяж', exercises: [exercise(4, 2)] }] },
    ], rotationMuscleVolume: {}, rationale: [] });
    expect(result.issues.some(issue => issue.code === 'deload_volume_not_reduced')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'deload_rir_too_low')).toBe(true);
  });
});
