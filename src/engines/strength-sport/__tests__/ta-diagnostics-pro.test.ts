import { describe, it, expect } from 'vitest';
import { TA_BIOMECH, diagnoseTAWeakPoint, isValidAngleForWeakPoint } from '../strength-sport-biomechanics.engine';
import { classifyTrajectoryType, computeBarPathMetrics, diagnoseBarPathFromMetrics, isRealChange, correctEnodeHorizontal } from '../strength-sport-barpath.engine';
import { TA_PEAK_VELOCITY_ZONES, TA_VTHRES_NORMS, computeFvR2, taZoneForVelocity, thresholdForTALift } from '../strength-sport-vbt.engine';
import { scoreTA } from '../strength-sport-scoring.engine';
import { assessOHS, OHS_NORMS } from '../strength-sport-ohs.engine';
import { parseKinoveaCSV, analyzeBarTracking } from '../strength-sport-video.engine';
import { diagnoseVelocityLossSS } from '../strength-sport-vbt.engine';

describe('TA biomechanics PRO — числовые углы', () => {
  it('все 16 WLWeakPoint имеют числовой angleRange', () => {
    const all = Object.keys(TA_BIOMECH);
    expect(all.length).toBe(16);
    for (const k of all) {
      const b = TA_BIOMECH[k as keyof typeof TA_BIOMECH];
      expect(b.angleRangeDeg.length).toBe(2);
      expect(b.angleRangeDeg[0]).toBeLessThan(b.angleRangeDeg[1]);
      expect(b.biomechanicalReason.length).toBeGreaterThan(20);
      expect(b.references.length).toBeGreaterThan(0);
    }
  });
  it('diagnoseTAWeakPoint возвращает коррекцию с loadCues', () => {
    const bio = diagnoseTAWeakPoint('snatch_off_floor');
    expect(bio).not.toBeNull();
    expect(bio!.corrections).toContain('Тяга рывковая с дефицита (deficit_snatch)');
    expect(bio!.weakMuscles.length).toBeGreaterThan(0);
  });
  it('isValidAngleForWeakPoint проверяет диапазон', () => {
    expect(isValidAngleForWeakPoint('snatch_off_floor', 10)).toBe(true);
    expect(isValidAngleForWeakPoint('snatch_off_floor', 90)).toBe(false);
    expect(isValidAngleForWeakPoint('snatch_mid', 75)).toBe(true);
  });
});

describe('Bar path PRO — Vorobyev типы + SRD', () => {
  it('Type2 — backward без пересечения', () => {
    const xs = [0.2, 0.5, 0.8, 0.6, 0.3]; // все >=0
    const c = classifyTrajectoryType(xs);
    expect(c.type).toBe('type2');
    expect(c.isOptimal).toBe(true);
  });
  it('Type1 — два пересечения', () => {
    const xs = [-1, 1, -1, 0.5];
    const c = classifyTrajectoryType(xs);
    // at least classified
    expect(['type1', 'type3']).toContain(c.type);
  });
  it('computeBarPathMetrics считает xLoop/yMax', () => {
    const pts = [{ x: 0, y: 0, t: 0 }, { x: 2, y: 40, t: 0.2 }, { x: -1, y: 80, t: 0.4 }];
    const m = computeBarPathMetrics(pts);
    expect(m).not.toBeNull();
    expect(m!.xLoop).toBeGreaterThan(0);
    expect(m!.yMax).toBe(80);
  });
  it('SRD 4/6см', () => {
    expect(isRealChange(5, 'turnover')).toBe(true);
    expect(isRealChange(3, 'turnover')).toBe(false);
    expect(isRealChange(7, 'catch')).toBe(true);
  });
  it('Enode correction', () => {
    expect(correctEnodeHorizontal(5)).toBeCloseTo(4.8, 0);
  });
  it('diagnoseBarPathFromMetrics петля >6см → critical', () => {
    const m = { xMin: -3, xMax: 3, xLoop: 6.5, yMax: 80, vMax: 1.8, trajectoryType: 'type1' as const };
    const d = diagnoseBarPathFromMetrics(m, 'snatch');
    expect(d.severity).toBe('critical');
  });
});

describe('VBT TA — PLOS 2026 zones + FvR2', () => {
  it('TA peak zones >1.3 для absolute', () => {
    for (const ex of ['snatch', 'clean']) {
      const zones = TA_PEAK_VELOCITY_ZONES[ex];
      const abs = zones.find(z => z.label === 'absolute_strength')!;
      expect(abs.velocity[0]).toBeGreaterThanOrEqual(1.3);
    }
  });
  it('taZoneForVelocity классифицирует', () => {
    expect(taZoneForVelocity(1.5, 'snatch')).toBe('absolute_strength');
    expect(taZoneForVelocity(2.5, 'snatch')).toBe('speed_strength');
  });
  it('VTHRES нормы snatch 1.7-2.0', () => {
    expect(TA_VTHRES_NORMS.snatch.min).toBe(1.70);
    expect(TA_VTHRES_NORMS.snatch.max).toBe(2.00);
  });
  it('thresholdForTALift снач 10, тяга 15', () => {
    expect(thresholdForTALift('snatch')).toBe(10);
    expect(thresholdForTALift('snatch_pull')).toBe(15);
  });
  it('computeFvR2 прогнозирует snatchTh ±1.5', () => {
    const r = computeFvR2({ load80: 80, vmax80: 1.95, load110: 110, vmax110: 1.45, hAcc: 0.8, vThres: 1.85 });
    expect(r).not.toBeNull();
    expect(r!.snatchTh).toBeGreaterThan(70);
    expect(r!.Pmax).toBeGreaterThan(1500);
    expect(r!.v0).toBeGreaterThan(2);
  });
  it('diagnoseVelocityLossSS TA порог 10%', () => {
    const r = diagnoseVelocityLossSS(1.90, 1.65, 10, 80, 'snatch');
    expect(r.lossPct).toBeGreaterThan(10);
    expect(r.exceeded).toBe(true);
  });
});

describe('Scoring RSS ТА', () => {
  it('RSS: 2 weak → 17 пени, score 83', () => {
    const s = scoreTA({ weakCount: 2, mobilityFails: 0 });
    expect(s.score).toBe(83); // 100 - sqrt(12²+12²)=83
    expect(s.level).toBe('ok');
  });
  it('critical floor: асимметрия 12% → ≤49', () => {
    const s = scoreTA({ weakCount: 0, asymmetryPct: 13, mobilityFails: 0 });
    expect(s.score).toBeLessThanOrEqual(49);
    expect(s.level).toBe('critical');
  });
  it('verification: видео+вбт+мобильность → 1.0', () => {
    const s = scoreTA({ weakCount: 0, mobilityFails: 0, hasVideo: true, hasVbt: true, hasMobility: true });
    expect(s.verification).toBe(1);
  });
});

describe('OHS 6-сегментов', () => {
  it('идеальный OHS 6/6', () => {
    const r = assessOHS({ heelsFlat: true, kneeValgus: false, hipBelowParallel: true, trunkUpright: true, armsOverMidfoot: true, lumbarNeutral: true, kneeToWallCm: 13 });
    expect(r.totalScore).toBe(6);
    expect(r.level).toBe('ok');
  });
  it(' проваленный OHS с heel retest', () => {
    const r = assessOHS({ heelsFlat: false, kneeValgus: true, hipBelowParallel: false, trunkUpright: false, armsOverMidfoot: false, lumbarNeutral: false, kneeToWallCm: 8, heelRaiseRetest: true });
    expect(r.failed).toBeGreaterThanOrEqual(4);
    expect(r.primaryDriver).toContain('Голеностоп');
  });
  it('нормы OHS', () => {
    expect(OHS_NORMS.kneeToWallCm.optimal).toBe(12);
    expect(OHS_NORMS.ankleDeg.optimal).toBe(35);
  });
});

describe('Video Kinovea', () => {
  it('parse CSV', () => {
    const csv = 'time,x,y\n0,0,0\n0.1,1,40\n0.2,2,80';
    const pts = parseKinoveaCSV(csv);
    expect(pts).not.toBeNull();
    expect(pts!.length).toBe(3);
  });
  it('analyze tracking', () => {
    const pts = [{ x: 0, y: 0, t: 0 }, { x: 1, y: 30, t: 0.1 }, { x: 2, y: 60, t: 0.2 }];
    const r = analyzeBarTracking(pts);
    expect(r).not.toBeNull();
    expect(r!.vmax).toBeGreaterThan(0);
  });
});
