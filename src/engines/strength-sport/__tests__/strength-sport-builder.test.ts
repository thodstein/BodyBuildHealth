import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { finalizeStrengthSportPlan } from '../strength-sport-finalize.engine';
import { validateStrengthSportPatterns } from '../strength-sport-split-patterns';

describe('strength-sport builder isolated', () => {
  it('patterns valid', () => expect(validateStrengthSportPatterns()).toEqual([]));

  it('wl 3x build', () => {
    const plan = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 8, daysPerWeek: 3, workMax: { snatch: 80, cleanJerk: 100, backSquat: 140, deadlift: 180 } });
    expect(plan.weeksData.length).toBe(8);
    expect(plan.patternId).toBe('wl_3');
    expect(plan.weeksData[0].sessions.length).toBe(3);
    expect(plan.weeksData[0].sessions[0].exercises.length).toBeGreaterThanOrEqual(3);
    // deload last week
    expect(plan.weeksData[7].deload).toBe(true);
  });

  it('strongman 3x build hybrid', () => {
    const plan = buildStrengthSportPlan({ mode: 'strongman', goal: 'strength', level: 'advanced', weeks: 6, daysPerWeek: 3, workMax: { backSquat: 150, deadlift: 200, overheadPress: 80 } });
    expect(plan.mode).toBe('strongman');
    expect(plan.weeksData.length).toBe(6);
  });

  it('outside high load reduces sets', () => {
    const base = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 70 } });
    const withOutside = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 70 }, outsideLoad: { sessionsPerWeek: 5, avgDurationMin: 90, avgSRPE: 8, interference: 'high' } });
    const baseSets = base.weeksData[0].totalSets || 0;
    const outSets = withOutside.weeksData[0].totalSets || 0;
    expect(outSets).toBeLessThanOrEqual(baseSets);
  });

  it('finalize adds warnings for high outside + 5x', () => {
    const plan = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 5, workMax: { snatch: 70 }, outsideLoad: { sessionsPerWeek: 5, avgDurationMin: 90, avgSRPE: 8, interference: 'high' } });
    const fin = finalizeStrengthSportPlan(plan, { outsideLoad: { sessionsPerWeek: 5, avgDurationMin: 90, avgSRPE: 8 } });
    expect(fin.validation.warnings.length).toBeGreaterThan(0);
  });

  it('isolated meta: no BB dependency', () => {
    const plan = buildStrengthSportPlan({ mode: 'hybrid', goal: 'technique', level: 'beginner', weeks: 4, daysPerWeek: 3, workMax: {} });
    expect(plan.weeksData[0].sessions[0].exercises[0].name).toBeTruthy();
  });
});
