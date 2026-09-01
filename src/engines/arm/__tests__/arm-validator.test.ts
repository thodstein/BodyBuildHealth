import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';

describe('arm-validator', () => {
  it('valid план', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    p = finalizeArmPlan(p, { level:'intermediate' });
    const v = validateArmPlan(p,'intermediate');
    expect(v.valid).toBe(true);
    expect(v.errors.length).toBe(0);
  });
  it('mrv overflow detection', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_5_specialized', level:'beginner', goal:'strength', technique:'balanced', weeks:1 });
    // накрутить объём
    p.weeks[0].sessions[0].exercises.push({ muscle:'side_pressure', name:'Бок', role:'primary', character:'тяж', sets:20, repsRange:[3,5], rir:1, workSets: Array(20).fill({reps:5,rir:1,weight:0}) });
    const v = validateArmPlan(p,'beginner');
    expect(v.mrvOverflow.length).toBeGreaterThan(0);
  });
  it('RIR вне 0..5 — ошибка', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_2_table_support', level:'intermediate', goal:'strength', technique:'balanced', weeks:1 });
    p.weeks[0].sessions[0].exercises[0].rir = 10;
    const v = validateArmPlan(p,'intermediate');
    expect(v.errors.length).toBeGreaterThan(0);
  });
  it('humerus warnings', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_5_specialized', level:'intermediate', goal:'strength', technique:'balanced', weeks:1 });
    // force side
    p.weeks[0].sessions[0].exercises.push({ muscle:'side_pressure', name:'Бок', role:'primary', character:'тяж', sets:8, repsRange:[3,5], rir:2, workSets: Array(8).fill({reps:5,rir:2,weight:0}) });
    const v = validateArmPlan(p,'intermediate');
    expect(v.humerusWarnings.length).toBeGreaterThan(0);
  });
});
