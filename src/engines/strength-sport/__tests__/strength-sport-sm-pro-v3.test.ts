import { describe, it, expect } from 'vitest';
import { diagnoseSMWeakCause } from '../strength-sport-sm-weak-cause.engine';
import { rankCorrectionsForSM, smCorrIdFromLabel } from '../strength-sport-sm-correction-rank.engine';
import { simulateSMCorrection } from '../strength-sport-sm-simulator.engine';
import { buildSMSpecBlock } from '../strength-sport-sm-spec-block.engine';
import { auditSMPlan, hubTabForSMPhase } from '../strength-sport-sm-plan-audit.engine';
import { diagnoseSMAnthro } from '../strength-sport-sm-anthro.engine';
import { diagnoseSMGripAsymmetry, appendSMGripSnapshot, smGripTrend } from '../strength-sport-sm-asymmetry.engine';
import { diagnoseSMHold } from '../strength-sport-sm-hold.engine';
import { buildSMAttemptsForContest } from '../strength-sport-sm-attempts-bridge.engine';
import { buildSMIcs } from '../strength-sport-sm-ics.engine';
import { buildSMAnnualOverlay } from '../strength-sport-sm-annual-bridge.engine';
import { calibrateSMLVP, smLvpPointsFromRamp, smLvpLiftFor, validateSMLVP } from '../strength-sport-sm-lvp-calibration.engine';
import { appendSMProgress, smProgressTrend } from '../strength-sport-sm-progress.engine';
import { buildSMGripProfile, smGripFailsCalibrated } from '../strength-sport-sm-grip-calibration.engine';
import { heazlewoodCheck, axialMomentCheck, mixedGripCheck } from '../strength-sport-sm-safety.engine';
import { diagnoseLogDip } from '../strength-sport-sm-biomechanics.engine';
import { estimateSME1RM } from '../strength-sport-sm-diary.engine';
import { carryPhysics } from '../strength-sport-carry-physics.engine';
import { stoneMoment } from '../strength-sport-stone-moment.engine';
import { simulateContest } from '../strength-sport-contest-simulator.engine';

describe('SM PRO v3: weak-cause', () => {
  it('grip причина при grip-провале', () => {
    const r = diagnoseSMWeakCause({ zone: 'farmers_grip', gripFails: 2, asymmetryPct: 8 });
    expect(r.cause).toBe('grip');
    expect(r.confidence).toBe('high');
  });
  it('fatigue при ACWR+vbt', () => {
    const r = diagnoseSMWeakCause({ zone: 'yoke_walk', acwrZone: 'dangerous', vbtLossPct: 18 });
    expect(r.cause).toBe('fatigue');
  });
  it('mobility при OHS в чувствительной фазе', () => {
    const r = diagnoseSMWeakCause({ zone: 'yoke_walk', ohsFailed: 3, swayCm: 4 });
    expect(r.cause).toBe('mobility');
  });
  it('volume при 0 сетов', () => {
    const r = diagnoseSMWeakCause({ zone: 'stone_load', factSetsPerWeek: 0 });
    expect(r.cause).toBe('volume');
    expect(r.confidence).toBe('high');
  });
  it('technique fallback', () => {
    const r = diagnoseSMWeakCause({ zone: 'log_lockout' });
    expect(r.cause).toBe('technique');
  });
});

describe('SM PRO v3: correction-rank', () => {
  it('парсит (id) и ранжирует топ-3', () => {
    expect(smCorrIdFromLabel('Толчковый дип (jerk_dip)')).toBe('jerk_dip');
    const top = rankCorrectionsForSM('log_dip');
    expect(top.length).toBeGreaterThan(0);
    expect(top.length).toBeLessThanOrEqual(3);
    expect(top[0].protocol.sets).toBeGreaterThanOrEqual(3);
  });
  it('grip-причина бустит хват', () => {
    const top = rankCorrectionsForSM('farmers_grip', { cause: 'grip' });
    expect(top[0].id).toMatch(/pinch|hang|grip|hammer|fat|plate/i);
  });
  it('мобильность штрафует ankle-demand', () => {
    const a = rankCorrectionsForSM('yoke_walk', { mobilityRestrictions: [] });
    const b = rankCorrectionsForSM('yoke_walk', { mobilityRestrictions: ['ankle'] });
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });
});

describe('SM PRO v3: plan-audit + simulator + spec', () => {
  const plan = {
    workMax: { yokeWalk: 300, atlasStone: 140, logPress: 100 },
    weeksData: [
      { deload: false, sessions: [{ sessionTag: 'event_day', exercises: [{ id: 'yoke_walk', name: 'Йок', sets: 4 }, { id: 'log_press', name: 'Лог', sets: 3 }] }] },
      { deload: false, sessions: [{ sessionTag: 'event_day', exercises: [{ id: 'atlas_stone_load', name: 'Камень', sets: 3 }] }] },
    ],
  } as never;
  it('аудит покрытие + худшая', () => {
    const a = auditSMPlan(plan);
    expect(a.hasPlan).toBe(true);
    expect(a.coveredCount).toBeGreaterThanOrEqual(3);
    expect(a.worstPhase).toBeTruthy();
    expect(hubTabForSMPhase('log_dip')).toBe('press');
    expect(hubTabForSMPhase('yoke_walk')).toBe('carry');
    expect(hubTabForSMPhase('stone_load')).toBe('load');
  });
  it('симуляция Δ carries дистанцией', () => {
    const d = simulateSMCorrection(plan, { weakPoint: 'yoke_walk', corrId: 'sandbag_carry' });
    expect(d).not.toBeNull();
    expect(d!.distanceEstM).toBeGreaterThan(0);
    expect(d!.summary).toContain('покрытие');
  });
  it('симуляция Δ статики тоннажем', () => {
    const d = simulateSMCorrection(plan, { weakPoint: 'log_lockout', corrId: 'pin_press' });
    expect(d!.tonnageEst).toBeGreaterThan(0);
  });
  it('спек-блок волна 6 нед', () => {
    const s = buildSMSpecBlock({ weakPoints: ['yoke_walk', 'stone_load'] as never, weeks: 6 });
    expect(s.totalWeeks).toBe(6);
    expect(s.weeks[0].targetSets.yoke_walk).toBe(3);
    expect(s.weeks[2].targetSets.yoke_walk).toBe(4);
    expect(s.dayMap.yoke_walk).toEqual([2]);
  });
});

describe('SM PRO v3: anthro/asymmetry/hold', () => {
  it('anthro tall vs short', () => {
    const t = diagnoseSMAnthro({ heightCm: 190, armSpanCm: 196, platformCm: 140 });
    expect(t!.platformAdvantage).toBe('tall');
    const s = diagnoseSMAnthro({ heightCm: 172, armSpanCm: 170, platformCm: 150 });
    expect(s!.platformAdvantage).toBe('short');
    expect(t!.tackyHeightCm).toBeGreaterThan(120);
  });
  it('асимметрия 7/12 + тренд', () => {
    expect(diagnoseSMGripAsymmetry({ leftKg: 100, rightKg: 100 })!.isAsym).toBe(false);
    expect(diagnoseSMGripAsymmetry({ leftKg: 90, rightKg: 100 })!.isAsym).toBe(true);
    expect(diagnoseSMGripAsymmetry({ leftKg: 85, rightKg: 100 })!.isCrit).toBe(true);
    const h = appendSMGripSnapshot([], { date: '2026-01-01', left: 90, right: 100, diffPct: 10, metric: 'kg' });
    const h2 = appendSMGripSnapshot(h, { date: '2026-01-08', left: 95, right: 100, diffPct: 5, metric: 'kg' });
    expect(smGripTrend(h2)!.deltaPp).toBeCloseTo(-5, 0);
  });
  it('hold-профили', () => {
    expect(diagnoseSMHold({ bodyweightKg: 105, farmersHoldSec: 30, farmersHoldKg: 105 })!.profile).toBe('grip_deficit');
    expect(diagnoseSMHold({ bodyweightKg: 105, logHoldSec: 5 })!.profile).toBe('overhead_deficit');
    expect(diagnoseSMHold({ bodyweightKg: 105, logHoldSec: 12, farmersHoldSec: 65, axleDohKg: 180, deadliftKg: 220 })!.profile).toBe('balanced');
  });
});

describe('SM PRO v3: attempts/ics/annual/contest-sim', () => {
  it('попытки на контест', () => {
    const r = buildSMAttemptsForContest('uss_105', { yokeKg: 300, farmersKg: 120, stoneKg: 140, logKg: 110 }, 'balanced');
    expect(r).not.toBeNull();
    expect(r!.plans.length).toBeGreaterThan(0);
    expect(r!.rationale.join(' ')).toContain('yoke_walk');
  });
  it('ics + annual overlay', () => {
    const spec = buildSMSpecBlock({ weakPoints: ['yoke_walk'] as never, weeks: 4 });
    expect(buildSMIcs(spec)!.includes('BEGIN:VCALENDAR')).toBe(true);
    const ov = buildSMAnnualOverlay(spec, { startWeek: 5 });
    expect(ov![0].week).toBe(5);
    expect(ov![0].focus).toContain('yoke_walk');
  });
  it('contest sim детерминирован', () => {
    const c = { name: 't', events: [{ id: 'yoke_walk', format: 'medley_distance', weight: 300 }, { id: 'log_press', format: 'max', weight: 100 }] } as never;
    const s = simulateContest(c, { yokeWalk: 320, logPress: 110 } as never, 'balanced');
    expect(s!.totalPoints).toBeGreaterThan(0);
    expect(s!.predictedPlace).toBeGreaterThanOrEqual(1);
    expect(s!.recOrder.length).toBe(2);
  });
});

describe('SM PRO v3: lvp/grip-calib/safety/dip/diary/physics', () => {
  it('lvp ramp + валидация', () => {
    expect(smLvpLiftFor('ЙОК 300')).toBe('yoke_walk');
    const pts = smLvpPointsFromRamp(1.9, 1.6, 1.4, 1.1);
    expect(pts!.length).toBe(4);
    const p = calibrateSMLVP('yoke_walk', pts!);
    expect(p!.slope).toBeLessThan(0);
    expect(validateSMLVP('yoke_walk', pts!).ok).toBe(true);
  });
  it('grip-калибровка порогов', () => {
    const prof = buildSMGripProfile({ pinchWidth: '4in', cocLevel: 'coc2', fatGripMm: 50 });
    expect(prof.pinchSec).toBe(15);
    expect(prof.crushSec).toBe(40);
    expect(smGripFailsCalibrated({ supportSec: 20, pinchSec: 10, crushSec: 20 }, prof)).toBe(3);
    expect(smGripFailsCalibrated({ supportSec: 60, pinchSec: 30, crushSec: 50 }, prof)).toBe(0);
  });
  it('safety: бицепс + axial + mixed', () => {
    expect(heazlewoodCheck({ eventId: 'atlas_stone_load', armsBent: true }).risk).not.toBe('ok');
    expect(heazlewoodCheck({ eventId: 'yoke_walk' }).risk).toBe('ok');
    expect(axialMomentCheck({ yokeKg: 350, bodyweightKg: 100, carryMeters: 400, axialSets: 18 }).risk).toBe('high');
    expect(axialMomentCheck({ yokeKg: 150, bodyweightKg: 100, carryMeters: 40, axialSets: 6 }).risk).toBe('ok');
    expect(mixedGripCheck('mixed', 'axle_deadlift')).toContain('hook');
    expect(mixedGripCheck('overhand', 'axle_deadlift')).toBeNull();
  });
  it('log-dip нормы 8-12', () => {
    expect(diagnoseLogDip(10, 0.2, 105, 100)!.verdict).toBe('ok');
    expect(diagnoseLogDip(16)!.verdict).toBe('critical');
  });
  it('diary LVP-e1RM: carry=вес, stone reps>3 пропуск', () => {
    expect(estimateSME1RM(300, 1, null, 'yoke_walk')).toBe(300);
    expect(estimateSME1RM(140, 5, null, 'atlas_stone_load')).toBeNull();
    expect(estimateSME1RM(100, 2, null, 'log_press')).toBeCloseTo(106.7, 0);
  });
  it('физика: carry + stone', () => {
    const c = carryPhysics({ loadKg: 300, bodyweightKg: 105, type: 'yoke', distanceM: 20 });
    expect(c!.speedMs).toBeGreaterThan(0.5);
    expect(c!.timeS).toBeLessThan(60);
    const m = stoneMoment({ loadKg: 140, diameterCm: 40, torsoAngleDeg: 45 });
    expect(m!.momentNm).toBeGreaterThan(200);
    expect(['ok', 'warn', 'high']).toContain(m!.risk);
  });
  it('прогресс тренд', () => {
    const h = appendSMProgress([], { date: '2026-01-01', bodyweightKg: 105, yoke20mS: 14, logKg: 100, stoneLadderKg: 130 });
    const h2 = appendSMProgress(h, { date: '2026-02-01', bodyweightKg: 105, yoke20mS: 12, logKg: 110, stoneLadderKg: 140 });
    const t = smProgressTrend(h2);
    expect(t!.yokeDeltaS).toBeCloseTo(-2, 0);
    expect(t!.logDeltaKg).toBe(10);
  });
});
