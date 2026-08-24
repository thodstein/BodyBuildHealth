import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';

describe('combat matrix 240 combos', () => {
  const disciplines: any[] = ['boxing','mma','wrestling','kickboxing','general'];
  const levels: any[] = ['beginner','intermediate','advanced','enhanced'];
  const days = [2,3,4];
  const goals: any[] = ['power','endurance','maintenance','weight_cut'];
  let total=0;
  for (const dsc of disciplines) for (const lvl of levels) for (const dy of days) for (const gl of goals) {
    total++;
    it(`${dsc} ${lvl} ${dy}x ${gl}`, () => {
      const plan = buildCombatPlan({ discipline:dsc, goal:gl, level:lvl, weeks:4, daysPerWeek:dy, weightCutKg: gl==='weight_cut'?3:0 });
      expect(plan.weeksData.length).toBe(4);
      expect(plan.weeksData[0].sessions.length).toBeGreaterThan(0);
      for (const wk of plan.weeksData) for (const sess of wk.sessions) for (const ex of sess.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(2);
        expect(ex.sets).toBeLessThanOrEqual(6);
      }
      const plan2 = buildCombatPlan({ discipline:dsc, goal:gl, level:lvl, weeks:4, daysPerWeek:dy, weightCutKg: gl==='weight_cut'?3:0 });
      expect(JSON.stringify(plan.weeksData)).toBe(JSON.stringify(plan2.weeksData));
    });
  }
  it('count', ()=> expect(total).toBe(240));

  it('mma without cable fallback', () => {
    const p = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, equipment:['barbell','dumbbell'] });
    const hasPallof = p.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.id==='pallof_rotation_press')));
    expect(hasPallof).toBe(false);
  });
  it('injury neck gentle', () => {
    const base = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 });
    const inj = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, injuries:[{location:'neck'}] });
    const b = base.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=>e.id.includes('neck')))[0]?.weight || 0;
    const i = inj.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=>e.id.includes('neck')))[0]?.weight || 0;
    if (b && i) expect(i).toBeLessThanOrEqual(b);
  });
  it('wrestling has more neck/grip', () => {
    const box = buildCombatPlan({ discipline:'boxing', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 });
    const wrest = buildCombatPlan({ discipline:'wrestling', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 });
    const bn = box.weeksData[0].sessions.reduce((a,s)=> a+ s.exercises.filter(e=>e.id.includes('neck')).reduce((x,e)=>x+e.sets,0),0);
    const wn = wrest.weeksData[0].sessions.reduce((a,s)=> a+ s.exercises.filter(e=>e.id.includes('neck')).reduce((x,e)=>x+e.sets,0),0);
    expect(wn).toBeGreaterThanOrEqual(bn);
  });
  it('outside high + 4x warns or auto-reduced to 3x', () => {
    const p = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:4, outsideLoad:{sessionsPerWeek:5, avgDurationMin:90, avgSRPE:8, interference:'high'} });
    const isReduced = p.weeksData[0].sessions.length === 3;
    const hasWarn = p.validation.warnings.some(w=> w.includes('перегруз'));
    expect(isReduced || hasWarn).toBe(true);
  });
});
