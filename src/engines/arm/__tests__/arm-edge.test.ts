import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { buildArmPrintHtml } from '../arm-export.engine';

describe('arm-edge PRO', () => {
  it('empty weakPoints', () => {
    const p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2, weakPoints:[] });
    expect(p.weeks.length).toBe(2);
  });
  it('unknown patternId fallback', () => {
    const p: any = buildArmPlan({ discipline:'armwrestling', patternId:'unknown', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 });
    expect(p.pattern).toBeDefined();
  });
  it('weeks 1', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_2_table_support', level:'beginner', goal:'strength', technique:'balanced', weeks:1 });
    p = finalizeArmPlan(p,{level:'beginner'});
    expect(p.weeks.length).toBe(1);
    expect(validateArmPlan(p,'beginner').errors.length).toBe(0);
  });
  it('weeks 52', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:52 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    expect(p.weeks.length).toBe(52);
  });
  it('excluded exercise', () => {
    const p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2, excludedExercises:['wrist_curl_belt'] });
    const has = p.weeks.flatMap((w:any)=>w.sessions.flatMap((s:any)=>s.exercises)).some((e:any)=>e.exerciseId==='wrist_curl_belt');
    expect(has).toBe(false);
  });
  it('favorite exercise', () => {
    const p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2, favoriteExercises:['pronation_cable'] });
    const has = p.weeks[0].sessions.flatMap((s:any)=>s.exercises).some((e:any)=>e.exerciseId==='pronation_cable');
    expect(has).toBe(true);
  });
  it('hybrid grip', () => {
    const p: any = buildArmPlan({ discipline:'hybrid', patternId:'hybrid_4_arm_pl', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 });
    expect(p.weeks[0].sessions.length).toBeGreaterThan(0);
  });
  it('peaking taper', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'peaking', technique:'balanced', weeks:8 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    expect(p.weeks[7].phase).toBe('peaking');
    expect(p.weeks[7].taper).toBe(true);
  });
  it('print html esc', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    p.pattern.name = '<script>alert(1)</script>';
    const html = buildArmPrintHtml(p);
    expect(html).toContain('&lt;script&gt;');
    // html always has <script> for print, so check that user input is escaped, not raw
    expect(html).not.toContain('<script>alert');
  });
  it('validate no errors for standard', () => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    const v = validateArmPlan(p,'intermediate');
    expect(v.valid).toBe(true);
  });
});
