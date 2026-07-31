import { describe, expect, it } from 'vitest';
import { calcBBPlanMetrics } from '../bb-metrics.engine';

describe('BB metrics final landmarks parity', () => {
  it('uses final plan landmarks over a recalculated PED fallback', () => {
    const plan: any = {
      level: 'intermediate',
      pattern: { name: 'Test', sessionsPerRotation: 1 },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 10,
        repsRange: [6, 8], rir: 2,
        workSets: Array.from({ length: 10 }, () => ({ reps: 8, rir: 2, weight: 80 })),
      }] }] }],
      volumeLandmarks: [{ group: 'chest', label: 'Грудь', sets: 10, mev: 5, mav: 7, mrv: 9, status: 'exceeding_mrv' }],
    };
    const chest = calcBBPlanMetrics(plan, 1.5).perMuscle.find(item => item.muscle === 'chest');
    expect(chest?.mev).toBe(5);
    expect(chest?.mav).toBe(7);
    expect(chest?.mrv).toBe(9);
    expect(chest?.status).toBe('exceeding_mrv');
  });
});
