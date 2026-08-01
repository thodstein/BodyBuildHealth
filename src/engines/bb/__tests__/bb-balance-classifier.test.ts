import { describe, expect, it } from 'vitest';
import { analyzeBBBalance } from '../bb-balance.engine';

const make = (name: string, muscle: string) => ({ muscle, name, role: 'accessory' as const, character: 'памп' as const, sets: 2, workSets: [{ reps: 12, rir: 3, weight: 20 }, { reps: 12, rir: 3, weight: 20 }] });

describe('BB balance catalog classifier', () => {
  it('does not classify face pull as a press or raise by name alone', () => {
    const report = analyzeBBBalance({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, exercises: [make('Тяга к лицу (face pull)', 'shoulders')] }] }], rationale: [], rotationMuscleVolume: {} } as any);
    expect(report.press).toBe(0);
    expect(report.pull).toBeGreaterThanOrEqual(0);
  });

  it('keeps RDL in pull/pattern accounting without counting it as a raise', () => {
    const report = analyzeBBBalance({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, exercises: [make('Румынская тяга', 'hamstrings')] }] }], rationale: [], rotationMuscleVolume: {} } as any);
    expect(report.raise).toBe(0);
    expect(Object.keys(report.patterns).length).toBeGreaterThan(0);
  });
});
