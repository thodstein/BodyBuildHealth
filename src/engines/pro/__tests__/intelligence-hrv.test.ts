import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadHrvReadings,
  appendHrvReading,
  buildHrvBaseline,
  hrvReadiness,
  hrvRatioToBaseline,
  hrvRecoveryMult,
  hrvSignalFromStore,
  HRV_PROTOCOL_NOTE,
  HRV_BASELINE_REQUIRED_NOTE,
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

  it('F2 reduced/elevated/need_base ветки', () => {
    const hrv = { rmssd: 30, sdnn: 40, restingHR: 62, readinessScore: 70 };
    const reduced = analyzeRecovery({ ...base, hrv, hrvBaseline: { status: 'reduced', n: 7 } });
    expect(reduced.hrvScore).toBeLessThanOrEqual(55);
    expect(reduced.recommendations.join(' ')).toContain('лёгкий');
    const elevated = analyzeRecovery({ ...base, hrv, hrvBaseline: { status: 'elevated', n: 7 } });
    expect(elevated.hrvScore).toBeGreaterThanOrEqual(60);
    const noBase = analyzeRecovery({ ...base, hrv, hrvBaseline: { status: 'need_base', n: 1 } });
    expect(noBase.hrvScore).toBeLessThan(60); // как раньше, без базы
  });
});

describe('E2 честное восстановление: суперкомпенсация, сон, санация', () => {
  const hrvGood = { rmssd: 70, restingHR: 52, readinessScore: 80 };
  const hrvBad = { rmssd: 28, restingHR: 74, readinessScore: 25 };
  const sleepGood = { hours: 8, quality: 5 };
  const sleepBad = { hours: 4.5, quality: 1 };

  // ── P0: направление было инвертировано ──
  // было: hours = (1.5 − (sleep+hrv)/200) × base → чем ХУЖЕ восстановление, тем ДЛИННЕЕ «окно»,
  // и UI звал это «планируйте тяжёлую сессию в это окно».
  it('хорошее восстановление → окно короче и флаг готов (было наоборот)', () => {
    const good = analyzeRecovery({ sleep: sleepGood, hrv: hrvGood, fatigueScore: 0.3, trainingDaysThisWeek: 3, currentWeek: 2 });
    const bad = analyzeRecovery({ sleep: sleepBad, hrv: hrvBad, fatigueScore: 0.3, trainingDaysThisWeek: 3, currentWeek: 2 });
    expect(good.supercompensationHours).toBeLessThan(bad.supercompensationHours);
    expect(good.supercompensationReady).toBe(true);
    expect(good.supercompensationReason).toMatch(/достаточн/);
  });

  it('плохое восстановление → supercompensationReady=false с честной причиной', () => {
    const bad = analyzeRecovery({ sleep: sleepBad, hrv: hrvBad, fatigueScore: 0.3, trainingDaysThisWeek: 3, currentWeek: 2 });
    expect(bad.supercompensationReady).toBe(false);
    expect(bad.supercompensationReason.length).toBeGreaterThan(10);
  });

  it('усталость растягивает окно, но не создаёт готовность', () => {
    const calm = analyzeRecovery({ sleep: sleepGood, hrv: hrvGood, fatigueScore: 0.1, trainingDaysThisWeek: 2, currentWeek: 1 });
    const tired = analyzeRecovery({ sleep: sleepGood, hrv: hrvGood, fatigueScore: 0.95, trainingDaysThisWeek: 6, currentWeek: 1 });
    expect(tired.supercompensationHours).toBeGreaterThan(calm.supercompensationHours);
  });

  // ── сон: не выдумывать отсутствующие входы ──
  it('scoreSleep не начисляет бонусы за несуществующие засыпание/пробуждения/времена', () => {
    const withFake = analyzeRecovery({ sleep: { ...sleepGood, latencyMin: 5, awakenings: 0, bedtime: '23:00', wakeTime: '07:00' }, hrv: hrvGood, fatigueScore: 0.2, trainingDaysThisWeek: 3, currentWeek: 1 });
    const without = analyzeRecovery({ sleep: sleepGood, hrv: hrvGood, fatigueScore: 0.2, trainingDaysThisWeek: 3, currentWeek: 1 });
    // без «фантомных» данных сон не должен быть идеальным на 100
    expect(without.sleepScore).toBeLessThan(withFake.sleepScore);
    expect(without.sleepScore).toBeLessThan(100);
  });

  it('плохое качество сна (введено по шкале 0-10) не читается как «отличное»', () => {
    const zeroBased = analyzeRecovery({ sleep: { hours: 7, quality: 9 }, hrv: hrvGood, fatigueScore: 0.2, trainingDaysThisWeek: 3, currentWeek: 1 });
    const five = analyzeRecovery({ sleep: { hours: 7, quality: 5 }, hrv: hrvGood, fatigueScore: 0.2, trainingDaysThisWeek: 3, currentWeek: 1 });
    // 9 из 10-балльной шкалы приводится к 4.5/5 — не «идеальный сон» и не хуже максимума
    expect(zeroBased.sleepScore).toBeLessThanOrEqual(five.sleepScore);
    expect(zeroBased.sleepScore).toBeGreaterThan(five.sleepScore - 5);
  });

  // ── мусорные входы ──
  it('NaN/строки во входах нормализуются и помечаются inputsSanitized (было: тихие дефолты)', () => {
    const out = analyzeRecovery({
      sleep: { hours: NaN, quality: '4' as unknown as number },
      hrv: { rmssd: NaN, restingHR: NaN, readinessScore: NaN },
      fatigueScore: NaN, trainingDaysThisWeek: NaN, currentWeek: 0, periodizationPhase: 'accumulation',
    });
    expect(out.inputsSanitized).toBe(true);
    expect(Number.isFinite(out.overallRecoveryIndex)).toBe(true);
    expect(out.overallRecoveryIndex).toBeGreaterThanOrEqual(0);
    expect(out.overallRecoveryIndex).toBeLessThanOrEqual(100);
    expect(out.recommendations.join(' ')).toMatch(/некорректн/i);
  });

  it('currentWeek=0 не выдумывает «недельное правило делода» (хаб больше не шлёт week 4)', () => {
    const noWeek = analyzeRecovery({ sleep: sleepGood, hrv: hrvGood, fatigueScore: 0.2, trainingDaysThisWeek: 4, currentWeek: 0 });
    const week6 = analyzeRecovery({ sleep: sleepGood, hrv: hrvGood, fatigueScore: 0.2, trainingDaysThisWeek: 4, currentWeek: 6 });
    expect(noWeek.supercompensationHours).toBe(week6.supercompensationHours);
  });
});

/* ── P0-Б (26.09.2026): HRV → личная база. Локи контракта, который заменил
 *    абсолютный порог >70/<50 мс в lms-builder и bb-volume. ── */
describe('P0-Б hrvRecoveryMult — только от личной базы', () => {
  it('без базы объём НЕ трогаем, даже при «популярно низком» 40 мс', () => {
    const v = hrvRecoveryMult({ hrvMs: 40 });
    expect(v.mult).toBe(1);
    expect(v.source).toBe('none');
    expect(v.note).toBe(HRV_BASELINE_REQUIRED_NOTE);
  });

  it('без базы высокие 80 мс тоже не дают бонуса (Plews 2013 PMID 23535808)', () => {
    const v = hrvRecoveryMult({ hrvMs: 80 });
    expect(v.mult).toBe(1);
    expect(v.source).toBe('none');
  });

  it('z-путь: ≤−2 SWC → ×0.85, ≤−1 → ×0.925, коридор → 1, ≥+2 → 1 (неоднозначно)', () => {
    expect(hrvRecoveryMult({ hrvMs: 40, hrvBaselineZ: -2.4 }).mult).toBe(0.85);
    expect(hrvRecoveryMult({ hrvMs: 50, hrvBaselineZ: -1.2 }).mult).toBe(0.925);
    expect(hrvRecoveryMult({ hrvMs: 60, hrvBaselineZ: 0.1 }).mult).toBe(1);
    const up = hrvRecoveryMult({ hrvMs: 80, hrvBaselineZ: 2.5 });
    expect(up.mult).toBe(1);
    expect(up.note).toMatch(/неоднозначн/i);
  });

  it('z приоритетнее ratio, если переданы оба', () => {
    const v = hrvRecoveryMult({ hrvMs: 40, hrvBaseline: 80, hrvBaselineZ: -0.2 });
    expect(v.source).toBe('z');
    expect(v.mult).toBe(1);
  });

  it('ratio-путь (есть только база в мс): ≤80% → ×0.85, ≤90% → ×0.925, коридор → 1', () => {
    expect(hrvRecoveryMult({ hrvMs: 60, hrvBaseline: 80 }).mult).toBe(0.85);
    expect(hrvRecoveryMult({ hrvMs: 70, hrvBaseline: 80 }).mult).toBe(0.925);
    expect(hrvRecoveryMult({ hrvMs: 80, hrvBaseline: 80 }).mult).toBe(1);
  });

  it('мусор на входе → нейтрально, без исключения', () => {
    expect(hrvRecoveryMult({}).mult).toBe(1);
    expect(hrvRecoveryMult({ hrvMs: Number.NaN }).mult).toBe(1);
    expect(hrvRecoveryMult({ hrvMs: -5 }).mult).toBe(1);
    expect(hrvRecoveryMult({ hrvMs: 50, hrvBaseline: 0 }).mult).toBe(1);
  });

  it('hrvSignalFromStore: база строится из he_hrv_log, без базы n=0 и need_base', () => {
    const empty = hrvSignalFromStore(50);
    expect(empty.n).toBe(0);
    expect(empty.status).toBe('need_base');
    expect(hrvRecoveryMult(empty).mult).toBe(1);

    seed([60, 62, 58, 61, 59]);
    const withBase = hrvSignalFromStore(40);
    expect(withBase.n).toBeGreaterThanOrEqual(3);
    expect(withBase.hrvBaselineZ).toBeLessThan(0);
    expect(hrvRecoveryMult(withBase).mult).toBeLessThan(1);
  });
});
