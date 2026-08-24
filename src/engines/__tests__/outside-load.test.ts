import { describe, it, expect } from 'vitest';
import { normalizeOutsideLoad, outsideWeeklyLoad, outsideVolumeMultiplier, computeOutsideMetrics, isDayConflictWithOutside, defaultOutsideLoadFor } from '../outside-load.engine';

describe('outside-load', () => {
  it('normalize null -> null', () => expect(normalizeOutsideLoad(null)).toBeNull());
  it('sessions 0 -> null', () => expect(normalizeOutsideLoad({ sessionsPerWeek: 0, avgDurationMin: 90, avgSRPE: 6 })).toBeNull());
  it('clamps values', () => {
    const n = normalizeOutsideLoad({ sessionsPerWeek: 10, avgDurationMin: 500, avgSRPE: 20 } as any);
    expect(n!.sessionsPerWeek).toBe(7);
    expect(n!.avgDurationMin).toBe(240);
    expect(n!.avgSRPE).toBe(10);
  });
  it('weekly load calc', () => {
    expect(outsideWeeklyLoad({ sessionsPerWeek: 4, avgDurationMin: 90, avgSRPE: 7 })).toBe(2520);
  });
  it('volume multiplier high -> ~0.6', () => {
    const m = outsideVolumeMultiplier({ sessionsPerWeek: 5, avgDurationMin: 90, avgSRPE: 7, interference: 'high' });
    expect(m).toBeLessThanOrEqual(0.70);
    expect(m).toBeGreaterThanOrEqual(0.55);
  });
  it('volume multiplier low -> ~0.95', () => {
    const m = outsideVolumeMultiplier({ sessionsPerWeek: 1, avgDurationMin: 60, avgSRPE: 5, interference: 'low' });
    expect(m).toBeGreaterThanOrEqual(0.90);
  });
  it('computeOutsideMetrics', () => {
    const mm = computeOutsideMetrics({ sessionsPerWeek: 4, avgDurationMin: 90, avgSRPE: 7, interference: 'high', highIntensityDays: [1,3] });
    expect(mm!.weeklyLoad).toBe(2520);
    expect(mm!.highDays).toEqual([1,3]);
  });
  it('day conflict: тяж за день до high', () => {
    const load = { sessionsPerWeek: 4, avgDurationMin: 90, avgSRPE: 7, highIntensityDays: [2] };
    expect(isDayConflictWithOutside(1, load)).toBe(true); // day 1 -> tomorrow 2 is high
    expect(isDayConflictWithOutside(2, load)).toBe(false);
  });
  it('default for mma', () => {
    const d = defaultOutsideLoadFor('mma');
    expect(d!.sessionsPerWeek).toBe(5);
    expect(d!.interference).toBe('high');
  });
  it('default for weightlifting low', () => {
    const d = defaultOutsideLoadFor('weightlifting');
    expect(d!.interference).toBe('low');
  });
});
