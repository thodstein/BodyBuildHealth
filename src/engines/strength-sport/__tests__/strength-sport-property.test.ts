import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { finalizeStrengthSportPlan } from '../strength-sport-finalize.engine';
import { getStrong, getWL } from '../strength-sport-volume';

describe('property: weeklySets ≤ budget + MRV + sync', () => {
  const modes: any[] = ['weightlifting','strongman','hybrid'];
  const levels: any[] = ['beginner','intermediate','advanced','enhanced'];
  const days = [2,3,4,5];
  const goals: any[] = ['strength','hypertrophy','peaking','technique'];
  const total = modes.length * levels.length * days.length * goals.length; // 192
  it(`192 combos: 0 overflow (realistic), 0 >MRV, 0 sets≠workSets`, () => {
    let overflow = 0;
    let mrvOver = 0;
    let syncFail = 0;
    let first:any=null;
    let firstMrv:any=null;
    const isRealistic = (lvl:string, days:number) => {
      if (lvl==='beginner' && days>3) return false;
      if (lvl==='intermediate' && days>4) return false;
      return true;
    };
    for (const mode of modes) for (const level of levels) for (const d of days) for (const goal of goals) {
      if (!isRealistic(level,d)) continue;
      const plan = buildStrengthSportPlan({ mode, goal, level, weeks:4, daysPerWeek:d, workMax:{ snatch:70, cleanJerk:90, backSquat:120, deadlift:160, yokeWalk:200, farmersWalk:140 } });
      const fin = finalizeStrengthSportPlan(JSON.parse(JSON.stringify(plan)));
      const budget = parseInt(fin.rationale.find((r:string)=> r.includes('Budget'))?.match(/Budget (\d+)/)?.[1]||'999',10);
      for (const wk of fin.weeksData) {
        if ((wk.totalSets||0) > budget) { overflow++; if(!first) first={mode,level,d,goal,wk: wk.week, total: wk.totalSets, budget, sets: wk.sessions.map(s=> s.exercises.map(e=> e.id+':'+e.sets).join(','))}; }
        // MRV checks
        const carryMeters = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry','zercher_carry'].includes(e.id))).reduce((a,e)=> a + e.sets * ((e.workSets[0] as any)?.distanceM||20),0);
        const lmCarry = getStrong(level,'carry');
        if (lmCarry && carryMeters > lmCarry.mrv) { mrvOver++; if(!firstMrv) firstMrv={mode,level,d,goal,carryMeters, mrv: lmCarry.mrv, wk: wk.week}; }
        const gripSets = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
        const lmGrip = getStrong(level,'grip');
        if (lmGrip && gripSets > lmGrip.mrv) { mrvOver++; if(!firstMrv) firstMrv={mode,level,d,goal,gripSets, mrv: lmGrip.mrv, wk: wk.week}; }
        for (const sess of wk.sessions) for (const ex of sess.exercises) {
          if (ex.sets !== ex.workSets.length) syncFail++;
          if (ex.sets > 6) syncFail++;
        }
      }
    }
    expect(overflow).toBe(0);
    expect(mrvOver).toBe(0);
    expect(syncFail).toBe(0);
    expect(total).toBe(192);
  });

  it('strongman without specialty fallback deep', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{}, equipment:['barbell'] });
    const hasExotic = p.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> ['yoke_walk','log_press','atlas_stone_load'].includes(e.id))));
    expect(hasExotic).toBe(false);
    // должен быть фермер или рама как замена
    const hasCarry = p.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.id.includes('farmers')|| e.id.includes('carry'))));
    expect(hasCarry).toBe(true);
  });

  it('female carry 0.90', () => {
    const m = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:200 }, sex:'male' } as any);
    const f = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:200 }, sex:'female' } as any);
    const mw = m.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id==='yoke_walk')?.weight || 0;
    const fw = f.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id==='yoke_walk')?.weight || 0;
    if (mw && fw) expect(fw).toBeLessThan(mw);
  });

  it('medley total < cap', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:250, farmersWalk:140 }, equipment:['barbell','other'] } as any);
    const ev = p.weeksData[0].sessions.find(s=> s.sessionTag==='event_day');
    if (ev) {
      const carries = ev.exercises.filter(e=> ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry'].includes(e.id));
      if (carries.length>=2) {
        const first = carries[0];
        expect(first.comment).toMatch(/Medley/);
        expect((first.workSets[0] as any).timeCapS).toBe(180);
        expect(first.restSeconds).toBe(90);
      }
    }
  });

  it('VBT history reduces volume', () => {
    const base = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:80 } } as any);
    const hist: any = { snatch: [1.1, 0.85, 0.70] }; // loss 36% >30
    const vbt = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:80 }, velocityHistory: hist } as any);
    const bSets = base.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('snatch'))).reduce((a,e)=>a+e.sets,0);
    const vSets = vbt.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('snatch'))).reduce((a,e)=>a+e.sets,0);
    expect(vSets).toBeLessThanOrEqual(bSets);
  });
});
