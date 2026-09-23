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
import { LOAD_VELOCITY_PROFILE } from '../vbt.engine';

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

// P1-§3: единый источник LVP — канон vbt.engine.LOAD_VELOCITY_PROFILE;
// здешние 6 опорных точек ВЫВОДЯТСЯ из канона, числа 1-в-1 (интерполяция не сдвинулась).
describe('P1-§3: LVP-паритет с каноном vbt.engine (без смены чисел)', () => {
  it('опорные точки совпадают с каноном ровно', () => {
    for (const [lift, rows] of Object.entries(LOAD_VELOCITY_PROFILE)) {
      if (!SUPPORTED_LIFTS.includes(lift as (typeof SUPPORTED_LIFTS)[number])) continue;
      for (const [pct, vel] of rows) {
        if (![1.00, 0.90, 0.80, 0.70, 0.60, 0.50].includes(pct)) continue;
        expect(velocityForPct(lift, pct), `${lift} @${pct}`).toBeCloseTo(vel, 10);
      }
    }
  });

  it('интерполяция — по 6-точечному подмножеству (0.95 squat = 0.385, а не 0.40 из полного канона)', () => {
    expect(velocityForPct('squat', 0.75)).toBeCloseTo(0.675, 10); // (0.80,0.60)→(0.70,0.75)
    expect(velocityForPct('squat', 0.95)).toBeCloseTo(0.385, 10); // старое поведение (не 0.40)
    expect(estimate1RMFromVelocity('squat', 0.675, 150).e1RM).toBeCloseTo(200, 6);
    expect(estimate1RMFromVelocity('bench', 0.90, 100).pct1RM).toBeCloseTo(0.5, 10);
  });

  it('неизвестный лифт → fallback squat (как было)', () => {
    expect(velocityForPct('ohp', 0.6)).toBeCloseTo(velocityForPct('squat', 0.6), 10);
  });
});
