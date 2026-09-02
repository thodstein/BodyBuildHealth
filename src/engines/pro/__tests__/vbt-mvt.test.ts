import { describe, expect, it } from 'vitest';
import { mvtForLift, dailyReadinessCheck, vblLoad, rpeVbtDiscrepancy } from '../vbt.engine';

describe('vbt mvt/readiness', () => {
  it('mvtForLift', () => {
    expect(mvtForLift('squat')).toBeCloseTo(0.25, 1);
    expect(mvtForLift('bench')).toBeCloseTo(0.15, 1);
  });
  it('dailyReadiness', () => {
    expect(dailyReadinessCheck(0.6, 0.55).action).toBe('reduce-volume-20');
    expect(dailyReadinessCheck(0.6, 0.5).action).toBe('deload');
    expect(dailyReadinessCheck(0.6, 0.6).action).toBe('as-planned');
  });
  it('vblLoad', () => {
    expect(vblLoad(0.5, 100, 5)).toBe(250);
  });
  it('rpeVbtDiscrepancy', () => {
    const d = rpeVbtDiscrepancy(9, 0.3, 'squat', 3);
    expect(d.flag).toBeDefined();
  });
});
