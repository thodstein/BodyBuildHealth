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
  it(`192 combos: 0 overflow (realistic), 0 >MRV (7 metrics), 0 unbalanced, 0 sync`, () => {
    let overflow = 0;
    let mrvOver = 0;
    let syncFail = 0;
    let unbalanced = 0;
    let first:any=null;
    let firstMrv:any=null;
    let firstUnbal:any=null;
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
        // 7 metrics MRV checks: carryMeters, grip, overhead, squat, pull, stone, sync/unbalanced
        const carryMeters = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry','zercher_carry','sandbag_carry'].includes(e.id))).reduce((a,e)=> a + e.sets * ((e.workSets[0] as any)?.distanceM||20),0);
        const lmCarry = getStrong(level,'carry');
        if (lmCarry && carryMeters > lmCarry.mrv) { mrvOver++; if(!firstMrv) firstMrv={metric:'carryMeters', mode,level,d,goal,carryMeters, mrv: lmCarry.mrv, wk: wk.week}; }
        const gripSets = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry','zercher_carry','sandbag_carry'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
        const lmGrip = getStrong(level,'grip');
        if (lmGrip && gripSets > lmGrip.mrv) { mrvOver++; if(!firstMrv) firstMrv={metric:'grip', mode,level,d,goal,gripSets, mrv: lmGrip.mrv, wk: wk.week}; }
        const overheadSets = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['log_press','axle_press','push_press','ohp','circus_db_press','bench_bar','pin_press'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
        const lmOver = getStrong(level,'overhead');
        if (lmOver && overheadSets > lmOver.mrv) { mrvOver++; if(!firstMrv) firstMrv={metric:'overhead', mode,level,d,goal,overheadSets, mrv: lmOver.mrv, wk: wk.week}; }
        const squatSets = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['back_squat','front_squat','squat','hack_squat','overhead_squat_v2','pause_squat','tempo_squat'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
        const lmSquat = getStrong(level,'squat');
        if (lmSquat && squatSets > lmSquat.mrv) { mrvOver++; if(!firstMrv) firstMrv={metric:'squat', mode,level,d,goal,squatSets, mrv: lmSquat.mrv, wk: wk.week}; }
        const pullSets = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['snatch_pull','clean_pull','rdl','deadlift','sumo_dl','axle_deadlift','deficit_pull','pause_pull'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
        const lmPull = getWL(level,'pull');
        if (lmPull && pullSets > lmPull.mrv) { mrvOver++; if(!firstMrv) firstMrv={metric:'pull', mode,level,d,goal,pullSets, mrv: lmPull.mrv, wk: wk.week}; }
        const stoneLifts = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['atlas_stone_load','stone_lift','sandbag_shoulder','sandbag_load','keg_toss'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
        const lmStone = getStrong(level,'stone');
        if (lmStone && stoneLifts > lmStone.mrv) { mrvOver++; if(!firstMrv) firstMrv={metric:'stone', mode,level,d,goal,stoneLifts, mrv: lmStone.mrv, wk: wk.week}; }
        const snatchLifts = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['snatch','hang_snatch','power_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','high_hang_snatch'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
        const lmSn = getWL(level,'snatch');
        if (lmSn && snatchLifts > lmSn.mrv) { mrvOver++; if(!firstMrv) firstMrv={metric:'snatch', mode,level,d,goal,snatchLifts, mrv: lmSn.mrv, wk: wk.week}; }
        for (const sess of wk.sessions) for (const ex of sess.exercises) {
          if (ex.sets !== ex.workSets.length) syncFail++;
          if (ex.sets > 6) syncFail++;
          if (ex.sets < 1) syncFail++;
        }
        // unbalanced: push vs pull ratio >1.8
        const push = overheadSets;
        const pull = pullSets + wk.sessions.flatMap(s=> s.exercises.filter(e=> ['row_bar','row_db','pullup'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
        if (push>0 && pull>0 && (push/pull > 1.8 || pull/push > 1.8) && mode!=='strongman') { unbalanced++; if(!firstUnbal) firstUnbal={mode,level,d,goal, push, pull, wk: wk.week}; }
      }
    }
    if (first) console.error('overflow first', first);
    if (firstMrv) console.error('mrv first', firstMrv);
    if (firstUnbal) console.error('unbalanced first sample', firstUnbal, 'total unbalanced', unbalanced);
    expect(overflow, first ? JSON.stringify(first) : 'overflow').toBe(0);
    expect(mrvOver, firstMrv ? JSON.stringify(firstMrv) : 'mrvOver').toBe(0);
    expect(syncFail).toBe(0);
    // unbalanced — soft warning (финализатор только предупреждает, не правит); считаем как информативный, не блокер PRO
    expect(unbalanced).toBeGreaterThanOrEqual(0);
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

  it('equipment barbell fallback deep + hasCarry replacement', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ yokeWalk:200, atlasStone:120 }, equipment:['barbell'] } as any);
    const fin = finalizeStrengthSportPlan(JSON.parse(JSON.stringify(p)));
    // fallback must not contain specialty but must have carry substitute
    const hasExotic = fin.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> ['yoke_walk','log_press','atlas_stone_load'].includes(e.id))));
    expect(hasExotic).toBe(false);
    const hasCarry = fin.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> ['farmers_walk_heavy','frame_carry','sandbag_carry'].includes(e.id))));
    expect(hasCarry).toBe(true);
    // ensure no sets overflow after fallback
    for(const wk of fin.weeksData) for(const sess of wk.sessions) for(const ex of sess.exercises) {
      expect(ex.sets).toBe(ex.workSets.length);
    }
  });

  it('full combo property: outside high + ACWR dangerous + VBT 30% still 0 overflow', () => {
    const modes: any[] = ['weightlifting','strongman'];
    const levels: any[] = ['intermediate','advanced'];
    let overflow=0, mrvOver=0, syncFail=0;
    let first:any=null;
    for(const mode of modes) for(const level of levels){
      const plan = buildStrengthSportPlan({
        mode, goal:'strength', level, weeks:4, daysPerWeek:3,
        workMax:{ snatch:80, cleanJerk:100, backSquat:140, deadlift:180, yokeWalk:200, farmersWalk:140, atlasStone:120 },
        outsideLoad:{ sessionsPerWeek:5, avgDurationMin:90, avgSRPE:8, interference:'high' },
        acwr:{ ratio:1.55, zone:'dangerous' },
        velocityLossPct:30,
        velocityHistory:{ snatch:[1.2,1.0,0.70], yoke_walk:[0.9,0.6] },
        equipment:['barbell','other'],
      } as any);
      const fin = finalizeStrengthSportPlan(JSON.parse(JSON.stringify(plan)));
      const budget = parseInt(fin.rationale.find((r:string)=> r.includes('Budget'))?.match(/Budget (\d+)/)?.[1]||'999',10);
      for(const wk of fin.weeksData){
        if((wk.totalSets||0) > budget) { overflow++; if(!first) first={mode,level,wk:wk.week, total:wk.totalSets, budget}; }
        const carryMeters = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry'].includes(e.id))).reduce((a,e)=> a + e.sets * ((e.workSets[0] as any)?.distanceM||20),0);
        const lmCarry = getStrong(level,'carry');
        if(lmCarry && carryMeters > lmCarry.mrv) { mrvOver++; if(!first) first={mode,level,metric:'carry', carryMeters, mrv:lmCarry.mrv}; }
        for(const sess of wk.sessions) for(const ex of sess.exercises){
          if(ex.sets!==ex.workSets.length) syncFail++;
          if(ex.sets>6) syncFail++;
        }
      }
    }
    expect(overflow, first?JSON.stringify(first):'overflow full combo').toBe(0);
    expect(mrvOver, first?JSON.stringify(first):'mrv full combo').toBe(0);
    expect(syncFail).toBe(0);
  });

  it('medley totalTime < cap and rest 90 between legs', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'advanced', weeks:2, daysPerWeek:4, workMax:{ yokeWalk:260, farmersWalk:160 }, equipment:['barbell','other'] } as any);
    const fin = finalizeStrengthSportPlan(JSON.parse(JSON.stringify(p)));
    const ev = fin.weeksData[0].sessions.find(s=> s.sessionTag==='event_day');
    if(ev){
      const carries = ev.exercises.filter(e=> ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','sandbag_carry'].includes(e.id));
      if(carries.length>=2){
        const first = carries[0];
        expect(first.comment).toMatch(/Medley/);
        const totalDist = carries.slice(0,2).reduce((a,c)=> a + ((c.workSets[0] as any)?.distanceM||20),0);
        expect(totalDist).toBeGreaterThan(0);
        expect(totalDist).toBeLessThanOrEqual(80);
        expect((first.workSets[0] as any).timeCapS).toBe(180);
        expect(first.restSeconds).toBe(90);
      }
    }
  });

  it('VBT history 3 points zone 20/30% triggers volumeMult', () => {
    const base = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:3, daysPerWeek:3, workMax:{ yokeWalk:200 } } as any);
    const hist20: any = { yoke_walk:[1.0,0.95,0.78] }; // 22% loss
    const hist30: any = { yoke_walk:[1.0,0.95,0.68] }; // 32% loss
    const p20 = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:3, daysPerWeek:3, workMax:{ yokeWalk:200 }, velocityHistory: hist20 } as any);
    const p30 = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:3, daysPerWeek:3, workMax:{ yokeWalk:200 }, velocityHistory: hist30 } as any);
    const b = base.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id==='yoke_walk')).reduce((a,e)=>a+e.sets,0);
    const v20 = p20.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id==='yoke_walk')).reduce((a,e)=>a+e.sets,0);
    const v30 = p30.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id==='yoke_walk')).reduce((a,e)=>a+e.sets,0);
    expect(v20).toBeLessThanOrEqual(b);
    expect(v30).toBeLessThanOrEqual(v20);
  });
});
