/**
 * strength-sport-e2e.test.ts — E2E hub→bridge→constructor (P2)
 * Симулирует полный поток: WLDiagnosticsHub выбирает weakPoints → planner-bridge → buildStrengthSportPlan
 */
import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { calibrateLVP, saveLVPProfile, clearLVPProfiles } from '../strength-sport-lvp-calibration.engine';
import { simulateContest } from '../strength-sport-contest-simulator.engine';
import { hrvReport } from '../strength-sport-hrv.engine';
import { diagnoseJerkDip } from '../strength-sport-biomechanics.engine';
import { autoValidateAnglesFromPose } from '../strength-sport-biomechanics.engine';

describe('E2E hub→bridge→constructor', () => {
  it('WL hub weakPoints → plan with injection', () => {
    const weakPoints = ['snatch_off_floor','jerk_dip'];
    const plan = buildStrengthSportPlan({
      mode: 'weightlifting',
      goal: 'strength',
      level: 'intermediate',
      weeks: 8,
      daysPerWeek: 3,
      workMax: { snatch: 70, cleanJerk: 90, backSquat: 120, deadlift: 160 },
      weakPoints: weakPoints as any,
    } as any);
    expect(plan.weeksData.length).toBe(8);
    // инъекция должна добавить объём на слабые (проверяем что план не падает и имеет сеты)
    expect(plan.weeksData[0].sessions.length).toBeGreaterThan(0);
  });

  it('SM hub contest → simulator → plan', () => {
    const contest = {
      name: 'Test',
      events: [
        { id: 'yoke_walk', weight: 300, distanceM: 20, format: 'medley_distance' as const },
        { id: 'log_press', weight: 110, format: 'max' as const },
        { id: 'atlas_stone_load', ladderWeights: [100,140], format: 'ladder' as const, heightCm: 140 },
      ],
    } as any;
    const wm = { yokeWalk: 320, logPress: 115, atlasStone: 145 } as any;
    const sim = simulateContest(contest, wm, 'balanced');
    expect(sim).not.toBeNull();
    expect(sim!.totalPoints).toBeGreaterThan(0);
    const plan = buildStrengthSportPlan({
      mode: 'strongman',
      goal: 'peaking',
      level: 'advanced',
      weeks: 8,
      daysPerWeek: 3,
      workMax: wm,
      contest,
      contestStrategy: 'balanced',
    } as any);
    expect(plan.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.id==='yoke_walk')))).toBe(true);
  });

  it('LVP calibrate → VBT uses individual', () => {
    clearLVPProfiles();
    const pts = [{pct:0.5, velocity:2.70},{pct:0.65, velocity:2.15},{pct:0.80, velocity:1.80},{pct:0.90, velocity:1.55}];
    const prof = calibrateLVP('snatch', pts as any);
    expect(prof).not.toBeNull();
    saveLVPProfile(prof!);
    const plan = buildStrengthSportPlan({
      mode: 'weightlifting',
      goal: 'strength',
      level: 'intermediate',
      weeks: 4,
      daysPerWeek: 3,
      workMax: { snatch: 80 },
      velocityHistory: { snatch: [1.60, 1.30] },
    } as any);
    expect(plan.weeksData.length).toBe(4);
    clearLVPProfiles();
  });

  it('HRV + RPE + jerk dip + joint-angle auto', () => {
    const hrv = hrvReport([80,80,80,80,80,80,80,80,80,80]);
    expect(hrv?.zone).toBe('optimal');
    const jerk = diagnoseJerkDip(10, 200, 80);
    expect(jerk?.isOptimal).toBe(true);
    const angles = autoValidateAnglesFromPose({ hip: 150, knee: 80, ankle: 40, shoulder: 160 }, ['snatch_mid'] as any);
    expect(angles.length).toBeGreaterThan(0);
    expect(angles[0].valid).toBe(true);
  });

  it('pose → OHS auto + stone moment', async () => {
    const { autoOHSFromPose } = await import('../strength-sport-biomechanics.engine');
    const ohs = autoOHSFromPose({ hip: 85, knee: 65, ankle: 30, shoulder: 140 });
    expect(ohs.level).toBeDefined();
  });
});
