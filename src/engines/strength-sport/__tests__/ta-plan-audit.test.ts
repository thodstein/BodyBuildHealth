import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import {
  auditTAPlan, phasesForExercise, hubTabForPhase, TA_CORE_PHASES, TA_AUX_PHASES, TA_ALL_PHASES,
} from '../strength-sport-ta-plan-audit.engine';

describe('TA plan audit E1', () => {
  it('пустой план: все CORE missing, worst = snatch_off_floor', () => {
    const a = auditTAPlan(null);
    expect(a.hasPlan).toBe(false);
    expect(a.missing.length).toBe(TA_CORE_PHASES.length);
    expect(a.worstPhase).toBe('snatch_off_floor');
    expect(a.coveragePct).toBe(0);
  });
  it('мусорный вход без throw', () => {
    const a = auditTAPlan({ weeksData: null } as any);
    expect(a.hasPlan).toBe(false);
    const b = auditTAPlan({ weeksData: [{ sessions: null }, { deload: true, sessions: [] }] } as any);
    expect(b.hasPlan).toBe(true);
    expect(b.deloadWeeks).toBe(1);
  });
  it('маппинг: deficit → off_floor, pause → mid, полный рывок → все 5', () => {
    expect(phasesForExercise({ id: 'deficit_snatch' })).toEqual(['snatch_off_floor']);
    expect(phasesForExercise({ id: 'pause_clean' })).toEqual(['clean_off_floor', 'clean_mid']);
    expect(phasesForExercise({ id: 'snatch', name: 'Рывок классический' }).length).toBe(5);
    expect(phasesForExercise({ id: 'jerk_dip' })).toEqual(['jerk_dip']);
    expect(phasesForExercise({ id: 'unknown_xyz' })).toEqual([]);
  });
  it('реальный план 4нед: покрытие >0, тоннаж конечен', () => {
    const p = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 80, backSquat: 120, deadlift: 160 } } as any);
    const a = auditTAPlan(p);
    expect(a.hasPlan).toBe(true);
    expect(a.weeks).toBe(4);
    expect(a.coveredCount).toBeGreaterThan(0);
    expect(Number.isFinite(a.totalSets) && a.totalSets > 0).toBe(true);
    expect(Number.isFinite(a.totalTonnage)).toBe(true);
    expect(a.worstPhase).not.toBeNull();
  });
  it('deload-недели исключены из объёма', () => {
    const p = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 80 } } as any);
    const full = auditTAPlan(p);
    const copy: any = JSON.parse(JSON.stringify(p));
    copy.weeksData.forEach((w: any) => { w.deload = true; });
    const all = auditTAPlan(copy);
    expect(all.totalSets).toBe(0);
    expect(all.deloadWeeks).toBe(full.weeks);
  });
  it('hubTabForPhase: squat/pull/press → null', () => {
    expect(hubTabForPhase('snatch_mid')).toBe('snatch');
    expect(hubTabForPhase('clean_catch')).toBe('clean');
    expect(hubTabForPhase('jerk_dip')).toBe('jerk');
    expect(hubTabForPhase('squat_bottom')).toBeNull();
    expect(hubTabForPhase('pull_start')).toBeNull();
  });
  it('V7-B TA_AUX_PHASES: 5 фаз, дополнение CORE до ALL', () => {
    expect(TA_AUX_PHASES.length).toBe(5);
    expect(TA_ALL_PHASES.length).toBe(TA_CORE_PHASES.length + TA_AUX_PHASES.length);
    expect(TA_AUX_PHASES.every(wp => !TA_CORE_PHASES.includes(wp))).toBe(true);
    expect(TA_AUX_PHASES.every(wp => (TA_ALL_PHASES as string[]).includes(wp))).toBe(true);
  });
});
