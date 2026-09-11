import { describe, it, expect } from 'vitest';
import { pciFromTrackings, persistingAsymmetry } from '../strength-sport-ta-bar-consistency.engine';
import { diagnoseTAImtp, imtpEnduranceDrop } from '../strength-sport-ta-imtp.engine';
import { shrinkMVT, isVelocityShiftReal, velocityMetricFlag, mvtRetestNote } from '../strength-sport-ta-mvt.engine';
import { jerkAclFlags } from '../strength-sport-ta-jerk-safety.engine';
import { meetPlan } from '../strength-sport-ta-meet-strategy.engine';
import { ymaxNormForBodyweight, ymaxVerdict, femalePhaseNorm, femaleLevelOf, femalePhaseVerdict } from '../strength-sport-ta-norms.engine';

describe('ta-v4 bar consistency (V1)', () => {
  it('PCI elite при стабильной серии', () => {
    const r = pciFromTrackings([4.0, 4.1, 3.9, 4.05]);
    expect(r).not.toBeNull();
    expect(r!.pci).toBeGreaterThanOrEqual(90);
    expect(r!.level).toBe('elite');
  });
  it('PCI низкий при гуляющей технике', () => {
    const r = pciFromTrackings([2, 8, 3, 9]);
    expect(r).not.toBeNull();
    expect(r!.pci).toBeLessThan(75);
  });
  it('персист 4+ одного знака — сигнал', () => {
    const r = persistingAsymmetry([2.1, 2.5, 3.0, 2.2]);
    expect(r.persisting).toBe(true);
    expect(r.text).toMatch(/держится/);
  });
  it('разовый замер молчит', () => {
    const r = persistingAsymmetry([2.5]);
    expect(r.persisting).toBe(false);
    expect(r.text).toBeNull();
  });
});

describe('ta-v4 two isometrics (V2)', () => {
  it('IFP/IMTP low — предупреждение про пол', () => {
    const r = diagnoseTAImtp({ peakForceN: 4000, bodyweightKg: 80, ifpPeakN: 1500 });
    expect(r).not.toBeNull();
    expect(r!.ifpRatio).toBeLessThan(0.45);
    expect(r!.warnings.join(' ')).toMatch(/с пола/);
  });
  it('IFP/IMTP ok', () => {
    const r = diagnoseTAImtp({ peakForceN: 4000, bodyweightKg: 80, ifpPeakN: 2100 });
    expect(r!.ifpRatio).toBeGreaterThanOrEqual(0.5);
  });
  it('impulse гасит серую зону RFD текстом', () => {
    const r = diagnoseTAImtp({ peakForceN: 3000, bodyweightKg: 80, rfdNs: 5000, impulseNs: 400 });
    expect(r!.rfdGray).toBe(true);
    expect(r!.hasImpulse).toBe(true);
    expect(r!.warnings.join(' ')).toMatch(/импульс/);
  });
  it('пусто — null ratio без ломки профиля', () => {
    const r = diagnoseTAImtp({ peakForceN: 3000, bodyweightKg: 80 });
    expect(r!.ifpRatio).toBeNull();
    expect(r!.profile).toBe('balanced');
  });
});

describe('ta-v4 honest MVT-2 (V3)', () => {
  it('shrinkage при малом числе точек тянет к популяции', () => {
    const r = shrinkMVT(1.1, 1.3, 2)!;
    expect(r.mvt).toBeGreaterThan(1.1);
    expect(r.mvt).toBeLessThan(1.3);
    expect(r.te).toBe(0.03);
  });
  it('при 4+ точках TE 0.02', () => {
    expect(shrinkMVT(1.1, 1.3, 5)!.te).toBe(0.02);
  });
  it('SDD: 0.03 молчит, 0.08 сигналит', () => {
    expect(isVelocityShiftReal(1.5, 1.53)).toBe(false);
    expect(isVelocityShiftReal(1.5, 1.58)).toBe(true);
  });
  it('mean/peak флаг', () => {
    expect(velocityMetricFlag('peak')).toMatch(/пик/);
    expect(velocityMetricFlag('')).toBeNull();
  });
  it('перетест-напоминание', () => {
    expect(mvtRetestNote(5, 0)).toMatch(/перекалибруй/);
    expect(mvtRetestNote(1, 0)).toBeNull();
  });
});

describe('ta-v4 jerk ACL guard (V4)', () => {
  it('пара флагов — stop', () => {
    const r = jerkAclFlags({ kneeValgus: true, kneeRotation: true })!;
    expect(r.level).toBe('stop');
    expect(r.text).toMatch(/ACL/);
  });
  it('один флаг — warn', () => {
    expect(jerkAclFlags({ deepDip: true })!.level).toBe('warn');
  });
  it('пусто — null', () => {
    expect(jerkAclFlags({})).toBeNull();
  });
});

describe('ta-v4 meet strategy (V5)', () => {
  it('опенер 92–94%', () => {
    const p = meetPlan({ snatchMaxKg: 100, cjMaxKg: 130 })!;
    expect(p.snatchOpener).toBeGreaterThanOrEqual(92);
    expect(p.snatchOpener).toBeLessThanOrEqual(94);
    expect(p.cjOpener).toBeGreaterThanOrEqual(119);
  });
  it('новичку консервативнее + прыжки меньше', () => {
    const p = meetPlan({ snatchMaxKg: 100, cjMaxKg: 130, level: 'beginner' })!;
    expect(p.snatchOpener).toBe(92);
    expect(p.snatchJumps).toEqual([2, 2]);
  });
  it('пусто — null', () => {
    expect(meetPlan({})).toBeNull();
  });
});

describe('ta-v4 norms (V6)', () => {
  it('норма растёт с весовой', () => {
    const light = ymaxNormForBodyweight(61, 'male')!;
    const heavy = ymaxNormForBodyweight(109, 'male')!;
    expect(heavy.lo).toBeGreaterThan(light.lo);
  });
  it('вердикт low/high/in-range', () => {
    const norm = ymaxNormForBodyweight(73, 'male')!;
    expect(ymaxVerdict(norm.lo - 10, 73, 'male')).toMatch(/низко/);
    expect(ymaxVerdict(norm.hi + 10, 73, 'male')).toMatch(/высоко/);
    expect(ymaxVerdict((norm.lo + norm.hi) / 2, 73, 'male')).toMatch(/норме/);
  });
  it('женские уровни различаются', () => {
    const n = femalePhaseNorm('novice');
    const a = femalePhaseNorm('advanced');
    expect(a.finalAccS[1]).toBeLessThan(n.finalAccS[0]);
    expect(femaleLevelOf('elite')).toBe('advanced');
  });
});

describe('ta-v4 endurance (V7)', () => {
  it('дроп >15% — лимитирует', () => {
    const r = imtpEnduranceDrop([4000, 3950, 3900], [3200, 3150, 3100])!;
    expect(r.limited).toBe(true);
    expect(r.dropPct).toBeGreaterThan(15);
  });
  it('малый дроп — норма', () => {
    expect(imtpEnduranceDrop([4000, 4000], [3900, 3900])!.limited).toBe(false);
  });
});

describe('ta-v4 добойка (все 7 пунктов)', () => {
  it('xBias: знаковое смещение считается (вправо +)', async () => {
    const { analyzeBarTracking } = await import('../strength-sport-video.engine');
    const pts = Array.from({ length: 20 }, (_, i) => ({ x: 1 + i * 0.15, y: 50 + i * 4, t: i * 0.033 }));
    const r = analyzeBarTracking(pts as any)!;
    expect(r.xBias).toBeGreaterThan(0);
    expect(r.xLoop).toBeGreaterThan(0);
  });
  it('femalePhaseVerdict: факт в норме и вне нормы', () => {
    expect(femalePhaseVerdict('advanced', 0.89, 137)).toMatch(/^✓/);
    expect(femalePhaseVerdict('advanced', 1.2, 90)).toMatch(/^⚠/);
    expect(femalePhaseVerdict('novice', null, null)).toBeNull();
  });
  it('shrinkMVT с r²: шумная регрессия сильнее тянется к популяции', () => {
    const clean = shrinkMVT(1.1, 1.3, 2, 1.0)!;
    const noisy = shrinkMVT(1.1, 1.3, 2, 0.5)!;
    expect(noisy.mvt).toBeGreaterThan(clean.mvt);
    expect(clean.mvt).toBe(1.2);
  });
  it('qPoints: коридор и флоры', async () => {
    const { qPoints } = await import('../strength-sport-ta-progress.engine');
    const q = qPoints(315, 89, 'male')!;
    expect(q).toBeGreaterThan(350);
    expect(q).toBeLessThan(450);
    expect(qPoints(200, 40, 'male')).toBeNull();
    expect(qPoints(150, 30, 'female')).toBeNull();
    const qf = qPoints(246, 59, 'female')!;
    expect(qf).toBeGreaterThan(300);
  });
  it('bridge: taAttempts/taSinclair/taSpecWeeks парсятся', async () => {
    const { parseSmBridgePayload } = await import('../../../ui/screens/strength-sport/sm-bridge-intake');
    const p = parseSmBridgePayload({ taAttempts: { snatch: [90, 96, 102], cj: [112, 0, -5] }, taSinclair: { total: 229, value: 260.5, cycle: '2025-2028', q: 281.3 }, taSpecBlock: { totalWeeks: 6 } });
    expect(p.taAttempts).toEqual({ snatch: [90, 96, 102], cj: [112] });
    expect(p.taSinclair?.value).toBe(260.5);
    expect(p.taSpecWeeks).toBe(6);
    expect(parseSmBridgePayload({}).taAttempts).toBeNull();
  });
  it('bridge П1: остаток payload (причины/коррекции/FvR/асимметрия/OHS)', async () => {
    const { parseSmBridgePayload } = await import('../../../ui/screens/strength-sport/sm-bridge-intake');
    const p = parseSmBridgePayload({
      taPreferredCorr: { snatch_mid: 'pause_snatch', junk: 123 as any },
      taWeakCauses: { snatch_mid: 'technique', clean_catch: 'mobility' },
      fvr: { snatchTh: 102.5, Pmax: 3100 },
      asymmetry: 8.3,
      ohs: { totalScore: 4, failed: 2 },
    });
    expect(p.taPreferredCorr).toEqual({ snatch_mid: 'pause_snatch' });
    expect(p.taWeakCauses).toEqual({ snatch_mid: 'technique', clean_catch: 'mobility' });
    expect(p.taFvr).toEqual({ snatchTh: 102.5, pmax: 3100 });
    expect(p.taAsymPct).toBe(8.3);
    expect(p.taOhsFailed).toBe(2);
    const empty = parseSmBridgePayload({});
    expect(empty.taPreferredCorr).toBeNull();
    expect(empty.taFvr).toBeNull();
    expect(empty.taAsymPct).toBeNull();
  });
  it('П2: Sinclair 2025-2028 — эталонные примеры (коэфф. ±1e-5, тотал ±0.005 — округление витрины/констант)', async () => {
    const { sinclairCoefficient, sinclairTotal } = await import('../strength-sport-ta-progress.engine');
    expect(sinclairCoefficient(73, 'male', '2025-2028')).toBeCloseTo(1.367106, 5);
    expect(sinclairTotal(315, 73, 'male', '2025-2028')).toBeCloseTo(430.638, 2);
    expect(sinclairCoefficient(89, 'male', '2025-2028')).toBeCloseTo(1.224310, 5);
    expect(sinclairTotal(345, 89, 'male', '2025-2028')).toBeCloseTo(422.387, 2);
    expect(sinclairCoefficient(59, 'female', '2025-2028')).toBeCloseTo(1.357552, 5);
    expect(sinclairTotal(210, 59, 'female', '2025-2028')).toBeCloseTo(285.086, 2);
    expect(sinclairCoefficient(71, 'female', '2025-2028')).toBeCloseTo(1.227460, 5);
    expect(sinclairTotal(235, 71, 'female', '2025-2028')).toBeCloseTo(288.453, 2);
  });
  it('П3: Q-points тренд/best как у Sinclair', async () => {
    const { taProgressTrend } = await import('../strength-sport-ta-progress.engine');
    const hist = [
      { date: '2026-01-01', bodyweightKg: 89, snatchKg: 100, cleanJerkKg: 125 },
      { date: '2026-03-01', bodyweightKg: 89, snatchKg: 105, cleanJerkKg: 130 },
    ];
    const t = taProgressTrend(hist, 'male', '2025-2028')!;
    expect(t.qDelta).toBeGreaterThan(0);
    expect(t.bestQ).toBeCloseTo(293.23, 1);
    expect(t.bestQDate).toBe('2026-03-01');
    expect(t.bestSinclair).toBeGreaterThan(0);
  });
  it('П4: posterior между индивидом и популяцией, честный SD', async () => {
    const { mvtPosterior, TA_POPULATION_MVT } = await import('../strength-sport-ta-mvt.engine');
    const mk = (spread: number) => ({
      slope: -1.5, intercept: 3.0,
      points: [
        { pct: 0.5, velocity: 2.25 + spread },
        { pct: 0.65, velocity: 2.025 - spread },
        { pct: 0.8, velocity: 1.8 + spread },
        { pct: 0.9, velocity: 1.65 - spread },
      ],
    });
    const clean = mvtPosterior(mk(0.01) as any)!;
    const noisy = mvtPosterior(mk(0.09) as any)!;
    expect(clean).not.toBeNull();
    expect(noisy).not.toBeNull();
    // Чистый профиль ближе к индивиду (1.5), шумный — сильнее к популяции (1.3)
    expect(Math.abs(clean.mvt - 1.5)).toBeLessThan(Math.abs(noisy.mvt - 1.5));
    expect(noisy.sd).toBeGreaterThanOrEqual(clean.sd);
    expect(clean.sd).toBeGreaterThan(0);
    expect(mvtPosterior(null)).toBeNull();
    expect(mvtPosterior({ slope: -1.5, intercept: 3.0, points: [{ pct: 0.5, velocity: 2 }] } as any)).toBeNull();
    expect(TA_POPULATION_MVT).toBe(1.3);
  });
  it('П5: impulseVerdict по нормам Bustamante 2024', async () => {
    const { impulseVerdict } = await import('../strength-sport-ta-imtp.engine');
    expect(impulseVerdict(281, 'male')).toMatch(/ориентире/);
    expect(impulseVerdict(150, 'male')).toMatch(/ниже/);
    expect(impulseVerdict(400, 'male')).toMatch(/выше/);
    expect(impulseVerdict(199, 'female')).toMatch(/ориентире/);
    expect(impulseVerdict(null)).toBeNull();
  });
  it('IPST-добойка: ratio + слабое звено каждой позиции', async () => {
    const { diagnoseTAImtp } = await import('../strength-sport-ta-imtp.engine');
    const bw = 90;
    const base = { bodyweightKg: bw, peakForceN: 3500 };
    const t = diagnoseTAImtp({ ...base, ipstPeakN: 2800 })!;
    expect(t.ipstRatio).toBeCloseTo(0.8, 2);
    expect(t.weakLink).toBe('transition');
    expect(t.chainNote).toMatch(/transition/);
    const floor = diagnoseTAImtp({ ...base, ifpPeakN: 1500, ipstPeakN: 3000 })!;
    expect(floor.weakLink).toBe('floor');
    expect(floor.chainNote).toMatch(/пол/);
    const trans = diagnoseTAImtp({ ...base, ifpPeakN: 2200, ipstPeakN: 1500 })!;
    expect(trans.weakLink).toBe('transition');
    const power = diagnoseTAImtp({ bodyweightKg: bw, peakForceN: 2000, ifpPeakN: 2200, ipstPeakN: 2100 })!;
    expect(power.weakLink).toBe('power');
    expect(power.chainNote).toMatch(/power/);
    expect(diagnoseTAImtp({ bodyweightKg: bw, ipstPeakN: 2000 })!.weakLink).toBeNull();
  });
});
