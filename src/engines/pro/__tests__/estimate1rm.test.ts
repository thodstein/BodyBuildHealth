import { describe, expect, it } from 'vitest';
import {
  estimate1RMFormula,
  estimate1RMConsensus,
  estimate1RM,
  estimate1RMFromVelocity,
  velocityForPct,
  SUPPORTED_LIFTS,
  type RMFormula,
} from '../estimate1rm.engine';

describe('estimate1RMFormula', () => {
  it('epley: 100×10 → 133.3', () => {
    expect(estimate1RMFormula(100, 10, 'epley')).toBeCloseTo(133.3, 0);
  });
  it('brzycki implementation: 100×10 → 133.3', () => {
    expect(estimate1RMFormula(100, 10, 'brzycki')).toBeCloseTo(133.3, 0);
  });
  it('oconner: 100×10 → 125', () => {
    expect(estimate1RMFormula(100, 10, 'oconner')).toBe(125);
  });
  it('lombardi: 100×10 → 100×10^0.1 ≈ 125.9', () => {
    expect(estimate1RMFormula(100, 10, 'lombardi')).toBeCloseTo(125.9, 0);
  });
  it('returns weight for 1 rep', () => {
    for (const f of ['epley', 'brzycki', 'lander', 'lombardi', 'mayhew', 'oconner', 'wathen'] as RMFormula[]) {
      expect(estimate1RMFormula(120, 1, f)).toBe(120);
    }
  });
  it('returns 0 for 0 weight', () => {
    expect(estimate1RMFormula(0, 10, 'epley')).toBe(0);
  });
});

describe('estimate1RMConsensus', () => {
  it('returns median of applicable formulas', () => {
    const c = estimate1RMConsensus(100, 8);
    expect(c.n).toBeGreaterThanOrEqual(5);
    expect(c.value).toBeGreaterThan(110);
    expect(c.value).toBeLessThan(160);
    expect(c.spread).toBeGreaterThan(0);
  });

  it('1 rep returns weight as single formula', () => {
    const c = estimate1RMConsensus(140, 1);
    expect(c.value).toBe(140);
    expect(c.n).toBe(1);
  });

  it('returns 0 for 0 weight', () => {
    expect(estimate1RMConsensus(0, 10).value).toBe(0);
  });

  it('clamps reps to 15', () => {
    const c = estimate1RMConsensus(100, 30);
    expect(c.repsClamped).toBe(15);
    expect(c.n).toBeGreaterThan(0);
  });
});

describe('estimate1RM (backward-compat)', () => {
  it('returns a number (consensus value)', () => {
    const v = estimate1RM(100, 8);
    expect(typeof v).toBe('number');
    expect(v).toBeGreaterThan(100);
  });
});

describe('velocity-based e1RM', () => {
  it('estimate1RMFromVelocity returns e1RM and pct', () => {
    const r = estimate1RMFromVelocity('squat', 0.60, 140);
    expect(r.e1RM).toBeGreaterThan(140);
    expect(r.pct1RM).toBeGreaterThan(0);
    expect(r.pct1RM).toBeLessThanOrEqual(1);
  });

  it('returns 0 for invalid inputs', () => {
    expect(estimate1RMFromVelocity('squat', 0, 140).e1RM).toBe(0);
    expect(estimate1RMFromVelocity('squat', 0.60, 0).e1RM).toBe(0);
  });

  it('velocityForPct returns reasonable velocities', () => {
    expect(velocityForPct('bench', 1.0)).toBeLessThan(0.2);
    expect(velocityForPct('bench', 0.5)).toBeGreaterThan(0.7);
  });
});

describe('SUPPORTED_LIFTS', () => {
  it('includes squat, bench, deadlift', () => {
    expect(SUPPORTED_LIFTS).toContain('squat');
    expect(SUPPORTED_LIFTS).toContain('bench');
    expect(SUPPORTED_LIFTS).toContain('deadlift');
  });
});
