import { describe, expect, it } from 'vitest';
import { analyzeBBBalance } from '../bb-balance.engine';

const ex = (name: string, muscle = 'chest') => ({ muscle, name, role: 'primary' as const, character: 'тяж' as const, sets: 2, repsRange: [6, 8] as [number, number], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] });

describe('BB upper push/pull balance', () => {
  it('flags a serious upper-body push imbalance', () => {
    const report = analyzeBBBalance({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, exercises: [ex('Жим лёжа', 'chest'), ex('Жим в Смите', 'shoulders')] }] }], rationale: [], rotationMuscleVolume: {} } as any);
    expect(report.upperPress).toBe(4);
    expect(report.upperPull).toBe(0);
    expect(report.issues.some(issue => issue.includes('Перекос верхней части'))).toBe(true);
  });
});
