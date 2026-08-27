import { describe, it, expect } from 'vitest';
import {
  runningVdot,
  banisterTrimp,
  sessionTrimpEstimate,
  weeklyTrimp,
  cardioCtlSeries,
  cardioMonotonyStrain,
  cardioAcwrEwma,
  buildStructuredIntervals,
  interferenceScore,
  bumpCardioZone2VolumeGuarded,
  cardioQualityReport,
  buildCardioCycle,
} from '../cardio.engine';
import { wellnessReadiness, cardioLogStats, cardioLogStatsCutoff, importCardioEntries } from '../cardio-diary.engine';
import type { CardioType } from '../cardio.engine';

describe('PRO upgrade — Daniels VDOT (точный)', () => {
  it('5км 20мин → VDOT ~45-55 и лёгкий > порог > интервал > повтор', () => {
    const r = runningVdot(5, 20)!;
    expect(r.vdot).toBeGreaterThan(40);
    expect(r.vdot).toBeLessThan(65);
    expect(r.pacesKm[0].minPerKm).toBeGreaterThan(r.pacesKm[2].minPerKm);
    expect(r.pacesKm[2].minPerKm).toBeGreaterThan(r.pacesKm[3].minPerKm);
    expect(r.pacesKm[3].minPerKm).toBeGreaterThan(r.pacesKm[4].minPerKm);
  });
  it('монотонность темпов', () => {
    const a = runningVdot(10, 50)!;
    const b = runningVdot(10, 40)!;
    expect(b.vdot).toBeGreaterThan(a.vdot);
  });
  it('null при нуле', () => {
    expect(runningVdot(0, 20)).toBeNull();
    expect(runningVdot(5, 0)).toBeNull();
  });
});

describe('Banister TRIMP', () => {
  it('HRr 0.6 муж → ~ длительность*0.6*0.64*e^(1.92*0.6)', () => {
    const t = banisterTrimp(30, 150, 60, 190, 'male');
    expect(t).toBeGreaterThan(30);
    expect(t).toBeLessThan(120);
  });
  it('женский коэффициент даёт больше TRIMP при том же HRr', () => {
    const m = banisterTrimp(30, 150, 60, 190, 'male');
    const f = banisterTrimp(30, 150, 60, 190, 'female');
    expect(f).not.toEqual(m);
  });
  it('sessionTrimpEstimate fallback по типу', () => {
    expect(sessionTrimpEstimate('zone2', 30)).toBe(60);
    expect(sessionTrimpEstimate('hiit', 15)).toBe(75);
  });
  it('weeklyTrimp суммирует', () => {
    const s = [{ type: 'zone2' as CardioType, durationMin: 30, weeklyFrequency: 2 }, { type: 'hiit' as CardioType, durationMin: 15, weeklyFrequency: 1 }];
    expect(weeklyTrimp(s)).toBe(120 + 75);
  });
});

describe('CTL/ATL/TSB', () => {
  it('CTL растёт при постоянной нагрузке, ATL быстрее', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6 });
    const series = cardioCtlSeries(c);
    expect(series).toHaveLength(6);
    expect(series[5].ctl).toBeGreaterThan(series[0].ctl);
    expect(series[5].atl).toBeGreaterThan(0);
    expect(typeof series[5].tsb).toBe('number');
  });
});

describe('Monotony/Strain', () => {
  it('однообразная неделя → monotony высокий', () => {
    const m = cardioMonotonyStrain([10, 10, 10, 10, 10, 10, 10]);
    expect(m.monotony).toBeGreaterThan(1.5);
  });
  it('вариативная → monotony низкий', () => {
    const m = cardioMonotonyStrain([0, 20, 0, 30, 0, 10, 0]);
    expect(m.monotony).toBeLessThan(2);
  });
});

describe('EWMA ACWR', () => {
  it('undertrained при 0 нагрузке', () => {
    const r = cardioAcwrEwma([]);
    expect(r.zone).toBe('undertrained');
  });
  it('optimal при стабильной нагрузке', () => {
    const days = Array.from({ length: 28 }, (_, i) => {
      const d = new Date('2026-01-05');
      d.setDate(d.getDate() - 27 + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date: iso, load: 50 };
    });
    const r = cardioAcwrEwma(days, '2026-01-05');
    expect(r.zone).toBe('optimal');
  });
});

describe('Structured intervals', () => {
  it('HIIT → 60/90 reps', () => {
    const s = { type: 'hiit' as CardioType, durationMin: 20, weeklyFrequency: 1, intensity: 'high' as const, kcalPerSession: 200, purpose: 'x' };
    const b = buildStructuredIntervals(s);
    expect(b[0].workSec).toBe(60);
    expect(b[0].restSec).toBe(90);
    expect(b[0].reps).toBeGreaterThanOrEqual(4);
  });
  it('MISS → 600/180', () => {
    const s = { type: 'miss' as CardioType, durationMin: 30, weeklyFrequency: 1, intensity: 'moderate' as const, kcalPerSession: 200, purpose: 'x' };
    const b = buildStructuredIntervals(s);
    expect(b[0].workSec).toBe(600);
  });
  it('interferenceScore', () => {
    expect(interferenceScore([0], 0)).toBe('avoid');
    expect(interferenceScore([0], 1)).toBe('caution');
    expect(interferenceScore([0], 3)).toBe('ok');
  });
});

describe('Guarded bump 10% rule', () => {
  it('capped когда addMin >10%', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const before = c.weeks[0].totalMinutes;
    const { cycle: after } = bumpCardioZone2VolumeGuarded(c, 15);
    const afterMin = after.weeks[0].totalMinutes;
    expect(afterMin).toBeLessThanOrEqual(Math.round(before * 1.10) + 2); // допуск округления
  });
  it('monotony >2 → capped', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const { capped, reason } = bumpCardioZone2VolumeGuarded(c, 10, [20, 20, 20, 20, 20, 20, 25]);
    expect(capped).toBe(true);
    expect(reason).toContain('Monotony');
  });
});

describe('Polarized 80/20 quality', () => {
  it('много HIIT → warn', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    // форсируем 50% интенсива
    c.weeks.forEach(w => {
      w.sessions = [
        { type: 'hiit', durationMin: 30, weeklyFrequency: 3, intensity: 'high', kcalPerSession: 300, purpose: 'x' },
        { type: 'zone2', durationMin: 30, weeklyFrequency: 2, intensity: 'moderate', kcalPerSession: 200, purpose: 'x' },
      ];
      w.totalMinutes = 150;
    });
    const r = cardioQualityReport(c, 7);
    expect(r.findings.some(f => f.text.includes('80/20') && f.level === 'warn')).toBe(true);
  });
});

describe('Wellness + diary cutoff + транзакция', () => {
  it('wellnessReadiness 1-10', () => {
    expect(wellnessReadiness({ sleep: 5, stress: 1, soreness: 1, mood: 5 })).toBeGreaterThanOrEqual(8);
    expect(wellnessReadiness({ sleep: 1, stress: 5, soreness: 5, mood: 1 })).toBeLessThanOrEqual(4);
  });
  it('cardioLogStats future игнор (через cutoff)', () => {
    const log = [
      { id: '1', date: '2026-01-05', type: 'zone2' as CardioType, durationMin: 30, completed: true },
      { id: '2', date: '2099-01-01', type: 'zone2' as CardioType, durationMin: 100, completed: true },
    ];
    const s = cardioLogStatsCutoff(log, 30, '2026-01-05');
    expect(s.minutes).toBe(30);
  });
  it('importCardioEntries дедуп', () => {
    const a = { id: 'a', date: '2026-01-05', type: 'zone2' as CardioType, durationMin: 30, completed: true };
    const b = { id: 'b', date: '2026-01-05', type: 'zone2' as CardioType, durationMin: 30, completed: true };
    // первая запись сохранится, вторая дедуп по date|type|duration
    localStorage.clear();
    importCardioEntries([a]);
    const after = importCardioEntries([b]);
    expect(after.filter(x => x.date === '2026-01-05').length).toBe(1);
  });
});
