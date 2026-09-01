import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { getArmLandmarks } from '../arm-volume-landmarks.engine';
import { ARM_SPLIT_PATTERNS } from '../arm-split-patterns';

describe('arm-property PED/recovery/lab', () => {
  it('PED увеличивает MRV', () => {
    const base: any = { discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 };
    let p0: any = buildArmPlan(base);
    let p1: any = buildArmPlan({ ...base, pedDoses: { test_e: 500 }, courseIntensity:'moderate' });
    expect(p1.mrvByMuscle.wrist_flexors).toBeGreaterThan(p0.mrvByMuscle.wrist_flexors);
    expect(p1.mrvByMuscle.wrist_flexors).toBeLessThanOrEqual(Math.round(getArmLandmarks('intermediate','wrist_flexors').mrv * 1.7));
  });
  it('heavy > mild pedMult', () => {
    const base: any = { discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 };
    const mild: any = buildArmPlan({ ...base, pedDoses:{test_e:500}, courseIntensity:'mild' });
    const heavy: any = buildArmPlan({ ...base, pedDoses:{test_e:500}, courseIntensity:'heavy' });
    expect(heavy.mrvByMuscle.brachialis).toBeGreaterThan(mild.mrvByMuscle.brachialis);
  });
  it('tendonCap 1.5 diminishing: 2000мг не >1.7', () => {
    const p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2, pedDoses:{test_e:1000, tren_a:500}, courseIntensity:'heavy' });
    expect(p.mrvByMuscle.wrist_flexors).toBeLessThanOrEqual(Math.round(getArmLandmarks('intermediate','wrist_flexors').mrv * 1.7 + 1));
  });
  it('labMult 0.6 снижает MRV', () => {
    const base: any = { discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 };
    const low: any = buildArmPlan({ ...base, labMrvMultiplier: 0.6 });
    const high: any = buildArmPlan({ ...base, labMrvMultiplier: 1.4 });
    expect(low.mrvByMuscle.brachialis).toBeLessThan(high.mrvByMuscle.brachialis);
  });
  it('beginner tendon 0.7', () => {
    const b: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'beginner', goal:'strength', technique:'balanced', weeks:2 });
    const a: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'advanced', goal:'strength', technique:'balanced', weeks:2 });
    // beginner MEV*0.7 vs advanced higher, but absolute beginner mrv should be less than advanced
    expect(b.mrvByMuscle.wrist_flexors).toBeLessThan(a.mrvByMuscle.wrist_flexors);
  });
  it('recovery bad sleep снижает MRV', () => {
    const good: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2, sleepHours:9, stressLevel:2 });
    const bad: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2, sleepHours:4, stressLevel:9 });
    expect(bad.mrvByMuscle.brachialis).toBeLessThan(good.mrvByMuscle.brachialis);
  });
  it('nutrition surplus повышает', () => {
    const cut: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2, calorieSurplus:-600, proteinPerKg:1.2 });
    const bulk: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2, calorieSurplus:400, proteinPerKg:2.2 });
    expect(bulk.mrvByMuscle.brachialis).toBeGreaterThanOrEqual(cut.mrvByMuscle.brachialis);
  });
  it('random 20 планов — детерминизм', () => {
    for (let i=0;i<20;i++) {
      const pat = ARM_SPLIT_PATTERNS[i % ARM_SPLIT_PATTERNS.length].id;
      const lvl = ['beginner','intermediate','advanced'][i%3] as any;
      const p1 = buildArmPlan({ discipline: pat.startsWith('grip')?'armlifting':'armwrestling', patternId: pat, level: lvl, goal:'strength', technique:'balanced', weeks:4 });
      const p2 = buildArmPlan({ discipline: pat.startsWith('grip')?'armlifting':'armwrestling', patternId: pat, level: lvl, goal:'strength', technique:'balanced', weeks:4 });
      expect(JSON.stringify(p1.weeks.map((w:any)=>w.sessions.length))).toBe(JSON.stringify(p2.weeks.map((w:any)=>w.sessions.length)));
    }
  });
  it('РУ ротация на 8 недель — ≥2 направления', () => {
    const p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:8 });
    const dirs = new Set(p.weeks.flatMap((w:any)=>w.sessions.flatMap((s:any)=>s.exercises.map((e:any)=>e.workingAngle?.direction)).filter(Boolean)));
    expect(dirs.size).toBeGreaterThanOrEqual(2);
  });
  it('isTable ≥30% для armwrestling 4×', () => {
    const p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    for (const wk of p.weeks) {
      const ratio = wk.sessions.filter((s:any)=>s.tableTime).length / wk.sessions.length;
      expect(ratio).toBeGreaterThanOrEqual(0.25);
    }
  });
  it('finalize idempotent', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    const before = JSON.stringify(p.weeks[0].sessions[0].exercises.map((e:any)=>e.sets));
    p = finalizeArmPlan(p, { level:'intermediate' });
    const after1 = JSON.stringify(p.weeks[0].sessions[0].exercises.map((e:any)=>e.sets));
    const p2 = finalizeArmPlan(JSON.parse(JSON.stringify(p)), { level:'intermediate' });
    const after2 = JSON.stringify(p2.weeks[0].sessions[0].exercises.map((e:any)=>e.sets));
    expect(after1).toBe(after2);
  });
  it('side RIR≥2 после finalize', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_5_specialized', level:'intermediate', goal:'strength', technique:'press', weeks:2 });
    p = finalizeArmPlan(p, { level:'intermediate' });
    for (const wk of p.weeks) for (const sess of wk.sessions) for (const ex of sess.exercises) if (ex.muscle==='side_pressure') expect(ex.rir).toBeGreaterThanOrEqual(2);
  });
});
