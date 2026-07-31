import { describe, expect, it } from 'vitest';
import { computeBBRecoveryMultiplier } from '../bb-volume.engine';

describe('BB parameter propagation foundation', () => {
  it('uses the same recovery multiplier for every source', () => {
    const good = computeBBRecoveryMultiplier({ bodyFat: 12, leanMass: 90, hrvMs: 80, sleepHours: 8, stressLevel: 2 });
    const poor = computeBBRecoveryMultiplier({ bodyFat: 28, leanMass: 55, hrvMs: 40, sleepHours: 5, stressLevel: 8 });
    expect(good).toBeGreaterThan(1);
    expect(poor).toBeLessThan(1);
    expect(poor).toBeGreaterThanOrEqual(0.6);
    expect(good).toBeLessThanOrEqual(1.5);
  });
});
