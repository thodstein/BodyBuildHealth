import { describe, expect, it } from 'vitest';
import {
  calibrateLVP,
  lvrStale,
  dailyReadinessCheck,
  velocityLoss,
  adjustVelocityForMetric,
  pctFromCalibrated,
  e1RMFromCalibrated,
  calibrationQuality,
} from '../vbt.engine';

describe('P2 калибровка LVP', () => {
  it('хорошие точки: r² высокий → ok', () => {
    const cal = calibrateLVP([
      { pct: 0.6, velocity: 0.87 },
      { pct: 0.75, velocity: 0.68 },
      { pct: 0.9, velocity: 0.47 },
    ])!;
    expect(cal.r2).toBeGreaterThan(0.85);
    expect(calibrationQuality(cal.r2)).toBe('ok');
  });
  it('шумные точки: r² низкий → remeasure', () => {
    const cal = calibrateLVP([
      { pct: 0.6, velocity: 1.0 },
      { pct: 0.75, velocity: 0.5 },
      { pct: 0.9, velocity: 0.9 },
    ])!;
    expect(cal.r2).toBeLessThan(0.85);
    expect(calibrationQuality(cal.r2)).toBe('remeasure');
  });
  it('<3 точек → null → none', () => {
    expect(calibrateLVP([{ pct: 0.6, velocity: 0.9 }])).toBeNull();
    expect(calibrationQuality(null)).toBe('none');
  });
  it('stale: >6 нед — перекалибровать', () => {
    const now = Date.now();
    expect(lvrStale(now - 50 * 24 * 3600 * 1000, now)!.stale).toBe(true);
    expect(lvrStale(now - 7 * 24 * 3600 * 1000, now)!.stale).toBe(false);
  });
  it('личный e1RM: точка профиля возвращается в вес', () => {
    const cal = calibrateLVP([
      { pct: 0.6, velocity: 0.87 },
      { pct: 0.75, velocity: 0.68 },
      { pct: 0.9, velocity: 0.47 },
    ])!;
    // скорость точки 75% при 150 кг → e1RM ≈ 200
    expect(e1RMFromCalibrated(cal, 0.68, 150)!).toBeCloseTo(200, -1);
    expect(pctFromCalibrated({ slope: 0, intercept: 0 }, 0.7)).toBeNull();
    expect(e1RMFromCalibrated(null, 0.7, 150)).toBeNull();
  });
});

describe('P2 метрика и readiness', () => {
  it('peak корректируется ×0.9, mcv/mpv — как есть', () => {
    expect(adjustVelocityForMetric(1.0, 'peak')).toBeCloseTo(0.9, 2);
    expect(adjustVelocityForMetric(1.0, 'mcv')).toBe(1.0);
    expect(adjustVelocityForMetric(1.0, 'mpv')).toBe(1.0);
    expect(adjustVelocityForMetric(-1, 'peak')).toBe(0);
  });
  it('readiness-пороги: норма / −20% / делод', () => {
    expect(dailyReadinessCheck(0.6, 0.6).action).toBe('as-planned');
    expect(dailyReadinessCheck(0.6, 0.55).action).toBe('reduce-volume-20');
    expect(dailyReadinessCheck(0.6, 0.5).action).toBe('deload');
  });
});

describe('P2 консервативный remainingReps (кап 3)', () => {
  it('плоский сет — кап 3, а не 99', () => {
    const r = velocityLoss([1.0, 1.0, 1.0], 20)!;
    expect(r.remainingReps).toBeLessThanOrEqual(3);
  });
  it('умеренная потеря — ≤3 и ≥0', () => {
    const r = velocityLoss([1.0, 0.98, 0.97, 0.96], 20)!;
    expect(r.remainingReps).toBeGreaterThanOrEqual(0);
    expect(r.remainingReps).toBeLessThanOrEqual(3);
  });
  it('превышение — null как раньше', () => {
    expect(velocityLoss([0.8, 0.7, 0.6, 0.5], 20)!.remainingReps).toBeNull();
  });
});
