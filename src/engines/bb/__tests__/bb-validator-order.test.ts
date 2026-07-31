import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

const ex = (name: string, role: 'primary' | 'accessory') => ({
  muscle: 'chest', name, role, character: 'тяж' as const, sets: 2,
  repsRange: [6, 8] as [number, number], rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
});

describe('BB final order validator', () => {
  it('reports accessory before primary in adaptive order mode', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [ex('Разводка', 'accessory'), ex('Жим лёжа', 'primary')] }] }], rotationMuscleVolume: {}, rationale: [] }, { checkOrder: true });
    expect(result.issues.some(issue => issue.code === 'order_primary_after_accessory')).toBe(true);
  });

  it('allows faithful order when order validation is disabled', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [ex('Разводка', 'accessory'), ex('Жим лёжа', 'primary')] }] }], rotationMuscleVolume: {}, rationale: [] }, { checkOrder: false });
    expect(result.issues.some(issue => issue.code === 'order_primary_after_accessory')).toBe(false);
  });
});
