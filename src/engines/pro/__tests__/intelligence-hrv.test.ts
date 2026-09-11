import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadHrvReadings,
  appendHrvReading,
  buildHrvBaseline,
  hrvReadiness,
  hrvRatioToBaseline,
  HRV_PROTOCOL_NOTE,
} from '../hrv-baseline.engine';
import { analyzeRecovery } from '../../recovery-optimization.engine';

beforeEach(() => { try { localStorage.removeItem('he_hrv_log'); } catch { /* noop */ } });

function seed(vals: number[]) {
  vals.forEach((v, i) => appendHrvReading(v, `2026-07-${String(i + 1).padStart(2, '0')}`));
}

describe('P2 HRV-база', () => {
  it('толерантный парсинг: объекты SS-формата и legacy-числа', () => {
    localStorage.setItem('he_hrv_log', JSON.stringify([{ date: '2026-07-01', hrvMs: 55 }, 60, { date: '2026-07-03', rmssd: 58 }, 'мусор', -5]));
    const r = loadHrvReadings();
    expect(r.map(x => x.rmssd)).toEqual([55, 60, 58]);
  });

  it('без базы (<3) — null, красную зону не ставим', () => {
    seed([55, 58]);
    expect(buildHrvBaseline()).toBeNull();
    const st = hrvReadiness(30, null);
    expect(st.status).toBe('need_base');
  });

  it('абсолютный 42 мс: норма при базе 40, 45 мс при базе 70 — красная', () => {
    seed([39, 40, 41, 40, 39, 41, 40]);
    const low = buildHrvBaseline()!;
    expect(hrvReadiness(42, low).status).toBe('normal'); // +5% — внутри коридора
    localStorage.removeItem('he_hrv_log');
    seed([69, 70, 71, 70, 69, 71, 70]);
    const high = buildHrvBaseline()!;
    expect(hrvReadiness(45, high).status).toBe('low'); // −36% от личной базы — красная, хотя «норма» по абсолютной шкале
  });

  it('математика базы: meanLn/SWC-пол/CV', () => {
    seed([50, 50, 50, 50]);
    const b = buildHrvBaseline()!;
    expect(b.n).toBe(4);
    expect(b.meanRmssd).toBe(50);
    expect(b.meanLn).toBeCloseTo(Math.log(50), 3);
    expect(b.swc).toBe(0.03); // пол при нулевом разбросе
    expect(b.cvPct).toBe(0);
  });

  it('append пишет SS-формат и не плодит дубли дня', () => {
    appendHrvReading(55, '2026-07-01');
    appendHrvReading(57, '2026-07-01');
    const raw = JSON.parse(localStorage.getItem('he_hrv_log') || '[]');
    expect(raw).toHaveLength(1);
    expect(raw[0]).toEqual({ date: '2026-07-01', hrvMs: 57 });
    expect(loadHrvReadings()[0].rmssd).toBe(57);
  });

  it('мусор (0/отрицательные/>300) не пишется', () => {
    appendHrvReading(0, '2026-07-01');
    appendHrvReading(-10, '2026-07-02');
    appendHrvReading(400, '2026-07-03');
    expect(loadHrvReadings()).toHaveLength(0);
  });

  it('ratio: к базе при наличии, честный фолбэк без', () => {
    seed([60, 60, 60, 60]);
    const b = buildHrvBaseline()!;
    expect(hrvRatioToBaseline(54, b)).toEqual({ ratio: 0.9, hasBase: true });
    expect(hrvRatioToBaseline(54, null)).toEqual({ ratio: 0.9, hasBase: false });
  });

  it('протокол замера документирован', () => {
    expect(HRV_PROTOCOL_NOTE).toContain('1 мин');
  });
});

describe('D1 персональная база в analyzeRecovery', () => {
  const base = {
    sleep: { hours: 7.5, quality: 4, bedtime: '23:00', wakeTime: '07:00', latencyMin: 10, awakenings: 1 },
    fatigueScore: 0.3, trainingDaysThisWeek: 4, currentWeek: 4,
    periodizationPhase: 'accumulation' as const, recentPR: false, injuryHistory: [],
  };

  it('без базы — поведение как раньше (абсолютный RMSSD 30 = низкий скор)', () => {
    const out = analyzeRecovery({ ...base, hrv: { rmssd: 30, sdnn: 40, restingHR: 62, readinessScore: 70 } });
    expect(out.hrvScore).toBeLessThan(60);
  });

  it('личная норма перебивает абсолютную: база 30, замер 30 — скор не ниже 60', () => {
    const out = analyzeRecovery({
      ...base,
      hrv: { rmssd: 30, sdnn: 40, restingHR: 62, readinessScore: 70 },
      hrvBaseline: { status: 'normal', n: 7 },
    });
    expect(out.hrvScore).toBeGreaterThanOrEqual(60);
  });

  it('личная красная капает скор: замер вдвое ниже базы', () => {
    const out = analyzeRecovery({
      ...base,
      hrv: { rmssd: 80, sdnn: 60, restingHR: 55, readinessScore: 80 },
      hrvBaseline: { status: 'low', n: 7 },
    });
    expect(out.hrvScore).toBeLessThanOrEqual(35);
    expect(out.recommendations.join(' ')).toContain('личной базы');
  });
});
