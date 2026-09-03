/**
 * cardio-pro-level.test.ts — PRO-эпики A/B/D/E/F/G + FIT-детали.
 * Чистые функции новых движков + интеграция buildCardioCycle (LTHR/жара).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ftpFrom20MinTest,
  criticalPowerFrom3And12,
  criticalPowerFromEfforts,
  talkTestZone2Ceiling,
  zonesFromTalkTest,
  personalZones,
  recommendFieldTest,
  validateFieldTestInput,
  appendFieldTestLog,
  responderFromLog,
  latestFieldTestMetrics,
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
  taperCutFromCycle,
} from '../cardio-taper-pro.engine';
import {
  heatAltitudeHrAdd,
  hydrationAdvice,
  cardioTimingPenalty,
  cardioInterferenceV2,
} from '../cardio-safety.engine';
import { fitDecoupling, fitHrZoneHistogram, fitSecondHalfDrop, extractFitRecords } from '../../cardio-import.engine';
import {
  buildCardioCycle, applyIndividualizedTaperToCycle, cardioQualityReport, zonesFromTalkTest,
  buildCardioCycleFromPrep, explainCardioChoice, cardioPlanVariants, type CardioPrepPlanLike,
} from '../cardio.engine';

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
  it('extractFitRecords из распарсенного объекта', () => {
    const parsed = {
      records: [
        { heart_rate: 150, power: 200, speed: 3.5, cadence: 90 },
        { heartRate: 152, watts: 195 },
        { hr: 300, power: 200 },
        { foo: 'bar' },
      ],
    };
    const recs = extractFitRecords(parsed);
    // 3-я запись: HR 300 отброшен, но мощность валидна → запись остаётся без HR
    expect(recs.length).toBe(3);
    expect(recs[0].hr).toBe(150);
    expect(recs[0].powerWatts).toBe(200);
    expect(recs[0].speedKmh).toBeCloseTo(12.6, 1);
    expect(recs[2].hr).toBeUndefined();
    expect(recs[2].powerWatts).toBe(200);
    expect(extractFitRecords({})).toEqual([]);
    expect(extractFitRecords(null)).toEqual([]);
  });
});

// ─── F2: применение taper-плана + срез из цикла ───
describe('PRO F2 apply taper + cut', () => {
  it('applyIndividualizedTaperToCycle режет окно и чистит HIIT', () => {
    const c = buildCardioCycle({
      goal: 'cut', totalWeeks: 8,
      competitions: [{ id: 's1', name: 'Старт', week: 8 }],
      taperWeeks: 2, taper: false, peakWeek: false,
    });
    // без taper в конфиге недели 6-7 — рабочие (чётная 6 с HIIT)
    expect(c.weeks.find(w => w.week === 6)!.sessions.some(s => s.type === 'hiit')).toBe(true);
    const plan = individualizedTaperPlan({});
    const { cycle: c2, changes } = applyIndividualizedTaperToCycle(c, plan, { showWeek: 8 });
    expect(changes.length).toBeGreaterThan(0);
    const w6 = c2.weeks.find(w => w.week === 6)!;
    const w7 = c2.weeks.find(w => w.week === 7)!;
    expect(w6.phase).toBe('taper');
    expect(w7.phase).toBe('taper');
    expect(w6.sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(w7.sessions.some(s => s.type === 'hiit' || s.type === 'miss')).toBe(false);
    expect(w6.totalMinutes).toBeLessThan(c.weeks.find(w => w.week === 6)!.totalMinutes);
    expect(w7.totalMinutes).toBeLessThan(c.weeks.find(w => w.week === 7)!.totalMinutes);
    // идемпотентность: повтор не меняет
    const again = applyIndividualizedTaperToCycle(c2, plan, { showWeek: 8 });
    expect(again.changes.length).toBe(0);
  });
  it('taperCutFromCycle считает срез и прогноз', () => {
    const c = buildCardioCycle({
      goal: 'cut', totalWeeks: 8,
      competitions: [{ id: 's1', name: 'Старт', week: 8 }],
      taperWeeks: 2, taper: true, peakWeek: true,
    });
    const cut = taperCutFromCycle(c);
    expect(cut).not.toBeNull();
    expect(cut!.reductionPct).toBeGreaterThan(0);
    expect(cut!.gainPct).toBeGreaterThan(0);
    expect(taperCutFromCycle(buildCardioCycle({ goal: 'health', totalWeeks: 4 }))).toBeNull();
    expect(taperCutFromCycle(null)).toBeNull();
  });
});

// ─── A2: CP по N усилиям + журнал тестов ───
describe('PRO A2 cp-fit + log', () => {
  it('criticalPowerFromEfforts МНК (3 усилия)', () => {
    const fit = criticalPowerFromEfforts([
      { seconds: 180, watts: 350 },
      { seconds: 420, watts: 310 },
      { seconds: 720, watts: 285 },
    ]);
    expect(fit).not.toBeNull();
    expect(fit!.cp).toBeGreaterThan(200);
    expect(fit!.cp).toBeLessThan(285);
    expect(fit!.wPrimeKj).toBeGreaterThan(0);
    expect(fit!.r2).toBeGreaterThan(0.9);
    expect(fit!.n).toBe(3);
  });
  it('CP отбраковывает мусор', () => {
    expect(criticalPowerFromEfforts([{ seconds: 180, watts: 300 }])).toBeNull();
    expect(criticalPowerFromEfforts([
      { seconds: 180, watts: 280 },
      { seconds: 720, watts: 300 },
    ])).toBeNull();
    expect(criticalPowerFromEfforts([])).toBeNull();
  });
  it('appendFieldTestLog + responderFromLog', () => {
    let log = appendFieldTestLog([], { date: '2026-01-01', kind: 'aet60', driftPct: 8, decouplingPct: 9 });
    log = appendFieldTestLog(log, { date: '2026-02-01', kind: 'aet60', driftPct: 4, decouplingPct: 3 });
    expect(log.length).toBe(2);
    expect(responderFromLog(log).responder).toBe(true);
    expect(responderFromLog([]).responder).toBeNull();
    // битая дата игнорируется, кап 24
    expect(appendFieldTestLog(log, { date: 'bad', kind: 'aet60' }).length).toBe(2);
    let big = log;
    for (let i = 0; i < 30; i++) big = appendFieldTestLog(big, { date: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`, kind: 'talk' });
    expect(big.length).toBeLessThanOrEqual(24);
  });
});

// ─── A3: персистентность журнала тестов ───
describe('PRO A3 field-test storage', () => {
  const KEY = 'he_cardio_field_tests_v1';
  beforeEach(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  });
  it('save/load/remove/clear roundtrip', async () => {
    const mod = await import('../cardio-field-tests.engine');
    expect(mod.loadFieldTestLog()).toEqual([]);
    mod.saveFieldTestLogEntry({ date: '2026-01-01', kind: 'lthr30', lthr: 170 });
    mod.saveFieldTestLogEntry({ date: '2026-02-01', kind: 'ftp20', ftpWatts: 250 });
    let log = mod.loadFieldTestLog();
    expect(log.length).toBe(2);
    expect(log[0].date).toBe('2026-01-01');
    mod.removeFieldTestLogEntry('2026-01-01', 'lthr30');
    log = mod.loadFieldTestLog();
    expect(log.length).toBe(1);
    mod.clearFieldTestLog();
    expect(mod.loadFieldTestLog()).toEqual([]);
  });
  it('битый JSON → [], чужеродные записи отфильтровываются', async () => {
    const mod = await import('../cardio-field-tests.engine');
    localStorage.setItem(KEY, 'not-json{{{');
    expect(mod.loadFieldTestLog()).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify([{ date: '2026-01-01', kind: 'aet60' }, { nope: 1 }, null, 'x']));
    const log = mod.loadFieldTestLog();
    expect(log.length).toBe(1);
    expect(log[0].kind).toBe('aet60');
    mod.clearFieldTestLog();
  });
  it('latestFieldTestMetrics: последние по видам, мусор игнорируется', () => {
    expect(latestFieldTestMetrics([])).toEqual({});
    const m = latestFieldTestMetrics([
      { date: '2026-01-01', kind: 'lthr30', lthr: 165 },
      { date: '2026-02-01', kind: 'lthr30', lthr: 172 },
      { date: '2026-01-15', kind: 'ftp20', ftpWatts: 240 },
      { date: '2026-03-01', kind: 'talk', talkHr: 300 },
      { date: '2026-03-02', kind: 'talk', talkHr: 144 },
    ]);
    expect(m.lthr).toBe(172);
    expect(m.ftpWatts).toBe(240);
    expect(m.talkHr).toBe(144);
  });
  it('build talk-зоны = zonesFromTalkTest (дедуп)', () => {
    const ref = zonesFromTalkTest(145)!;
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, talkZone2Hr: 145 });
    const z2 = c.weeks[0].sessions.find(s => s.type === 'zone2')?.targetHr;
    expect(z2?.min).toBe(ref[1].bpmMin);
    expect(z2?.max).toBe(ref[1].bpmMax);
  });
  it('quality: threshold → warn, pyramidal → ok', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6 });
    for (const w of c.weeks) {
      if (w.deload || w.taper) continue;
      w.sessions = [
        { type: 'zone2', durationMin: 30, weeklyFrequency: 2, intensity: 'moderate', kcalPerSession: 200, purpose: 'x' },
        { type: 'miss', durationMin: 30, weeklyFrequency: 3, intensity: 'moderate', kcalPerSession: 300, purpose: 'x' },
      ];
      w.totalMinutes = 150;
    }
    const r = cardioQualityReport(c, 7);
    expect(r.findings.some(f => f.level === 'warn' && f.text.includes('TID threshold'))).toBe(true);
    const ok = cardioQualityReport(buildCardioCycle({ goal: 'health', totalWeeks: 6 }), 7);
    expect(ok.findings.some(f => f.level === 'ok' && f.text.includes('TID pyramidal'))).toBe(true);
  });
});

// ─── Раунд 7: prep-калибровка зон ───
describe('PRO prep calibration', () => {
  const prepBase: CardioPrepPlanLike = {
    id: 'prep-cal',
    showDate: '2026-09-15',
    category: 'mens_physique',
    sex: 'male',
    preparation: {
      startDate: '2026-06-01',
      weeks: 8,
      finalWeeks: 0,
      targetRatePctPerWeek: 0.5,
      startingWeightKg: 80,
      currentCalories: 2500,
      stepsPerDay: 8000,
      cardioMinutesPerWeek: 100,
    },
    taper: { enabled: true, weeks: 2 },
    peakWeek: { enabled: true },
  };
  const z2Of = (cycle: { weeks: { sessions: { type: string; targetHr?: { min?: number; max?: number } }[] }[] }) =>
    cycle.weeks[0].sessions.find(s => s.type === 'zone2')?.targetHr;

  it('lthr приоритетнее возраста', () => {
    const c = buildCardioCycleFromPrep(prepBase, { age: 30, lthr: 170 });
    const z2 = z2Of(c as unknown as Parameters<typeof z2Of>[0]);
    // lthrZones(170): Z2 = 82-88% → 139-150
    expect(z2?.min).toBe(139);
    expect(z2?.max).toBe(150);
    expect(c!.rationale.join(' ')).toMatch(/LTHR 170/);
  });
  it('без lthr — возрастные зоны Karvonen', () => {
    const c = buildCardioCycleFromPrep(prepBase, { age: 30 });
    const z2 = z2Of(c as unknown as Parameters<typeof z2Of>[0]);
    // 220-30=190: Z2 60-70% → 114-133
    expect(z2?.min).toBe(114);
    expect(z2?.max).toBe(133);
  });
  it('talk-test даёт потолок Z2', () => {
    const c = buildCardioCycleFromPrep(prepBase, { age: 30, talkZone2Hr: 145 });
    expect(z2Of(c as unknown as Parameters<typeof z2Of>[0])?.max).toBe(145);
  });
  it('жара сдвигает prep-зоны вверх', () => {
    const cold = buildCardioCycleFromPrep(prepBase, { age: 30 });
    const hot = buildCardioCycleFromPrep(prepBase, { age: 30, tempC: 32, altitudeM: 1900 });
    const zc = z2Of(cold as unknown as Parameters<typeof z2Of>[0])!;
    const zh = z2Of(hot as unknown as Parameters<typeof z2Of>[0])!;
    expect(zh.min).toBe(zc.min + 7 + 3);
    expect(hot!.rationale.join(' ')).toMatch(/Жара/);
  });
  it('explainCardioChoice честно называет источник зон', () => {
    const input = { goal: 'cut' as const, totalWeeks: 8, age: 30, lthr: 170 };
    const lines = explainCardioChoice(input, buildCardioCycle(input));
    expect(lines.join(' ')).toMatch(/LTHR 170/);
    const lines2 = explainCardioChoice({ goal: 'cut', totalWeeks: 8, age: 30 }, buildCardioCycle({ goal: 'cut', totalWeeks: 8, age: 30 }));
    expect(lines2.join(' ')).toMatch(/Возраст 30/);
  });
  it('варианты несут калибровку (lthr+жара) во все три цикла', () => {
    const vs = cardioPlanVariants({ goal: 'health', totalWeeks: 4, age: 30, lthr: 172, tempC: 30 });
    expect(vs.map(v => v.id).sort()).toEqual(['base', 'gentle', 'intense']);
    for (const v of vs) {
      const z2 = v.cycle.weeks[0].sessions.find(s => s.type === 'zone2')?.targetHr;
      // lthrZones(172) Z2 = 141-151, жара +5 → 146-156; возрастные были бы 114-133
      expect(z2?.min).toBe(146);
      expect(z2?.max).toBe(156);
    }
  });
});
