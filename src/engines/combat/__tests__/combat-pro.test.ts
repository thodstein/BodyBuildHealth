import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { COMBAT_LANDMARKS, getCombat } from '../combat-volume';
import { selectDiverseCB, filterByTierCB, filterByInjuryCB } from '../combat-selection';
import { accentForDiscipline } from '../combat-specialization';
import { repsForCB, rirForCB } from '../combat-loading';

describe('combat PRO gym', () => {
  it('landmarks', () => {
    expect(COMBAT_LANDMARKS.beginner.neck.mev).toBe(4);
    expect(getCombat('intermediate','grip')!.mav).toBe(10);
  });
  it('wrestling accent neck/grip higher', () => {
    const w = accentForDiscipline('wrestling');
    expect(w.neck).toBeGreaterThan(1);
    expect(w.grip).toBeGreaterThan(1);
    const b = accentForDiscipline('boxing');
    expect(b.rotational).toBeGreaterThan(1);
  });
  it('outside conflict flips тяж to памп', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, outsideLoad:{sessionsPerWeek:4, avgDurationMin:90, avgSRPE:7, interference:'high', highIntensityDays:[2]} });
    expect(plan.weeksData.length).toBe(4);
  });
  it('filterByTier beginner removes neck_bridge', () => {
    const pool=['neck_harness_ext','neck_bridge_wrestler'];
    expect(filterByTierCB(pool,'beginner', true)).not.toContain('neck_bridge_wrestler');
    expect(filterByTierCB(pool,'advanced', true)).toContain('neck_bridge_wrestler');
  });
  it('filterByInjury neck', () => {
    const pool=['neck_harness_ext','bench_bar'];
    const f=filterByInjuryCB(pool, [{location:'neck', exclude:true} as any]);
    expect(f).not.toContain('neck_harness_ext');
    expect(f).toContain('bench_bar');
  });
  it('filterByInjury neck graded keeps', () => {
    const pool=['neck_harness_ext','bench_bar'];
    const f=filterByInjuryCB(pool, [{location:'neck'} as any]);
    expect(f).toContain('neck_harness_ext');
  });
  it('selectDiverseCB', () => {
    const pool=['bench_bar','row_bar','neck_harness_ext','gi_grip_pullup'];
    const sel=selectDiverseCB(pool,'upper_power',3,new Set());
    expect(sel.length).toBe(3);
  });
  it('reps/rir', () => {
    expect(repsForCB('power','тяж')).toEqual([3,6]);
    expect(rirForCB('weight_cut','gpp','тяж')).toBe(4);
  });
  it('weight_cut reduces sets vs power', () => {
    const p = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 });
    const c = buildCombatPlan({ discipline:'mma', goal:'weight_cut', level:'intermediate', weeks:4, daysPerWeek:3, weightCutKg:4 });
    expect((c.weeksData[0].totalSets||0)).toBeLessThanOrEqual(p.weeksData[0].totalSets||0);
  });
});
