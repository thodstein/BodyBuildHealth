import { describe, it, expect, beforeEach } from 'vitest';
import { parseArmTrackCsv, armPathMetrics, classifyArmTrajectory, isArmRealChange } from '../arm-video-analysis.engine';
import { diagnoseVbt, vbtForExercise, thresholdsFor } from '../arm-vbt-capture.engine';
import { assessArmMobility, mobilityFailForWeakPoint } from '../arm-mobility.engine';
import { autoregArmFromDiary } from '../arm-diary-autoreg.engine';
import { checkUCLGuard, checkShoulderGuard, checkTendonGuard } from '../arm-injury-guard.engine';
import { planBilateralVolume, isBilateralBalanced, bilateralTrend } from '../arm-bilateral.engine';

const CSV = 't,x,y\n0,0,0\n0.5,3,1\n1.0,8,2\n1.5,2,3';

describe('arm P1 E8: video', () => {
  it('parse CSV t,x,y (запятая)', () => {
    const pts = parseArmTrackCsv(CSV);
    expect(pts.length).toBe(4);
    expect(pts[0]).toEqual({ t: 0, x: 0, y: 0 });
  });
  it('parse CSV точка с запятой + мусор', () => {
    const pts = parseArmTrackCsv('t;x;y\n0;1;2\nмусор\n1;3;4');
    expect(pts.length).toBe(2);
  });
  it('метрики + тип наружу = toproll', () => {
    const pts = parseArmTrackCsv('t,x,y\n0,0,0\n0.5,1,1\n1.0,5,2\n1.5,9,3');
    const m = armPathMetrics(pts)!;
    expect(m.xLoop).toBe(9);
    expect(m.points).toBe(4);
    expect(classifyArmTrajectory(pts)).toBe('outside_toproll');
  });
  it('SRD 4: Δ>4 реально, Δ≤4 шум', () => {
    const pts = parseArmTrackCsv(CSV);
    const m = armPathMetrics(pts)!;
    expect(isArmRealChange({ xLoop: 0, yMax: 0, vMax: 0, points: 0 }, m)).toBe(true);
    expect(isArmRealChange({ xLoop: 7, yMax: 0, vMax: 0, points: 0 }, m)).toBe(false);
  });
});

describe('arm P1 E9: vbt weakPoint', () => {
  it('legacy intact: wrist 20/30, grip 15/25', () => {
    expect(vbtForExercise('wrist_curl_belt')).toEqual({ warnPct: 20, stopPct: 30 });
    expect(vbtForExercise('rolling_thunder')).toEqual({ warnPct: 15, stopPct: 25 });
  });
  it('thresholdsFor weakPoint приоритетнее: pron_open 15/25', () => {
    expect(thresholdsFor('wrist_curl_belt', 'pron_open')).toEqual({ warnPct: 15, stopPct: 25 });
  });
  it('thresholdsFor side_mid 10/20', () => {
    expect(thresholdsFor('side_press_cable', 'side_mid')).toEqual({ warnPct: 10, stopPct: 20 });
  });
  it('diagnoseVbt с weakPoint: потеря 16% pron = warn (legacy wrist был бы ok)', () => {
    const recs = (v: number) => [{ weight: 30, reps: 5, velocityMs: v, exerciseId: 'wrist_curl_belt', weakPoint: 'pron_open' }];
    const r = diagnoseVbt([recs(1.0)[0], recs(0.84)[0]]);
    expect(r.zone).toBe('warn');
    expect(r.velocityLossPct).toBe(16);
  });
});

describe('arm P1 E10: mobility', () => {
  it('всё ок → score 100, fails []', () => {
    const r = assessArmMobility({ wristFlexOk: true, wristExtOk: true, pronOk: true, supOk: true, elbowExtOk: true });
    expect(r.score).toBe(100);
    expect(r.fails).toEqual([]);
  });
  it('провал кисти + локтя → fails wrist/elbow', () => {
    const r = assessArmMobility({ wristFlexOk: false, wristExtOk: true, pronOk: true, supOk: true, elbowExtOk: false });
    expect(r.fails).toContain('wrist');
    expect(r.fails).toContain('elbow');
    expect(r.score).toBeLessThan(100);
  });
  it('retest better → хинт про кисть', () => {
    const r = assessArmMobility({ wristFlexOk: true, wristExtOk: true, pronOk: true, supOk: true, elbowExtOk: true, reverseRetest: 'better' });
    expect(r.retestHint).toContain('кисть');
  });
  it('fail→точка: wrist зажигает cup, не зажигает side без elbow', () => {
    expect(mobilityFailForWeakPoint(['wrist'], 'cup_start')).toBe(true);
    expect(mobilityFailForWeakPoint(['wrist'], 'side_mid')).toBe(false);
    expect(mobilityFailForWeakPoint(['elbow'], 'side_mid')).toBe(true);
  });
  it('пусто → false', () => {
    expect(mobilityFailForWeakPoint([], 'pron_open')).toBe(false);
  });
});

describe('arm P1 E11: autoreg + guards', () => {
  it('пустой дневник → нейтрально', () => {
    const r = autoregArmFromDiary([]);
    expect(r.volumeMult).toBe(1);
    expect(r.rirShift).toBe(0);
  });
  it('sRPE 9 → объём 0.65, RIR+2, +день', () => {
    const r = autoregArmFromDiary([{ dateIso: '2026-09-01', srpe: 9 }]);
    expect(r.volumeMult).toBe(0.65);
    expect(r.rirShift).toBe(2);
    expect(r.extraRestDays).toBe(1);
  });
  it('боль 7 → 0.5 + Side→iso + Pron→pulses', () => {
    const r = autoregArmFromDiary([{ dateIso: '2026-09-01', srpe: 5, elbowPain: 7 }]);
    expect(r.volumeMult).toBe(0.5);
    expect(r.replaceSideWithIso).toBe(true);
    expect(r.replaceHeavyPronWithPulses).toBe(true);
  });
  it('UCL guard: новичок side>2 первые 3н', () => {
    const plan: any = { level: 'beginner', weeks: [{ week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 4 }] }] }] };
    expect(checkUCLGuard(plan).length).toBeGreaterThan(0);
  });
  it('tendon guard: >22 critical', () => {
    const plan: any = { weeks: [{ week: 1, sessions: [{ exercises: [{ muscle: 'pronators', sets: 23 }] }] }] };
    const w = checkTendonGuard(plan);
    expect(w.join(' ')).toContain('CRITICAL');
    expect(checkShoulderGuard({ weeks: [{ sessions: [{ exercises: [] }] }] } as any)).toEqual([]);
  });
});

describe('arm P1 E12: bilateral', () => {
  it('асимметрия 20% → слабая +25%, в MRV', () => {
    const p = planBilateralVolume({ leftKg: 40, rightKg: 50, baseSets: 10, mrvSets: 18 });
    expect(p.asymmetryPct).toBe(20);
    expect(p.weakArm).toBe('left');
    expect(p.weakSets).toBeGreaterThan(p.strongSets);
    expect(isBilateralBalanced(p)).toBe(true);
  });
  it('нет данных → поровну', () => {
    const p = planBilateralVolume({});
    expect(p.weakArm).toBeNull();
    expect(p.weakSets).toBe(p.strongSets);
  });
  it('тренд истории: падение % → improving', () => {
    const t = bilateralTrend([
      { date: '2026-08-01', leftKg: 40, rightKg: 50, asymmetryPct: 20 },
      { date: '2026-09-01', leftKg: 46, rightKg: 50, asymmetryPct: 8 },
    ])!;
    expect(t.improving).toBe(true);
    expect(bilateralTrend([{ date: '2026-09-01', leftKg: 40, rightKg: 50, asymmetryPct: 20 }])).toBeNull();
  });
});

describe('arm P1: localStorage-history (jsdom)', () => {
  beforeEach(() => { localStorage.clear(); });
  it('applyMobility пишет he_profile_v2 без затирания', async () => {
    const { applyArmMobilityToProfile } = await import('../arm-mobility.engine');
    localStorage.setItem('he_profile_v2', JSON.stringify({ health: { chronic: 1 }, training: {} }));
    applyArmMobilityToProfile(['wrist']);
    const p = JSON.parse(localStorage.getItem('he_profile_v2')!);
    expect(p.health.mobilityRestrictions).toContain('wrist');
    expect(p.health.chronic).toBe(1);
  });
});
