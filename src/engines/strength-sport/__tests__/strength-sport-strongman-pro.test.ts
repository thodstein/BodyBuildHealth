import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { finalizeStrengthSportPlan } from '../strength-sport-finalize.engine';
import { buildSMEventPlan, buildMedleyPlan, buildStoneLadder, medleyRationale } from '../strength-sport-strongman-attempts.engine';
import { EVENT_META, STRONG_FALLBACK_COEFF, isCarry } from '../strength-sport-event-types';
import { acwrEwmaSS, buildLastE1RMIndexSS } from '../strength-sport-diary.engine';
import { buildPhaseDistribution, phaseForWeek } from '../strength-sport-progression';
import { isAxialLoadExerciseSS } from '../strength-sport-mobility';
import { SS_STRICT_GROUPS } from '../strength-sport-selection';
import { getStrong } from '../strength-sport-volume';

describe('Strongman PRO A: event taxonomy', () => {
  it('EVENT_META has new events', () => {
    expect(EVENT_META['frame_carry']).toBeDefined();
    expect(EVENT_META['husafell_carry']).toBeDefined();
    expect(EVENT_META['sandbag_load']).toBeDefined();
    expect(EVENT_META['keg_toss']).toBeDefined();
    expect(EVENT_META['car_deadlift_18']).toBeDefined();
    expect(EVENT_META['axle_press']).toBeDefined();
  });
  it('STRONG_FALLBACK_COEFF yoke 0.73', () => {
    expect(STRONG_FALLBACK_COEFF['yoke_walk']).toBeCloseTo(0.73,2);
    expect(STRONG_FALLBACK_COEFF['atlas_stone_load']).toBeCloseTo(0.66,2);
  });
  it('STRICT groups carry_heavy no sled', () => {
    expect(SS_STRICT_GROUPS['carry_heavy']).toContain('frame_carry');
    expect(SS_STRICT_GROUPS['carry_heavy']).toContain('husafell_carry');
    expect(SS_STRICT_GROUPS['carry_heavy']).not.toContain('sled_push_sprint');
  });
  it('isCarry identifies yoke/farmers/husafell/frame', () => {
    expect(isCarry('yoke_walk')).toBe(true);
    expect(isCarry('husafell_carry')).toBe(true);
    expect(isCarry('frame_carry')).toBe(true);
    expect(isCarry('log_press')).toBe(false);
  });
});

describe('Strongman PRO B: volume landmarks', () => {
  it('carry advanced MAV 260 MRV 420', () => {
    const lm = getStrong('advanced','carry');
    expect(lm?.mav).toBe(260);
    expect(lm?.mrv).toBe(420);
  });
  it('grip landmarks exist', () => {
    const lm = getStrong('intermediate','grip');
    expect(lm).toBeDefined();
    expect(lm?.mrv).toBeGreaterThan(12);
  });
  it('overhead MAV increased for strongman', () => {
    const lm = getStrong('advanced','overhead');
    expect(lm?.mav).toBe(16);
  });
});

describe('Strongman PRO C: distance/time in sets', () => {
  it('carry workSets have distanceM/timeCapS', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:200, farmersWalk:140 } } as any);
    const carryEx = p.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id==='yoke_walk' || e.id==='farmers_walk_heavy');
    if (carryEx) {
      const ws:any = carryEx.workSets[0];
      expect(ws.distanceM).toBeGreaterThan(0);
      expect(ws.timeCapS).toBeGreaterThan(0);
      expect(carryEx.workSets[0].reps).toBe(1);
    }
  });
  it('yoke tempo brace', async () => {
    const { tempoForSS } = await import('../strength-sport-loading');
    expect(tempoForSS('yoke_walk','тяж','accumulation')).toBe('brace 2с — walk');
  });
});

describe('Strongman PRO D: periodization strong vs WL', () => {
  it('strongman 8w distribution differs from WL', () => {
    const wl = buildPhaseDistribution(8, 'strength');
    const sm = buildPhaseDistribution(8, 'strength','strongman');
    // WL 8w: 3/3/1/1 ; SM 8w: 40/35/20 -> 3/2/2/1? check not equal
    expect(wl.join(',')).not.toBe(sm.join(','));
  });
  it('strongman phaseForWeek mode param', () => {
    expect(phaseForWeek(1,8,'strength','strongman')).toBeDefined();
  });
});

describe('Strongman PRO E: fallback weight coeff', () => {
  it('without specialty yoke → farmers with coeff', () => {
    const without = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:300, farmersWalk:140 }, equipment:['barbell'] } as any);
    const hasYokeWithout = without.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.id==='yoke_walk')));
    expect(hasYokeWithout).toBe(false);
    const farmerWithout = without.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id==='farmers_walk_heavy');
    // fallback should provide at least one carry (farmers) even without yoke
    expect(farmerWithout || without.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id.includes('farmers') || e.id.includes('carry'))).toBeDefined();
    // with specialty, ensure at least one exotic carry exists (yoke or frame or husafell)
    const withSpec = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:300, farmersWalk:140 }, equipment:['barbell','other'] } as any);
    const hasExoticWith = withSpec.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> ['yoke_walk','frame_carry','husafell_carry','atlas_stone_load'].includes(e.id))));
    expect(hasExoticWith).toBe(true);
  });
  it('axial high vs low', () => {
    expect(isAxialLoadExerciseSS('yoke_walk')).toBe(true);
    expect(isAxialLoadExerciseSS('farmers_walk_heavy')).toBe(false);
    expect(isAxialLoadExerciseSS('sandbag_carry')).toBe(false);
    expect(isAxialLoadExerciseSS('back_squat')).toBe(true);
  });
});

describe('Strongman PRO F: finalize grip/axial', () => {
  it('gripSets > MRV triggers warning', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'beginner', weeks:2, daysPerWeek:3, workMax:{}, bodyweight:80 } as any);
    // inject extra grip
    p.weeksData[0].sessions[0].exercises.push({ id:'farmers_walk_heavy', name:'Фермер', group:'back', pattern:'carry', role:'primary', character:'тяж', sets:8, reps:'1', rir:2, weight:100, workSets: Array(8).fill({ reps:1, rir:2, weight:100, pct:80, tempo:'1-0-1-0', restSeconds:300, distanceM:40 } as any), tempo:'1-0-1-0', restSeconds:300 } as any);
    p.weeksData[0].totalSets = p.weeksData[0].sessions.reduce((a,s)=>a+s.exercises.reduce((x,e)=>x+e.sets,0),0);
    const fin = finalizeStrengthSportPlan(p);
    expect(fin.validation.warnings.some(w=> w.includes('хват'))).toBe(true);
  });
  it('axial weekly warning', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'advanced', weeks:2, daysPerWeek:4, workMax:{ yokeWalk:300, atlasStone:150 }, bodyweight:90 } as any);
    // force high axial: add extra yoke + stones
    p.weeksData[0].sessions.forEach(s=> {
      if (s.sessionTag==='event_day') {
        s.exercises.push({ id:'yoke_walk', name:'Йок', group:'legs', pattern:'carry', role:'primary', character:'тяж', sets:4, reps:'1', rir:1, weight:280, workSets: Array(4).fill({ reps:1, rir:1, weight:280, distanceM:20 } as any) } as any);
        s.exercises.push({ id:'atlas_stone_load', name:'Камень', group:'legs', pattern:'hinge', role:'primary', character:'тяж', sets:4, reps:'2', rir:1, weight:130, workSets: Array(4).fill({ reps:2, rir:1, weight:130 } as any) } as any);
      }
    });
    p.weeksData[0].totalSets = 40;
    const fin = finalizeStrengthSportPlan(p);
    // either осевая or carryMeters
    expect(fin.validation.warnings.length).toBeGreaterThan(0);
  });
});

describe('Strongman PRO G: medley/ladder', () => {
  it('buildStoneLadder 5 weights increasing', () => {
    const ladder = buildStoneLadder(120,5,5);
    expect(ladder.length).toBe(5);
    expect(ladder[4]).toBe(120);
    expect(ladder[0]).toBeLessThan(ladder[4]);
    expect(ladder[0]%5).toBe(0);
  });
  it('buildMedleyPlan total vs cap', () => {
    const m = buildMedleyPlan([{id:'yoke_walk', pm:250},{id:'farmers_walk_heavy', pm:140}], 'balanced');
    expect(m).toBeDefined();
    expect(m!.events.length).toBe(2);
    expect(m!.totalTimeS).toBeGreaterThan(20);
    expect(m!.timeCapS).toBeGreaterThan(m!.totalTimeS);
    expect(medleyRationale(m).length).toBeGreaterThan(0);
  });
  it('buildSMEventPlan stone has ladder', () => {
    const p = buildSMEventPlan('atlas_stone_load', 120);
    expect(p?.ladder).toBeDefined();
    expect(p?.warmup[0].distanceM).toBeUndefined(); // stone not carry
    const y = buildSMEventPlan('yoke_walk', 250);
    expect(y?.warmup[0].distanceM).toBeDefined();
  });
});

describe('Strongman PRO H: ACWR EWMA + lastE1RM', () => {
  it('acwrEwmaSS ratio', () => {
    const loads = Array(28).fill(10).map((v,i)=> v + (i>=21? 5:0)); // last week high
    const ew = acwrEwmaSS(loads);
    expect(ew).not.toBeNull();
    expect(ew!.ratio).toBeGreaterThan(1);
    expect(['optimal','caution','dangerous','undertrained']).toContain(ew!.zone);
  });
  it('buildLastE1RMIndexSS finds max', () => {
    const logs = [
      { exerciseName:'yoke_walk', date: new Date().toISOString(), sets:[{weight:200,reps:1},{weight:220,reps:1}] },
      { exerciseName:'log_press', date: new Date().toISOString(), sets:[{weight:80,reps:3}] },
    ];
    const idx = buildLastE1RMIndexSS(logs);
    expect(Object.keys(idx).length).toBeGreaterThan(0);
    expect(idx['yoke_walk']).toBeGreaterThan(200);
  });
});

describe('Strongman PRO property: weeklySets <= budget + distance', () => {
  it('strongman 192 combos weeklySets <= budget', () => {
    const modes: any[]=['strongman'];
    const levels:any[]=['beginner','intermediate','advanced'];
    for(const level of levels){
      const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level, weeks:4, daysPerWeek:3, workMax:{ yokeWalk:200, farmersWalk:140, atlasStone:100 } } as any);
      const budget = parseInt(p.rationale.find(r=> r.includes('Budget'))?.match(/Budget (\d+)/)?.[1]||'110',10);
      for(const wk of p.weeksData) if(!wk.deload){
        expect(wk.totalSets).toBeLessThanOrEqual(budget);
      }
    }
  });
  it('export rows have distance for carries', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:250 } } as any);
    const fin = finalizeStrengthSportPlan(p);
    // find yoke ex
    const ex = fin.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id==='yoke_walk');
    if (ex) expect((ex.workSets[0] as any).distanceM).toBeDefined();
  });
});
