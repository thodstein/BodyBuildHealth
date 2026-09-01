import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { tableWeekKind } from '../arm-table.engine';
import { buildArmTaperCurve } from '../arm-taper.engine';

describe('arm-integration', () => {
  it('3×4 матрица: 3 уровня ×4 паттерна — 0 overflow', () => {
    const levels = ['beginner','intermediate','advanced'];
    const patterns = ['arm_2_table_support','arm_3_full','arm_4_upper_lower','grip_3_support'];
    for (const lvl of levels) for (const pat of patterns) {
      let p: any = buildArmPlan({ discipline: pat.startsWith('grip')?'armlifting':'armwrestling', patternId: pat, level: lvl, goal:'strength', technique:'balanced', weeks:4 });
      p = finalizeArmPlan(p,{ level: lvl });
      const v = validateArmPlan(p,lvl);
      expect(v.mrvOverflow.length, `${lvl}/${pat}`).toBe(0);
    }
  });
  it('technique matrix: hook/toproll/press/balanced — session limit ok', () => {
    for (const tech of ['hook','toproll','press','balanced'] as const) {
      let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique: tech, weeks:2 });
      p = finalizeArmPlan(p,{ level:'intermediate' });
      for (const wk of p.weeks) for (const sess of wk.sessions) expect(sess.exercises.length).toBeLessThanOrEqual(6);
    }
  });
  it('table week kinds 3/2/1', () => {
    expect(tableWeekKind(1,12)).toBe('moderate');
    expect(tableWeekKind(4,12)).toBe('heavy');
    expect(tableWeekKind(6,12)).toBe('stress');
    expect(tableWeekKind(7,12)).toBe('moderate');
  });
  it('taper 2 нед кривая', () => {
    expect(buildArmTaperCurve({taperWeeks:2}).length).toBe(2);
  });
  it('end-to-end: armlifting hybrid', () => {
    let p: any = buildArmPlan({ discipline:'hybrid', patternId:'hybrid_4_arm_pl', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    p = finalizeArmPlan(p,{ level:'intermediate' });
    const v = validateArmPlan(p,'intermediate');
    expect(v.valid).toBe(true);
  });
  it('beginner tendonMult 0.7 — меньше сетов чем advanced', () => {
    let pb: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'beginner', goal:'strength', technique:'balanced', weeks:1 });
    let pa: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'advanced', goal:'strength', technique:'balanced', weeks:1 });
    const sb = pb.weeks[0].sessions.reduce((s:number, ss:any)=>s+ss.exercises.reduce((a:number,e:any)=>a+e.sets,0),0);
    const sa = pa.weeks[0].sessions.reduce((s:number, ss:any)=>s+ss.exercises.reduce((a:number,e:any)=>a+e.sets,0),0);
    expect(sa).toBeGreaterThanOrEqual(sb);
  });
});
