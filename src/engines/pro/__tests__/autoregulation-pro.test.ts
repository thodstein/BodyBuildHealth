import { describe, expect, it } from 'vitest';
import {
  pctForRPE,
  loadForRPE,
  rpeFromLoad,
  autoRegulate,
  adjustedLoad,
  adjustedWorkingWeight,
  sessionAutoRegulate,
  shouldTrainToday,
  type AutoRegInput,
} from '../autoregulation-pro.engine';

function baseInput(overrides: Partial<AutoRegInput> = {}): AutoRegInput {
  return { readiness: 80, acwr: { ratio: 1.0, zone: 'optimal' }, ...overrides };
}

describe('RPE ↔ load conversions', () => {
  it('pctForRPE returns sane percentages', () => {
    expect(pctForRPE(10, 1)).toBe(1); // RPE10, 1 rep = 100%
    expect(pctForRPE(7, 5)).toBeCloseTo(0.789, 2); // RPE7, 5 reps -> 8 reps to failure
    expect(pctForRPE(5, 10)).toBeGreaterThan(0.6);
    expect(pctForRPE(5, 10)).toBeLessThan(0.75);
  });

  it('loadForRPE × rpeFromLoad round-trip (approximate)', () => {
    const e1RM = 140;
    const w = loadForRPE(e1RM, 7, 5);
    expect(w).toBeGreaterThan(100);
    expect(w).toBeLessThan(140);
    const backRPE = rpeFromLoad(e1RM, w, 5);
    expect(Math.abs(backRPE - 7)).toBeLessThanOrEqual(1);
  });

  it('rpeFromLoad returns 5 for invalid inputs', () => {
    expect(rpeFromLoad(0, 100, 5)).toBe(5);
    expect(rpeFromLoad(140, 0, 5)).toBe(5);
  });
});

describe('autoRegulate - signal stacking', () => {
  it('optimal readiness + optimal ACWR → no adjustments', () => {
    const out = autoRegulate(baseInput());
    expect(out.topSetPctMultiplier).toBe(1.03);
    expect(out.volumeMultiplier).toBe(1);
    expect(out.rirShift).toBe(0);
    expect(out.deload).toBe(false);
  });

  it('отсутствие sleepScore не считается плохим сном', () => {
    const withoutSleep = autoRegulate(baseInput());
    const withNormalSleep = autoRegulate(baseInput({ sleepScore: 80 }));
    expect(withoutSleep.volumeMultiplier).toBe(withNormalSleep.volumeMultiplier);
    expect(withoutSleep.rirShift).toBe(withNormalSleep.rirShift);
  });

  it('dangerous ACWR triggers deload', () => {
    const out = autoRegulate(baseInput({ acwr: { ratio: 1.6, zone: 'dangerous' } }));
    expect(out.deload).toBe(true);
    expect(out.volumeMultiplier).toBeLessThan(1);
  });

  it('low readiness reduces intensity and volume', () => {
    const out = autoRegulate(baseInput({ readiness: 30 }));
    expect(out.topSetPctMultiplier).toBeLessThan(1);
    expect(out.volumeMultiplier).toBeLessThan(1);
    expect(out.rirShift).toBeGreaterThan(0);
  });

  it('high HRV boosts volume', () => {
    const out = autoRegulate(baseInput({ hrvRatio: 1.2 }));
    expect(out.volumeMultiplier).toBeGreaterThanOrEqual(1);
    expect(out.topSetPctMultiplier).toBeGreaterThanOrEqual(1);
  });

  it('RIR shift is capped at 4 (intensity + load categories)', () => {
    // worst case: readiness 30 + dangerous + fatigue 80 + RPE 9.5
    const out = autoRegulate(baseInput({
      readiness: 30, acwr: { ratio: 1.6, zone: 'dangerous' },
      fatigue: 80, lastSessionRPE: 9.5, hrvRatio: 0.7,
    }));
    expect(out.rirShift).toBeLessThanOrEqual(4);
  });

  it('volume multiplier is clamped 0.4-1.25', () => {
    const out = autoRegulate(baseInput({
      readiness: 25, acwr: { ratio: 1.8, zone: 'dangerous' },
      fatigue: 90, lastSessionRPE: 10, hrvRatio: 0.6,
    }));
    expect(out.volumeMultiplier).toBeGreaterThanOrEqual(0.4);
    expect(out.volumeMultiplier).toBeLessThanOrEqual(1.25);
  });
});

describe('sessionAutoRegulate', () => {
  it('adjusts weights and sets for each exercise', () => {
    const result = sessionAutoRegulate([
      { name: 'Squat', e1RM: 200, plannedWeight: 160, plannedReps: 5, plannedSets: 4, plannedRIR: 2, isCompound: true },
    ], baseInput({ readiness: 30 }));
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].adjustedWeight).toBeLessThan(160);
    expect(result.exercises[0].adjustedSets).toBeGreaterThanOrEqual(1);
    expect(result.exercises[0].adjustedRIR).toBeGreaterThan(2);
  });
});

describe('shouldTrainToday', () => {
  it('blocks training when readiness < 25', () => {
    expect(shouldTrainToday(baseInput({ readiness: 20 })).train).toBe(false);
  });
  it('blocks when readiness < 35 + HRV < 0.7', () => {
    expect(shouldTrainToday(baseInput({ readiness: 30, hrvRatio: 0.65 })).train).toBe(false);
  });
  it('blocks when ACWR dangerous', () => {
    expect(shouldTrainToday(baseInput({ acwr: { ratio: 1.6, zone: 'dangerous' } })).train).toBe(false);
  });
  it('allows when readiness >= 45', () => {
    expect(shouldTrainToday(baseInput({ readiness: 50 })).train).toBe(true);
  });
  it('blocks when combined RIR shift is at least 3', () => {
    const result = shouldTrainToday(baseInput({ readiness: 80, combinedRirShift: 3 }));
    expect(result.train).toBe(false);
    expect(result.reason).toContain('RIR');
  });
});
