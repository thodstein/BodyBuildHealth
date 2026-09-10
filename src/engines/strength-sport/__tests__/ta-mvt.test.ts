import { describe, it, expect } from 'vitest';
import { individualMVT, predict1RMFromProfile, MVT_HEAVY_PCT_MIN } from '../strength-sport-ta-mvt.engine';
import { calibrateLVP } from '../strength-sport-lvp-calibration.engine';

const pts = [
  { pct: 0.5, velocity: 2.7 }, { pct: 0.65, velocity: 2.15 },
  { pct: 0.8, velocity: 1.8 }, { pct: 0.9, velocity: 1.55 },
];

describe('ta-mvt (V4)', () => {
  it('MVT из валидного профиля — скорость на 100%', () => {
    const p = calibrateLVP('snatch', pts)!;
    expect(p.valid).toBe(true);
    const m = individualMVT(p)!;
    expect(m.valid).toBe(true);
    expect(m.hasHeavyPoint).toBe(true);
    // MVT ≈ 1.55 − наклон*0.1 → в коридоре 1.0–1.5
    expect(m.mvt).toBeGreaterThan(1.0);
    expect(m.mvt).toBeLessThan(1.6);
    expect(MVT_HEAVY_PCT_MIN).toBe(0.85);
  });
  it('без тяжёлой точки — invalid с причиной', () => {
    const p = calibrateLVP('snatch', [
      { pct: 0.5, velocity: 2.7 }, { pct: 0.62, velocity: 2.35 }, { pct: 0.74, velocity: 2.0 },
    ])!;
    const m = individualMVT(p)!;
    expect(m.valid).toBe(false);
    expect(m.hasHeavyPoint).toBe(false);
    expect(m.reason).toContain('85');
  });
  it('низкий r² — invalid; пусто — null', () => {
    const noisy = calibrateLVP('snatch', [
      { pct: 0.5, velocity: 2.0 }, { pct: 0.65, velocity: 2.6 },
      { pct: 0.8, velocity: 1.5 }, { pct: 0.9, velocity: 2.2 },
    ]);
    if (noisy) expect(individualMVT(noisy)?.valid ?? false).toBe(false);
    expect(individualMVT(null)).toBeNull();
  });
  it('1RM по скорости: внутри диапазона high, снаружи med, без профиля null', () => {
    const p = calibrateLVP('snatch', pts)!;
    const hi = predict1RMFromProfile(p, 80, 1.8)!;
    expect(hi.confidence).toBe('high');
    expect(hi.e1rmKg).toBeGreaterThan(80);
    expect(hi.note).toContain('MVT');
    const med = predict1RMFromProfile(p, 80, 2.9);
    expect(med?.confidence ?? 'med').toBe('med');
    expect(predict1RMFromProfile(null, 80, 1.8)).toBeNull();
    expect(predict1RMFromProfile(p, 0, 1.8)).toBeNull();
  });
});
