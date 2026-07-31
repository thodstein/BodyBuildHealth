import { describe, expect, it } from 'vitest';
import type { SavedBBPlan } from '../../../ui/screens/TrainingScreen_parts/bb-plans-store';

describe('BB saved variant extended metrics', () => {
  it('keeps extended metrics optional for old variants', () => {
    const metrics: SavedBBPlan['metrics'] = {
      totalSets: 20, avgRir: 2, sessionsPerWeek: 4, phases: [], qualityScore: 80, muscleCount: 8, mrvMult: 1,
    };
    expect(metrics.peakEffectiveSets).toBeUndefined();
  });
});
