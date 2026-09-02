import { describe, it, expect } from 'vitest';
import { buildDynamicReport, calcDynamicMetrics, calcAsymmetry } from '../arm-dynamic-force.engine';
import { resolveArmLevelByTests, wafWeightClassFor, benchLevelFor, ARM_BENCHMARKS } from '../arm-benchmarks.engine';
import { buildWeeklyStats, fatigueTrend, forceTrend, weeklyForceAdvice } from '../arm-force-history.store';
import { estimateForceVector, getRtWorldClass, getSideRef } from '../arm-force-capture.engine';
import { buildArmDiagnosticsReport } from '../arm-diagnostics-hub.engine';
import { estimateAnglesFromLandmarks, angleBetween, isAnglesVerified, validateArmAngles, estimateArmAngles } from '../arm-motion-capture.engine';
import { ARM_EXERCISES } from '../../../core/exercise-catalog-arm';
import { buildArmAcwr } from '../arm-acwr.engine';
import { buildArmPlan } from '../arm-builder.engine';

// ── Dynamic force (Bezkorovainyi) ──
describe('arm PRO MAX v2 — dynamic force', () => {
  it('calc F/t и F100/F500', () => {
    const m = calcDynamicMetrics({ exercise: 'finger_flex', forceKg: 60, timeMs: 1200, bwKg: 80 });
    expect(m.fMax).toBe(60);
    expect(m.fRel).toBeCloseTo(0.75, 1);
    expect(m.ftIndex).toBeGreaterThan(40);
    expect(m.f100).toBeGreaterThan(10);
    expect(m.f500).toBeGreaterThan(m.f100);
    expect(m.explosivePct).toBeGreaterThan(15);
  });
  it('F100 задан явно', () => {
    const m = calcDynamicMetrics({ exercise: 'hook', forceKg: 50, timeMs: 900, f100Kg: 30, bwKg: 80 });
    expect(m.f100).toBe(30);
  });
  it('buildDynamicReport 4 теста', () => {
    const r = buildDynamicReport([
      { exercise: 'finger_flex', forceKg: 40, timeMs: 1000, bwKg: 80 },
      { exercise: 'hammer', forceKg: 45, timeMs: 1100, bwKg: 80 },
      { exercise: 'hook', forceKg: 55, timeMs: 900, bwKg: 80 },
      { exercise: 'cup', forceKg: 50, timeMs: 800, bwKg: 80 },
    ]);
    expect(r.avgFt).not.toBeNull();
    expect(r.totalF).toBeGreaterThan(150);
    expect(r.tactic).toBeTruthy();
  });
  it('асимметрия L/R ok/warn/critical', () => {
    const a1 = calcAsymmetry([{ exercise: 'hook', forceKg: 50, timeMs: 1000, hand: 'left' } as any, { exercise: 'hook', forceKg: 52, timeMs: 1000, hand: 'right' } as any]);
    expect(a1!.level).toBe('ok');
    const a2 = calcAsymmetry([{ exercise: 'hook', forceKg: 45, timeMs: 1000, hand: 'left' } as any, { exercise: 'hook', forceKg: 50, timeMs: 1000, hand: 'right' } as any]);
    expect(a2!.level).toBe('warn'); // 10%
    const a3 = calcAsymmetry([{ exercise: 'hook', forceKg: 40, timeMs: 1000, hand: 'left' } as any, { exercise: 'hook', forceKg: 50, timeMs: 1000, hand: 'right' } as any]);
    expect(a3!.level).toBe('critical'); // 20%
  });
  it('асимметрия в buildDynamicReport через left/right grip', () => {
    const r = buildDynamicReport([
      { exercise: 'hook', forceKg: 40, timeMs: 1000, bwKg: 80, hand: 'left' } as any,
      { exercise: 'hook', forceKg: 50, timeMs: 1000, bwKg: 80, hand: 'right' } as any,
    ]);
    expect(r.asymmetry).not.toBeNull();
    expect(r.asymmetry!.asymmetryPct).toBe(20);
  });
});

// ── Benchmarks ──
describe('arm PRO MAX v2 — benchmarks', () => {
  it('wrist curl thresholds', () => {
    const d = ARM_BENCHMARKS.find(x=>x.id==='wrist_curl_1rm_lb')!;
    expect(benchLevelFor(20, d)).toBe('beginner');
    expect(benchLevelFor(30, d)).toBe('intermediate');
    expect(benchLevelFor(50, d)).toBe('advanced');
    expect(benchLevelFor(75, d)).toBe('competitive');
  });
  it('resolve intermediate vs advanced', () => {
    const b = resolveArmLevelByTests({ wristCurlLb: 50, pronHoldSec: 30, cupHoldSec: 35, cocLevel: 1.5, rtKg: 80, sideKg: 40, bwKg: 80 });
    expect(['advanced','competitive']).toContain(b.level);
  });
  it('beginner if empty', () => {
    const b = resolveArmLevelByTests({});
    expect(b.level).toBe('beginner');
  });
  it('WAF class', () => {
    expect(wafWeightClassFor(55)).toBe('55');
    expect(wafWeightClassFor(82)).toBe('85');
    expect(wafWeightClassFor(115)).toBe('110+');
  });
});

// ── Force history ──
describe('arm PRO MAX v2 — force history 12 нед', () => {
  it('weekly stats avg/max/min fatigue', () => {
    const trials = [
      { exercise: 'hook', forceKg: 50, timeMs: 1000, dateIso: '2026-01-05' } as any,
      { exercise: 'hook', forceKg: 55, timeMs: 900, dateIso: '2026-01-06' } as any,
      { exercise: 'hook', forceKg: 60, timeMs: 850, dateIso: '2026-01-12' } as any,
      { exercise: 'hook', forceKg: 62, timeMs: 800, dateIso: '2026-01-19' } as any,
    ];
    const stats = buildWeeklyStats(trials, 12);
    expect(stats.length).toBeGreaterThanOrEqual(3);
    expect(stats[0].avg).toBeGreaterThan(0);
    expect(stats[0].max).toBeGreaterThanOrEqual(stats[0].min);
  });
  it('fatigueTrend improving', () => {
    const stats = [
      { week:1, weekStartIso:'2026-01-05', avg:200, max:250, min:180, fatiguePct:10, trials:2 },
      { week:2, weekStartIso:'2026-01-12', avg:220, max:270, min:200, fatiguePct:7, trials:2 },
      { week:3, weekStartIso:'2026-01-19', avg:260, max:310, min:240, fatiguePct:4.5, trials:2 },
    ] as any;
    const ft = fatigueTrend(stats)!;
    expect(ft.improving).toBe(true);
    expect(ft.delta).toBeLessThan(0);
  });
  it('forceTrend avgDelta', () => {
    const stats = [
      { week:1, weekStartIso:'2026-01-05', avg:200, max:250, min:180, fatiguePct:10, trials:2 },
      { week:12, weekStartIso:'2026-03-23', avg:260, max:310, min:240, fatiguePct:4.5, trials:2 },
    ] as any;
    const tr = forceTrend(stats)!;
    expect(tr.avgDelta).toBe(60);
    expect(tr.maxDelta).toBe(60);
  });
  it('weeklyForceAdvice', () => {
    const stats = [{ week:1, weekStartIso:'2026-01-05', avg:200, max:250, min:180, fatiguePct:16, trials:2 }] as any;
    const adv = weeklyForceAdvice(stats);
    expect(adv.some(x=>x.includes('Fatigue >15%'))).toBe(true);
  });
});

// ── Force vector PRO (WR 130.5/77.2, WAF, asymmetry) ──
describe('arm PRO MAX v2 — force vector', () => {
  it('WR M 130.5 vs F 77.2', () => {
    expect(getRtWorldClass('male')).toBe(130.5);
    expect(getRtWorldClass('female')).toBe(77.2);
  });
  it('sideRef WAF scaling', () => {
    const r55 = getSideRef(55, '55');
    const r110 = getSideRef(110, '110');
    expect(r110).toBeGreaterThan(r55);
    expect(r55).toBeCloseTo(55*0.55, 0);
  });
  it('asymmetryPct from left/right', () => {
    const v = estimateForceVector({ rtKg: 80, leftKg: 40, rightKg: 50 } as any);
    expect(v.asymmetryPct).toBe(20);
  });
  it('RT 55 → 50 preserved after WR update', () => {
    const v = estimateForceVector({ rtKg: 55 });
    expect(v.gripSupport).toBeGreaterThanOrEqual(45);
    expect(v.gripSupport).toBeLessThanOrEqual(55);
  });
});

// ── Diagnostics hub RSS + verification ──
describe('arm PRO MAX v2 — diagnostics hub', () => {
  it('RSS score: 3 warn vs 1 critical', () => {
    const r1 = buildArmDiagnosticsReport({ weakTest:{cupFails:true}, grip:{}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    const r2 = buildArmDiagnosticsReport({ weakTest:{cupFails:true, pronationFails:true, sidePressureFails:true}, grip:{rtKg:30}, level:'beginner', technique:'hook', tableSessions:0, totalSessions:4, tendonSets:20 });
    expect(r1.score).toBeGreaterThan(r2.score);
    expect(r2.score).toBeGreaterThanOrEqual(0);
  });
  it('verification 0.4+0.3+0.3 and legacy 0.5', () => {
    const rLegacy = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:60}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(rLegacy.verification).toBe(0.5);
    const rFull = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:60}, vbtRecords:[{weight:50,reps:5,velocityMs:0.8},{weight:50,reps:5,velocityMs:0.5}], level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8, anglesVerified:true } as any);
    expect(rFull.verification).toBeGreaterThanOrEqual(0.9);
  });
  it('asymmetry finding added', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:60, leftKg:40, rightKg:50} as any, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.asymmetryPct).toBe(20);
    expect(r.findings.some(f=>f.text.includes('Асимметрия'))).toBe(true);
  });
  it('humerus uses actualPlan if provided', () => {
    const plan: any = { weeks:[{ week:1, sessions:[{ exercises:[{muscle:'side_pressure', sets:9}]}]},{ week:2, sessions:[{ exercises:[{muscle:'side_pressure', sets:10}]}]}] };
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8, actualPlan: plan } as any);
    expect(r.humerusWarnings.length).toBeGreaterThan(0);
  });
});

// ── Motion capture landmarks ──
describe('arm PRO MAX v2 — motion capture', () => {
  it('angleBetween 90', () => {
    const a = angleBetween({x:0,y:0},{x:1,y:0},{x:1,y:1});
    expect(a).toBe(90);
  });
  it('estimateAnglesFromLandmarks', () => {
    const f = estimateAnglesFromLandmarks({ shoulder:{x:0,y:0}, elbow:{x:1,y:0}, wrist:{x:2,y:0}, hand:{x:3,y:0.1}, thumb:{x:2.1,y:0.2}, little:{x:2.1,y:-0.2} });
    expect(f.elbowDeg).toBeGreaterThan(150);
    expect(f.direction).toBeDefined();
  });
  it('isAnglesVerified true for valid', () => {
    const a = estimateArmAngles({ elbowDeg:110, forearmDeg:90, wristDeg:10, direction:'to_middle' });
    expect(isAnglesVerified(a)).toBe(true);
  });
  it('validate extra forearm warning', () => {
    const a = estimateArmAngles({ elbowDeg:90, forearmDeg:170, wristDeg:10, direction:'to_middle' });
    // 170 forearm → pron 80 but elbow 90 +170 triggers extra warning
    const v = validateArmAngles(a);
    expect(v.warnings.some(w=>w.includes('UCL'))).toBe(true);
  });
});

// ── Tendon ACWR ──
describe('arm PRO MAX v2 — tendon ACWR', () => {
  it('buildArmAcwr overall+tendon', () => {
    const now = new Date();
    const iso = (d: Date)=> d.toISOString().slice(0,10);
    // 30 дней ежедневных сессий sRPE 7×60мин = 420
    const sessions: any[] = [];
    for (let i=0;i<28;i++){ const d=new Date(now); d.setDate(now.getDate()-27+i); sessions.push({ dateIso: iso(d), sRpe:7, durationMin:60, isTendon:true, isTable:i%2===0 }); }
    const r = buildArmAcwr({ sessions });
    expect(r.overall.ratio).toBeGreaterThan(0);
    expect(r.tendon).not.toBeNull();
    expect(r.tablePct).toBeGreaterThanOrEqual(40);
  });
  it('empty → optimal', () => {
    const r = buildArmAcwr({ sessions: [] });
    expect(r.overall.zone).toBe('optimal');
  });
});

// ── Catalog 72 ──
describe('arm PRO MAX v2 — catalog 72', () => {
  it('72 упражнения', () => {
    expect(ARM_EXERCISES.length).toBeGreaterThanOrEqual(72);
  });
  it('есть ArmliftingUSA 12', () => {
    const ids = ARM_EXERCISES.map(e=>e.id);
    expect(ids).toContain('country_crush_2');
    expect(ids).toContain('grandfather_clock');
    expect(ids).toContain('raptor_3');
    expect(ids).toContain('inch_dumbbell');
    expect(ids).toContain('wrist_wrench_60');
    expect(ids).toContain('euro_pinch_2h');
    expect(ids).toContain('blockbuster_pinch');
    expect(ids).toContain('anvil_hub');
    expect(ids).toContain('flask_1h');
    expect(ids).toContain('napalm_handle_60');
  });
  it('validate no errors', () => {
    const ids = new Set<string>();
    for (const ex of ARM_EXERCISES) {
      expect(ids.has(ex.id)).toBe(false);
      ids.add(ex.id);
      expect(ex.movementPattern).toBeTruthy();
      expect(ex.substitutionGroup).toBeTruthy();
    }
  });
});

// ── Builder still PRO ──
describe('arm PRO MAX v2 — builder integration', () => {
  it('72 catalog does not break builder', () => {
    const p = buildArmPlan({ discipline:'armlifting', patternId:'grip_3_support', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    expect(p.weeks.length).toBe(4);
    expect(p.weeks[0].sessions.length).toBeGreaterThan(0);
  });
});
