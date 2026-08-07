import { describe, expect, it } from 'vitest';
import { sessionLoad, toDailyLoads, acuteChronicRatio, weeklyMonotony, fitnessFatigue, trainingLoadReport } from '../pro/training-load.engine';

describe('sessionLoad', () => {
  it('computes session load as sRPE × duration', () => {
    expect(sessionLoad(8, 60)).toBe(480);
    expect(sessionLoad(0, 60)).toBe(0);
    expect(sessionLoad(8, 0)).toBe(0);
  });
});

describe('toDailyLoads', () => {
  it('aggregates sessions by date', () => {
    const sessions = [
      { date: '2026-07-15', sRPE: 8, durationMin: 60 },
      { date: '2026-07-15', sRPE: 7, durationMin: 45 },
      { date: '2026-07-16', sRPE: 9, durationMin: 90 },
    ];
    const result = toDailyLoads(sessions);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-07-15');
    expect(result[0].load).toBe(480 + 315);
    expect(result[1].date).toBe('2026-07-16');
    expect(result[1].load).toBe(810);
  });
});

describe('acuteChronicRatio', () => {
  it('returns undertrained for low ACWR', () => {
    const dailyLoads = Array.from({ length: 28 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      load: 50,
    }));
    const result = acuteChronicRatio(dailyLoads, '2026-07-28', 7, 28);
    expect(result.zone).toBe('optimal');
  });

  it('returns dangerous for high ACWR', () => {
    const dailyLoads: { date: string; load: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const date = `2026-07-${String(i + 1).padStart(2, '0')}`;
      dailyLoads.push({ date, load: i >= 21 ? 500 : 100 });
    }
    const result = acuteChronicRatio(dailyLoads, '2026-07-28', 7, 28);
    expect(result.zone).toBe('dangerous');
  });

  it('returns empty for no data', () => {
    const result = acuteChronicRatio([]);
    expect(result.zone).toBe('undertrained');
    expect(result.ratio).toBe(0);
  });
});

describe('weeklyMonotony', () => {
  it('computes monotony from daily loads', () => {
    const dailyLoads = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-07-${String(i + 15).padStart(2, '0')}`,
      load: 300 + i * 50,
    }));
    const result = weeklyMonotony(dailyLoads, '2026-07-21');
    expect(result.monotony).toBeGreaterThan(0);
    expect(result.weeklyLoad).toBeGreaterThan(0);
  });

  it('returns zero for empty input', () => {
    const result = weeklyMonotony([]);
    expect(result.monotony).toBe(0);
    expect(result.weeklyLoad).toBe(0);
  });
});

describe('fitnessFatigue', () => {
  it('computes Banister model', () => {
    const dailyLoads = Array.from({ length: 60 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      load: 200 + Math.sin(i / 7) * 100,
    }));
    const result = fitnessFatigue(dailyLoads);
    expect(result.series.length).toBeGreaterThan(0);
    expect(result.current).not.toBeNull();
  });
});

describe('trainingLoadReport', () => {
  it('generates full report', () => {
    const sessions = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
      sRPE: 6 + (i % 5),
      durationMin: 60,
    }));
    const report = trainingLoadReport(sessions, '2026-07-28');
    expect(report.acwr).toBeDefined();
    expect(report.monotony).toBeDefined();
    expect(report.banister).toBeDefined();
    expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
  });
});
