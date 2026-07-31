import { describe, expect, it } from 'vitest';
import { calcBBPlanMetrics } from '../bb-metrics.engine';

describe('BB export metrics parity', () => {
  it('calculates comparison metrics from the exported plan snapshot', () => {
    const plan: any = {
      level: 'intermediate', pattern: { sessionsPerRotation: 1 },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 2,
        repsRange: [6, 8], rir: 2,
        workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
      }] }] }],
    };
    expect(calcBBPlanMetrics(plan).totalSets).toBe(2);
  });
});
