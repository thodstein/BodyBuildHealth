import { describe, expect, it } from 'vitest';
import { analyzeBBRotation } from '../bb-rotation.engine';

const exercise = (name: string, role: 'primary' | 'accessory') => ({
  muscle: 'chest', name, role, character: 'тяж' as const, sets: 2,
  repsRange: [6, 8] as [number, number], rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
});

describe('BB rotation phase stability', () => {
  it('allows primary rotation only at a phase boundary', () => {
    const report = analyzeBBRotation({ pattern: {} as any, rationale: [], rotationMuscleVolume: {}, weeks: [
      { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [exercise('Жим лёжа', 'primary')] }] },
      { week: 2, phase: 'accumulation', sessions: [{ day: 1, exercises: [exercise('Жим лёжа', 'primary')] }] },
      { week: 3, phase: 'peaking', sessions: [{ day: 1, exercises: [exercise('Жим в Смите лёжа', 'primary')] }] },
    ] } as any);
    expect(report.issues.filter(issue => issue.code === 'primary_changed')).toHaveLength(0);
  });

  it('reports a primary change inside one phase block', () => {
    const report = analyzeBBRotation({ pattern: {} as any, rationale: [], rotationMuscleVolume: {}, weeks: [
      { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [exercise('Жим лёжа', 'primary')] }] },
      { week: 2, phase: 'accumulation', sessions: [{ day: 1, exercises: [exercise('Жим в Смите лёжа', 'primary')] }] },
    ] } as any);
    expect(report.issues.some(issue => issue.code === 'primary_changed')).toBe(true);
  });
});
