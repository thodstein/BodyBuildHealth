import { describe, expect, it } from 'vitest';
import {
  sessionLoad,
  toDailyLoads,
  ewma,
  acuteChronicRatio,
  weeklyMonotony,
  fitnessFatigue,
  trainingLoadReport,
  type TrainingSession,
} from '../training-load.engine';

function sessions(...loads: [string, number, number][]): TrainingSession[] {
  return loads.map(([date, rpe, dur]) => ({ date, sRPE: rpe, durationMin: dur }));
}

describe('sessionLoad', () => {
  it('multiplies sRPE × duration', () => {
    expect(sessionLoad(7, 60)).toBe(420);
  });
  it('clamps negatives to 0', () => {
    expect(sessionLoad(-1, 60)).toBe(0);
    expect(sessionLoad(7, -10)).toBe(0);
  });
});

describe('toDailyLoads', () => {
  it('aggregates same-day sessions and sorts by date', () => {
    const loads = toDailyLoads(sessions(['2026-07-01', 7, 60], ['2026-07-01', 8, 45], ['2026-06-30', 6, 30]));
    expect(loads).toHaveLength(2);
    expect(loads[0].date).toBe('2026-06-30');
    expect(loads[1].load).toBe(7 * 60 + 8 * 45);
  });
});

describe('ewma', () => {
  it('returns 0 for empty', () => expect(ewma([], 0.3)).toBe(0));
  it('returns first value for single element', () => expect(ewma([500], 0.3)).toBe(500));
  it('weights recent values more', () => {
    const e = ewma([100, 200, 300], 0.5);
    expect(e).toBeGreaterThan(200); // last value dominates
  });
});

describe('acuteChronicRatio', () => {
  it('returns undertrained for empty', () => {
    expect(acuteChronicRatio([]).zone).toBe('undertrained');
  });

  it('computes ratio and zone from daily loads', () => {
    // 7 days of 500 + rest before → acute high, chronic lower → caution/dangerous
    const loads: { date: string; load: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date('2026-07-01');
      d.setDate(d.getDate() - 27 + i);
      loads.push({ date: d.toISOString().slice(0, 10), load: i < 21 ? 300 : 600 });
    }
    const result = acuteChronicRatio(loads, '2026-07-01');
    expect(result.ratio).toBeGreaterThan(1);
    expect(['optimal', 'caution', 'dangerous']).toContain(result.zone);
  });

  it('ratio = 0 when chronic = 0 and acute = 0', () => {
    const loads = [{ date: '2026-07-01', load: 0 }, { date: '2026-07-02', load: 0 }];
    expect(acuteChronicRatio(loads).ratio).toBe(0);
  });
});

describe('weeklyMonotony', () => {
  it('returns 0 for empty', () => {
    expect(weeklyMonotony([]).monotony).toBe(0);
  });

  it('high monotony for constant daily loads', () => {
    const loads: { date: string; load: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date('2026-07-01');
      d.setDate(d.getDate() + i);
      loads.push({ date: d.toISOString().slice(0, 10), load: 500 });
    }
    const m = weeklyMonotony(loads, '2026-07-07');
    expect(m.monotony).toBe(2); // stdev=0 → monotony=2 per code
    expect(m.weeklyLoad).toBe(3500);
  });
});

describe('fitnessFatigue (Banister)', () => {
  it('returns empty for no data', () => {
    const r = fitnessFatigue([]);
    expect(r.series).toHaveLength(0);
    expect(r.current).toBeNull();
  });

  it('fitness rises with consistent training, fatigue lower', () => {
    const loads: { date: string; load: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date('2026-07-01');
      d.setDate(d.getDate() + i);
      loads.push({ date: d.toISOString().slice(0, 10), load: 400 });
    }
    const r = fitnessFatigue(loads);
    expect(r.current).toBeTruthy();
    expect(r.current!.fitness).toBeGreaterThan(0);
    expect(r.current!.fitness).toBeGreaterThan(r.current!.fatigue);
  });
});

describe('trainingLoadReport', () => {
  it('returns a full report with recommendations', () => {
    const s = sessions(
      ['2026-07-01', 7, 60], ['2026-07-03', 8, 75], ['2026-07-05', 6, 60],
      ['2026-07-07', 9, 90], ['2026-07-08', 7, 60], ['2026-07-10', 8, 70],
    );
    const report = trainingLoadReport(s, '2026-07-10');
    expect(report.dailyLoads.length).toBeGreaterThan(0);
    expect(report.acwr.zone).toBeTruthy();
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
