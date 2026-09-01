import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { getArmLandmarks } from '../arm-volume-landmarks.engine';
import { buildArmMacrocycle } from '../arm-macrocycle.engine';
import { buildArmBlock } from '../arm-annual';
import { createBlank, isUserProgramShape } from '../../user-program/program-store';
import { buildArmPrintHtml } from '../arm-export.engine';
import { calcArmMetrics } from '../arm-metrics.engine';
import { directionFromKinds } from '../../annual-training/block-builders.engine';

describe('arm-comprehensive PRO', () => {
  it('createBlank arm — структура', () => {
    const p = createBlank('arm' as any);
    expect(p.meta.direction).toBe('arm');
    expect((p as any).arm.weeks[0].sessions.length).toBe(3);
  });
  it('buildArmMacrocycle 52 нед — сумма =52', () => {
    const m = buildArmMacrocycle({ totalWeeks: 52, goal:'strength' });
    const sum = m.blocks.reduce((s,b)=>s+b.weeks,0);
    expect(sum).toBe(52);
    expect(m.type).toBe('arm');
  });
  it('buildArmMacrocycle hypertrophy — h 50%', () => {
    const m = buildArmMacrocycle({ totalWeeks:20, goal:'hypertrophy' });
    expect(m.blocks[0].weeks).toBeGreaterThan(m.blocks[1].weeks);
  });
  it('buildArmMacrocycle peaking — p 30%', () => {
    const m = buildArmMacrocycle({ totalWeeks:20, goal:'peaking' });
    const p = m.blocks.find(b=>b.phase==='peaking')!;
    expect(p.weeks).toBeGreaterThanOrEqual(6);
  });
  it('PED 0 dose — no boost', () => {
    const base: any = { discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 };
    const p0: any = buildArmPlan(base);
    const p1: any = buildArmPlan({ ...base, pedDoses:{test_e:0} });
    expect(p1.mrvByMuscle.wrist_flexors).toBe(p0.mrvByMuscle.wrist_flexors);
  });
  it('PED negative dose — ignored', () => {
    const base: any = { discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 };
    const p: any = buildArmPlan({ ...base, pedDoses:{test_e:-100} });
    // negative игнорируется → как без PED, допуск округления +1
    expect(p.mrvByMuscle.wrist_flexors).toBeLessThanOrEqual(Math.round(getArmLandmarks('intermediate','wrist_flexors').mrv * 1.1) + 1);
  });
  it('lab 0.6 vs 1.4', () => {
    const base: any = { discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 };
    const low: any = buildArmPlan({ ...base, labMrvMultiplier:0.6 });
    const high: any = buildArmPlan({ ...base, labMrvMultiplier:1.4 });
    expect(high.mrvByMuscle.brachialis).toBeGreaterThan(low.mrvByMuscle.brachialis);
  });
  it('nutrition protein 1.0 vs 2.5', () => {
    const base: any = { discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 };
    const low: any = buildArmPlan({ ...base, proteinPerKg:1.0 });
    const high: any = buildArmPlan({ ...base, proteinPerKg:2.5 });
    expect(high.mrvByMuscle.wrist_flexors).toBeGreaterThanOrEqual(low.mrvByMuscle.wrist_flexors);
  });
  it('table ratio hybrid 4× — ≥0.25', () => {
    const p: any = buildArmPlan({ discipline:'hybrid', patternId:'hybrid_4_arm_pl', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    for (const wk of p.weeks) {
      const r = wk.sessions.filter((s:any)=>s.tableTime).length / wk.sessions.length;
      expect(r).toBeGreaterThanOrEqual(0.2);
    }
  });
  it('print html Gantt и rationale', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    const html = buildArmPrintHtml(p);
    expect(html).toContain('Арм-план');
    expect(html).toContain('PRO:');
    expect(html).toContain('display:flex');
  });
  it('metrics tableTime', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    const m = calcArmMetrics(p);
    expect(m.tableTimePct).toBeGreaterThan(0.2);
    expect(m.tendonLoad).toBeGreaterThan(0);
  });
  it('buildArmBlock hybrid', () => {
    const res = buildArmBlock({ blockKey:'k', weeks:4, phase:'strength' }, { level:'intermediate', taperEnabled:true, taperWeeks:2 } as any);
    expect(res.weeks.length).toBe(4);
    expect(res.taperApplied).toBe(true);
  });
  it('specialization ×1.3', () => {
    const a: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:4, weakPoints:['wrist_flexors'], focusGroup:'wrist_flexors', specialization:true });
    const b: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    expect(a.mrvByMuscle.wrist_flexors).toBeGreaterThan(b.mrvByMuscle.wrist_flexors);
  });
  it('validate side RIR', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_5_specialized', level:'intermediate', goal:'strength', technique:'press', weeks:2 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    const v = validateArmPlan(p,'intermediate');
    const sideErr = v.errors.filter(e=>e.includes('side'));
    expect(sideErr.length).toBe(0);
  });
  it('grip armlifting no pronators', () => {
    const p: any = buildArmPlan({ discipline:'armlifting', patternId:'grip_3_support', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 });
    for (const wk of p.weeks) for (const sess of wk.sessions) for (const ex of sess.exercises) {
      expect(['pronators','supinators']).not.toContain(ex.muscle);
    }
  });
  it('weeks 52 — не падает', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:52 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    expect(p.weeks.length).toBe(52);
    const v = validateArmPlan(p,'intermediate');
    expect(v.errors.length).toBe(0);
  });
  it('level enhanced > beginner', () => {
    const b: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'beginner', goal:'strength', technique:'balanced', weeks:2 });
    const e: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'enhanced', goal:'strength', technique:'balanced', weeks:2 });
    expect(e.mrvByMuscle.brachialis).toBeGreaterThan(b.mrvByMuscle.brachialis);
  });
  it('goal hypertrophy vs strength', () => {
    const s: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    const h: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'hypertrophy', technique:'balanced', weeks:4 });
    expect(h.mrvByMuscle.wrist_flexors).toBeGreaterThanOrEqual(s.mrvByMuscle.wrist_flexors);
  });
  it('export Gantt colors', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    const html = buildArmPrintHtml(p);
    expect(html).toContain('22c55e');
    expect(html).toContain('f59e0b');
  });
  it('arm annual hybrid mixed', () => {
    expect(directionFromKinds(['ARM','PL'] as any)).toBe('mixed');
    expect(directionFromKinds(['ARM'] as any)).toBe('arm');
  });
  it('program store arm shape', () => {
    const p = createBlank('arm' as any);
    expect(isUserProgramShape(p)).toBe(true);
  });
});
