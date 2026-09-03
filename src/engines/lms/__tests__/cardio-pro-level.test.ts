/**
 * cardio-pro-level.test.ts — PRO-эпики A/B/D/E/F/G + FIT-детали.
 * Чистые функции новых движков + интеграция buildCardioCycle (LTHR/жара).
 */
import { describe, it, expect } from 'vitest';
import {
  ftpFrom20MinTest,
  criticalPowerFrom3And12,
  talkTestZone2Ceiling,
  zonesFromTalkTest,
  personalZones,
  recommendFieldTest,
  validateFieldTestInput,
} from '../cardio-field-tests.engine';
import {
  dailyPmcSeries,
  hrTss,
  powerTss,
  runTss,
  correctHrForDrift,
  driftCorrectedTss,
  tssRampRate,
  interpretTsb,
} from '../cardio-pmc.engine';
import {
  timeInZones,
  polarizationIndex,
  classifyTid,
  tidAdvice,
  phasedTidTarget,
  tidDistanceToTarget,
} from '../cardio-tid.engine';
import {
  aerobicDecoupling,
  efficiencyPowerHr,
  durabilityTrend,
  responderClassification,
  durabilityDurationTarget,
} from '../cardio-durability.engine';
import {
  exponentialTaperMult,
  stepTaperMult,
  recommendTaperDecay,
  individualizedTaperPlan,
  performanceGainEstimate,
} from '../cardio-taper-pro.engine';
import {
  heatAltitudeHrAdd,
  hydrationAdvice,
  cardioTimingPenalty,
  cardioInterferenceV2,
} from '../cardio-safety.engine';
import { fitDecoupling, fitHrZoneHistogram, fitSecondHalfDrop } from '../../cardio-import.engine';
import { buildCardioCycle } from '../cardio.engine';

// ─── A: field-tests ───
describe('PRO A field-tests', () => {
  it('ftp 20мин ×0.95', () => {
    expect(ftpFrom20MinTest(200)).toBe(190);
    expect(ftpFrom20MinTest(10)).toBeNull();
    expect(ftpFrom20MinTest(900)).toBeNull();
  });
  it('CP из 3/12 мин', () => {
    const cp = criticalPowerFrom3And12(350, 280);
    expect(cp).not.toBeNull();
    expect(cp as number).toBeGreaterThan(100);
    expect(cp as number).toBeLessThan(280);
    expect(criticalPowerFrom3And12(250, 280)).toBeNull();
  });
  it('talk-test потолок и зоны', () => {
    expect(talkTestZone2Ceiling(145)).toBe(145);
    expect(talkTestZone2Ceiling(50)).toBeNull();
    const z = zonesFromTalkTest(145);
    expect(z).not.toBeNull();
    expect(z!.length).toBe(5);
    expect(z![1].bpmMax).toBe(145);
  });
  it('personalZones приоритет LTHR > talk > age', () => {
    const p1 = personalZones({ lthr: 170, talkZone2Hr: 145, age: 30 });
    expect(p1?.source).toBe('lthr');
    const p2 = personalZones({ talkZone2Hr: 145, age: 30 });
    expect(p2?.source).toBe('talk');
    const p3 = personalZones({ age: 30 });
    expect(p3?.source).toBe('age');
    expect(personalZones({})).toBeNull();
  });
  it('recommend + validate', () => {
    expect(recommendFieldTest('beginner', 'running')).toMatch(/Talk-test/);
    expect(recommendFieldTest('advanced', 'cycling')).toMatch(/FTP/);
    expect(validateFieldTestInput({ lthr: 300 })).toHaveLength(1);
    expect(validateFieldTestInput({ lthr: 170 })).toHaveLength(0);
  });
  it('buildCardioCycle с LTHR и жарой', () => {
    const c1 = buildCardioCycle({ goal: 'health', totalWeeks: 4, lthr: 172 });
    const z2 = c1.weeks[0].sessions.find(s => s.type === 'zone2')?.targetHr;
    expect(z2).toBeDefined();
    // LTHR 172 → Z2 141-151 (82-88%)
    expect(z2!.min).toBeGreaterThanOrEqual(138);
    const c2 = buildCardioCycle({ goal: 'health', totalWeeks: 4, age: 30, tempC: 30, altitudeM: 1600 });
    const z2h = c2.weeks[0].sessions.find(s => s.type === 'zone2')?.targetHr;
    const c0 = buildCardioCycle({ goal: 'health', totalWeeks: 4, age: 30 });
    const z20 = c0.weeks[0].sessions.find(s => s.type === 'zone2')?.targetHr;
    expect(z2h!.min).toBeGreaterThan(z20!.min);
    expect(c2.rationale.join(' ')).toMatch(/Жара/);
  });
});

// ─── B: PMC + drift ───
describe('PRO B pmc + drift', () => {
  it('dailyPmcSeries растёт и свежеет на отдыхе', () => {
    const loads = [
      { date: '2026-01-01', load: 50 },
      { date: '2026-01-02', load: 50 },
      { date: '2026-01-03', load: 50 },
    ];
    const s = dailyPmcSeries(loads, { referenceIso: '2026-01-10', days: 10 });
    expect(s.length).toBe(10);
    expect(s[s.length - 1].ctl).toBeGreaterThan(0);
    expect(s[s.length - 1].tsb).toBeDefined();
    expect(dailyPmcSeries([], {})).toEqual([]);
  });
  it('hrTss / powerTss / runTss', () => {
    expect(hrTss(60, 150, 60, 190)).toBeGreaterThan(0);
    expect(hrTss(0, 150, 60, 190)).toBe(0);
    expect(powerTss(60, 200, 250)).not.toBeNull();
    expect(powerTss(60, 200, 10)).toBeNull();
    expect(runTss(60, 5, 5)).not.toBeNull();
    expect(runTss(0, 5, 5)).toBeNull();
  });
  it('correctHrForDrift lite (Papini)', () => {
    const short = correctHrForDrift(150, { durationMin: 40 });
    expect(short.driftBpm).toBe(0);
    const long = correctHrForDrift(155, { durationMin: 120, tempC: 30, weightLossPct: 2 });
    expect(long.driftBpm).toBeGreaterThan(5);
    expect(long.correctedHr).toBeLessThan(155);
    const t = driftCorrectedTss(90, 155, 60, 190, 'male', { durationMin: 90, tempC: 28 });
    expect(t.tss).toBeLessThanOrEqual(t.rawTss);
  });
  it('tssRampRate + interpretTsb', () => {
    const daily = [
      { date: '2026-01-01', load: 50 },
      { date: '2026-01-02', load: 50 },
      { date: '2026-01-08', load: 100 },
      { date: '2026-01-09', load: 100 },
    ];
    const r = tssRampRate(daily, '2026-01-09');
    expect(r.acute).toBeGreaterThan(0);
    expect(interpretTsb(20)).toMatch(/пик/);
    expect(interpretTsb(-15)).toMatch(/перегруз/);
  });
});

// ─── D: TID ───
describe('PRO D tid', () => {
  it('timeInZones + PI + classify', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const tiz = timeInZones(c);
    expect(tiz.totalMin).toBeGreaterThan(0);
    expect(tiz.pct.z1 + tiz.pct.z2 + tiz.pct.z3).toBeGreaterThan(99);
    const pi = polarizationIndex(tiz.pct.z1, tiz.pct.z2, tiz.pct.z3);
    expect(pi).not.toBeNull();
    const cls = classifyTid(tiz);
    expect(['polarized', 'pyramidal', 'threshold', 'other']).toContain(cls.model);
  });
  it('PI порог 2 (Treff)', () => {
    expect(polarizationIndex(80, 5, 15)).toBeGreaterThan(2);
    expect(polarizationIndex(80, 15, 5)).toBeLessThan(2);
    expect(polarizationIndex(80, 0, 20)).not.toBeNull();
    expect(polarizationIndex(0, 5, 15)).toBeNull();
  });
  it('tidAdvice по уровню (Silva/Cove)', () => {
    expect(tidAdvice('polarized', 'beginner')).toMatch(/pyramidal|новичка/);
    expect(tidAdvice('pyramidal', 'advanced', 'run')).toMatch(/PYR→POL|Продвинутый/);
    expect(tidAdvice('polarized', 'advanced', 'bike')).toMatch(/Cove|Вело/);
  });
  it('phasedTidTarget + distance', () => {
    const g = phasedTidTarget('general');
    expect(g.z1).toBe(85);
    const p = phasedTidTarget('precomp');
    expect(p.z3).toBeGreaterThan(10);
    const tiz = { z1Min: 80, z2Min: 10, z3Min: 10, totalMin: 100, pct: { z1: 80, z2: 10, z3: 10 } };
    expect(tidDistanceToTarget(tiz, { z1: 80, z2: 10, z3: 10 })).toBe(0);
  });
});

// ─── E: durability ───
describe('PRO E durability', () => {
  it('aerobicDecoupling пороги TP (<5/5-10/>10)', () => {
    expect(aerobicDecoupling(10, 9.8)?.level).toBe('strong');
    expect(aerobicDecoupling(10, 9.2)?.level).toBe('moderate');
    expect(aerobicDecoupling(10, 8.5)?.level).toBe('weak');
    expect(aerobicDecoupling(0, 5)).toBeNull();
  });
  it('efficiency + trend + responder', () => {
    expect(efficiencyPowerHr(200, 150)).toBeCloseTo(1.333, 2);
    const t = durabilityTrend([
      { date: '2026-01-01', decouplingPct: 8, durationMin: 90 },
      { date: '2026-02-01', decouplingPct: 3, durationMin: 90 },
    ]);
    expect(t.trend).toBe('improving');
    expect(durabilityTrend([]).trend).toBe('nodata');
    const r = responderClassification({ driftPct: 8, decouplingPct: 8 }, { driftPct: 3, decouplingPct: 3 });
    expect(r.responder).toBe(true);
    const n = responderClassification({ driftPct: 3, decouplingPct: 3 }, { driftPct: 8, decouplingPct: 8 });
    expect(n.responder).toBe(false);
  });
  it('duration target вело/бег', () => {
    expect(durabilityDurationTarget('bike', 1).targetHours).toBe(2);
    expect(durabilityDurationTarget('run', 5).targetHours).toBe(2);
  });
});

// ─── F: taper-pro ───
describe('PRO F taper-pro', () => {
  it('exponential vs step', () => {
    expect(stepTaperMult(50)).toBe(0.5);
    const m0 = exponentialTaperMult(0, 14, 50, 4);
    const mEnd = exponentialTaperMult(14, 14, 50, 4);
    expect(m0).toBeGreaterThan(mEnd);
    expect(mEnd).toBeCloseTo(0.5, 1);
  });
  it('recommend decay по длительности', () => {
    expect(recommendTaperDecay(10, false).decay).toBe('fast');
    expect(recommendTaperDecay(21, true).decay).toBe('slow');
  });
  it('individualized: overload и F-OR удлиняют', () => {
    const base = individualizedTaperPlan({});
    expect(base.durationDays).toBe(14);
    const over = individualizedTaperPlan({ overloadPct: 25 });
    expect(over.durationDays).toBe(21);
    const forr = individualizedTaperPlan({ fatigue: 'F-OR', sleepHours: 5 });
    expect(forr.durationDays).toBe(21);
    expect(forr.sleepHygiene).toBe(true);
    expect(forr.expectedGainPct).toBeLessThanOrEqual(2.6);
  });
  it('performanceGain оптимум 41-60% 8-21д', () => {
    expect(performanceGainEstimate(50, 14).gainPct).toBeGreaterThan(1.5);
    expect(performanceGainEstimate(10, 3).gainPct).toBeLessThan(1.9);
  });
});

// ─── G: safety + interference v2 ───
describe('PRO G safety', () => {
  it('heat/altitude поправка', () => {
    const n = heatAltitudeHrAdd({ durationMin: 40, tempC: 20 });
    expect(n.addBpm).toBe(0);
    const h = heatAltitudeHrAdd({ durationMin: 90, tempC: 32, altitudeM: 1900 });
    expect(h.addBpm).toBeGreaterThan(5);
    expect(hydrationAdvice(30)).toMatch(/по жажде/);
    expect(hydrationAdvice(120, 30)).toMatch(/электролиты/);
  });
  it('timing penalty: separate < same session', () => {
    const ok = cardioTimingPenalty({ legDays: [0], cardioDay: 2, gap: 'separate_day' });
    const bad = cardioTimingPenalty({ legDays: [0], cardioDay: 0, gap: 'same_session' });
    expect(ok.penalty).toBeLessThan(bad.penalty);
  });
  it('interference v2 шкала и пол', () => {
    const m = cardioInterferenceV2({ modality: 'running', frequencyPerWeek: 5, avgDurationMin: 60, gap: 'same_session', sex: 'male' });
    expect(m.score).toBeGreaterThan(6);
    expect(m.level).toBe('high');
    const f = cardioInterferenceV2({ modality: 'running', frequencyPerWeek: 5, avgDurationMin: 60, gap: 'same_session', sex: 'female' });
    expect(f.score).toBeLessThan(m.score);
    const low = cardioInterferenceV2({ modality: 'cycling', frequencyPerWeek: 2, avgDurationMin: 25, gap: 'separate_day' });
    expect(low.level).toBe('low');
  });
});

// ─── C: FIT details ───
describe('PRO C fit details', () => {
  it('fitDecoupling по записям', () => {
    const recs = Array.from({ length: 20 }, (_, i) => ({ hr: 150, powerWatts: i < 10 ? 200 : 190 }));
    const d = fitDecoupling(recs, 'power');
    expect(d).not.toBeNull();
    expect(d as number).toBeGreaterThan(0);
    expect(fitDecoupling([{ hr: 150 }], 'power')).toBeNull();
  });
  it('histogram + drop', () => {
    const recs = [{ hr: 120 }, { hr: 145 }, { hr: 170 }];
    expect(fitHrZoneHistogram(recs, [140, 160]).length).toBe(3);
    const drop = fitSecondHalfDrop(Array.from({ length: 20 }, (_, i) => ({ hr: 150, powerWatts: i < 10 ? 220 : 200 })));
    expect(drop.dropPct).not.toBeNull();
  });
});
