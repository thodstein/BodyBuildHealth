import { describe, expect, it } from 'vitest';
import { isCompoundEx } from '../bb-session-order.engine';

const base = (name: string, exerciseName = name) => ({
  muscle: 'chest', name, exerciseName, role: 'accessory' as const, character: 'тяж' as const,
  sets: 2, repsRange: [8, 10] as [number, number], rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 50 }, { reps: 8, rir: 2, weight: 50 }],
});

describe('BB compound classifier', () => {
  it('uses catalog type over name heuristics', () => {
    expect(isCompoundEx(base('Тяга к лицу (face pull)'))).toBe(false);
    expect(isCompoundEx(base('Жим штанги лёжа'))).toBe(true);
    expect(isCompoundEx(base('unknown press', 'missing-id'))).toBe(true);
  });
});
