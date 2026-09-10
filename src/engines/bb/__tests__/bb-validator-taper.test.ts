import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

const makeExercise = (sets: number) => ({
  muscle: 'chest', name: 'Жим лёжа', role: 'primary' as const, character: 'тяж' as const,
  sets, repsRange: [3, 6] as [number, number], rir: 1,
  workSets: Array.from({ length: sets }, () => ({ reps: 5, rir: 1, weight: 100 })),
});

const week = (n: number, sets: number, phase?: string) => ({
  week: n, ...(phase ? { phase } : {}), sessions: [{ day: 1, weekOffset: n, character: 'тяж', exercises: [makeExercise(sets)] }],
});

describe('BB taper validator', () => {
  it('warns when peak/taper volume rises in a full mesocycle', () => {
    // Полный мезоцикл (>4н) — правило тапера действует (embed ≤4н исключён).
    const weeks = [week(1, 2), week(2, 2), week(3, 2), week(4, 2), week(5, 2), week(6, 4, 'peaking')];
    const result = validateBBPlan({ pattern: {} as any, weeks, rotationMuscleVolume: {}, rationale: [] } as any);
    expect(result.issues.some(issue => issue.code === 'taper_volume_increased')).toBe(true);
  });

  it('embed ≤4 недель: пик-бласт не флагается (Ф1.1)', () => {
    const weeks = [week(1, 2), week(2, 4, 'peaking')];
    const result = validateBBPlan({ pattern: {} as any, weeks, rotationMuscleVolume: {}, rationale: [] } as any);
    expect(result.issues.some(issue => issue.code === 'taper_volume_increased')).toBe(false);
  });
});
