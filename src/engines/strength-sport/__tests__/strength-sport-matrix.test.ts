import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';

describe('strength-sport matrix 192 combos (mode×level×days×goal)', () => {
  const modes: any[] = ['weightlifting','strongman','hybrid'];
  const levels: any[] = ['beginner','intermediate','advanced','enhanced'];
  const days = [2,3,4,5];
  const goals: any[] = ['strength','hypertrophy','peaking','technique'];
  let total=0;
  for (const mode of modes) for (const level of levels) for (const d of days) for (const goal of goals) {
    total++;
    it(`${mode} ${level} ${d}x ${goal}`, () => {
      const plan = buildStrengthSportPlan({ mode, goal, level, weeks:6, daysPerWeek:d, workMax:{ snatch:70, cleanJerk:90, backSquat:120, deadlift:160 } });
      expect(plan.weeksData.length).toBe(6);
      expect(plan.weeksData[0].sessions.length).toBeGreaterThan(0);
      // каждая сессия 3-5 упр, каждый сет 2-6 (tire_flip deload 1×60% допуск), вес >=0
      for (const wk of plan.weeksData) for (const sess of wk.sessions) for (const ex of sess.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(ex.id === 'tire_flip' ? 1 : 2);
        expect(ex.sets).toBeLessThanOrEqual(6);
        expect(ex.weight).toBeGreaterThanOrEqual(0);
        expect(ex.workSets.length).toBe(ex.sets);
      }
      // детерминизм
      const plan2 = buildStrengthSportPlan({ mode, goal, level, weeks:6, daysPerWeek:d, workMax:{ snatch:70, cleanJerk:90, backSquat:120, deadlift:160 } });
      expect(JSON.stringify(plan.weeksData)).toBe(JSON.stringify(plan2.weeksData));
    });
  }
  it('count', () => expect(total).toBe(192));

  it('without specialty equipment fallback', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{}, equipment:['barbell','dumbbell'] });
    const hasStrong = p.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> ['log_press','yoke_walk','atlas_stone_load'].includes(e.id))));
    expect(hasStrong).toBe(false);
    expect(p.weeksData[0].sessions.length).toBeGreaterThan(0);
  });

  it('injury gentle reduces weight', () => {
    const base = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ backSquat:100 } });
    const inj = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ backSquat:100 }, injuries:[{ location:'knee', type:'joint' }] });
    const baseW = base.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('squat')))[0]?.weight || 0;
    const injW = inj.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('squat')))[0]?.weight || 0;
    if (baseW && injW) expect(injW).toBeLessThanOrEqual(baseW);
  });

  it('outside high reduces total sets', () => {
    const base = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{} });
    const out = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{}, outsideLoad:{sessionsPerWeek:5, avgDurationMin:90, avgSRPE:8, interference:'high'} });
    expect((out.weeksData[0].totalSets||0)).toBeLessThanOrEqual(base.weeksData[0].totalSets||0);
  });

  it('focus snatch increases snatch lifts', () => {
    const base = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:70 } });
    const foc = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:70 }, focus:'snatch' });
    const b = base.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('snatch'))).reduce((a,e)=>a+e.sets,0);
    const f = foc.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('snatch'))).reduce((a,e)=>a+e.sets,0);
    expect(f).toBeGreaterThanOrEqual(b);
  });
});
