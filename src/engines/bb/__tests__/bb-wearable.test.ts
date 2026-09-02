import { describe, it, expect } from 'vitest';
import { readWearableDaily, mergeWearableIntoRecovery, wearableRecoveryFactor } from '../bb-wearable.engine';

describe('bb-wearable', () => {
  it('readWearableDaily: нет данных → null', () => {
    try { localStorage.removeItem('he_wearable_daily'); } catch { /* noop */ }
    expect(readWearableDaily()).toBeNull();
  });

  it('readWearableDaily: читает сохранённое', () => {
    try {
      localStorage.setItem('he_wearable_daily', JSON.stringify({ morningHRV: 62, sleepHours: 7 }));
      const w = readWearableDaily();
      expect(w!.morningHRV).toBe(62);
    } finally {
      try { localStorage.removeItem('he_wearable_daily'); } catch { /* noop */ }
    }
  });

  it('mergeWearableIntoRecovery: носимые перекрывают ручные, некорректные игнор', () => {
    const merged = mergeWearableIntoRecovery({ hrvMs: 50, sleepHours: 6 }, { morningHRV: 70, sleepHours: 8 });
    expect(merged.hrvMs).toBe(70);
    expect(merged.sleepHours).toBe(8);
    // некорректное значение не перекрывает
    const m2 = mergeWearableIntoRecovery({ hrvMs: 50 }, { morningHRV: -5 });
    expect(m2.hrvMs).toBe(50);
    expect(mergeWearableIntoRecovery({ hrvMs: 50 }, null).hrvMs).toBe(50);
  });

  it('wearableRecoveryFactor: без данных 1.0, низкий HRV/сон → <1, высокий → >1', () => {
    expect(wearableRecoveryFactor(null)).toBe(1.0);
    expect(wearableRecoveryFactor({ morningHRV: 40 })).toBeLessThan(1.0);
    expect(wearableRecoveryFactor({ sleepHours: 5 })).toBeLessThan(1.0);
    expect(wearableRecoveryFactor({ morningHRV: 80, sleepHours: 8 })).toBeGreaterThan(1.0);
    expect(wearableRecoveryFactor({ morningHRV: 50, sleepHours: 7, restingHR: 70 })).toBeLessThan(1.0);
  });
});
