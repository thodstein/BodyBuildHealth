import { describe, expect, it } from 'vitest';
import { estimateBBExerciseCost, estimateBBSessionCost } from '../bb-fatigue.engine';

const ex = (name: string, sets = 4, character: 'тяж' | 'памп' = 'тяж') => ({
  muscle: 'chest', name, role: 'primary' as const, character, sets,
  repsRange: [8, 10] as [number, number], rir: 2,
  workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 80 })),
});

describe('BB fatigue model', () => {
  it('charges axial compounds more than isolation', () => {
    expect(estimateBBExerciseCost(ex('Присед со штангой')).axial).toBeGreaterThan(0);
    expect(estimateBBExerciseCost(ex('Разгибание ног', 4, 'памп')).axial).toBe(0);
  });

  it('estimates session time and systemic cost', () => {
    const cost = estimateBBSessionCost({ day: 1, weekOffset: 1, character: 'тяж', exercises: [ex('Жим лёжа'), ex('Разгибание рук', 3, 'памп')] });
    expect(cost.exerciseCount).toBe(2);
    expect(cost.timeSeconds).toBeGreaterThan(0);
    expect(cost.systemic).toBeGreaterThan(0);
  });
});
