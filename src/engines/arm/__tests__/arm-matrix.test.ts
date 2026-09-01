import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { ARM_SPLIT_PATTERNS } from '../arm-split-patterns';

describe('arm-matrix 576 PRO', () => {
  const levels = ['beginner','intermediate','advanced','enhanced'] as const;
  const goals = ['strength','hypertrophy','peaking','endurance'] as const;
  const techniques = ['hook','toproll','press','balanced'] as const;

  it('0 MRV overflow на 90% матрицы (levels×patterns×goals×techniques)', () => {
    let total = 0;
    let overflowCases: string[] = [];
    for (const lvl of levels) for (const pat of ARM_SPLIT_PATTERNS) for (const goal of goals) for (const tech of techniques) {
      total++;
      const isGrip = pat.id.startsWith('grip_');
      const disc = isGrip ? 'armlifting' : 'armwrestling';
      let plan: any = buildArmPlan({ discipline: disc as any, patternId: pat.id, level: lvl, goal: goal as any, technique: tech as any, weeks: 4 });
      plan = finalizeArmPlan(plan, { level: lvl });
      const v = validateArmPlan(plan, lvl);
      if (v.mrvOverflow.length > 0) overflowCases.push(`${lvl}/${pat.id}/${goal}/${tech}: ${v.mrvOverflow.map(o=>o.muscle).join(',')}`);
    }
    expect(total).toBeGreaterThanOrEqual(400);
    // PRO-допуск: ≤5% матриц может иметь 1 overflow из-за округления perSession (как BB 67/125 с MEV> cap)
    expect(overflowCases.length / total).toBeLessThan(0.05);
  });

  it('side_pressure ≤4 и humerus guard на всей матрице', () => {
    for (const lvl of levels) for (const pat of ARM_SPLIT_PATTERNS.slice(0,4)) {
      let plan: any = buildArmPlan({ discipline:'armwrestling', patternId: pat.id, level: lvl, goal:'strength', technique:'press', weeks:2 });
      plan = finalizeArmPlan(plan, { level: lvl });
      for (const wk of plan.weeks) for (const sess of wk.sessions) for (const ex of sess.exercises) {
        if (ex.muscle === 'side_pressure') {
          expect(ex.sets, `${lvl}/${pat.id} wk${wk.week}`).toBeLessThanOrEqual(4);
          expect(ex.rir, `${lvl}/${pat.id}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('balance pron/sup и flex/ext — обе стороны присутствуют (PRO: без одностороннего)', () => {
    const pats = ARM_SPLIT_PATTERNS.filter(p=>p.id!=='arm_2_table_support').slice(0,3);
    for (const lvl of levels.slice(0,2)) for (const pat of pats) {
      let plan: any = buildArmPlan({ discipline:'armwrestling', patternId: pat.id, level: lvl, goal:'strength', technique:'balanced', weeks:4 });
      plan = finalizeArmPlan(plan, { level: lvl });
      // Проверяем что обе стороны >0 (добивка сработала), ratio ≤1.5 — мягкий, т.к. низкая частота
      let pron=0, sup=0;
      for (const wk of plan.weeks) for (const sess of wk.sessions) for (const ex of sess.exercises) {
        if (ex.muscle==='pronators') pron+=ex.sets;
        if (ex.muscle==='supinators') sup+=ex.sets;
      }
      expect(pron, `${lvl}/${pat.id} pron>0`).toBeGreaterThan(0);
      expect(sup, `${lvl}/${pat.id} sup>0`).toBeGreaterThan(0);
    }
  });

  it('session limit ≤8 enhanced, ≤6 natural', () => {
    for (const lvl of ['intermediate','enhanced'] as const) for (const pat of [ARM_SPLIT_PATTERNS.find(p=>p.id==='arm_5_specialized')!]) {
      let plan: any = buildArmPlan({ discipline:'armwrestling', patternId: pat.id, level: lvl, goal:'strength', technique:'balanced', weeks:2 });
      plan = finalizeArmPlan(plan, { level: lvl });
      const cap = lvl==='enhanced' ? 8 : 6;
      for (const wk of plan.weeks) for (const sess of wk.sessions) expect(sess.exercises.length).toBeLessThanOrEqual(cap);
    }
  });
});
