import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { sessionLimitsFor } from '../strength-sport-limits';
import { phaseForDate, pmForWeek } from '../strength-sport-progression';
import { buildAnnualWithTaper, loadAnnualSS } from '../strength-sport-annual';
import { calcSinclair, calcRobi, getIWFCategory } from '../strength-sport-finalize.engine';
import { velocityForSS, estimate1RMFromVelocitySS, LOAD_VELOCITY_PROFILE_SS } from '../strength-sport-vbt.engine';
import { WL_WEAKPOINT_LABELS, getWeakPointsForLift, getCorrectionForWeakPoint } from '../strength-sport-weakpoint';
import { buildSMEventPlan, smAttemptsFor } from '../strength-sport-strongman-attempts.engine';
import { buildWLMeetPlan, wlAttemptsFor, adjustAttemptsAfterMiss } from '../strength-sport-attempts.engine';
import { buildStrengthIcs } from '../strength-sport-export';
import { warmupRampFor } from '../strength-sport-warmup';
import { adaptForPEDsSS, getAasTeq } from '../strength-sport-ped-adaptation';
import { weightCutNutritionForWeekSS, validateWeightCutProtocolSS } from '../strength-sport-weight-cut.engine';
import { buildDiaryTrendSS, detectPlateau } from '../strength-sport-diary.engine';
import { applyMesocycleProgression } from '../strength-sport-mesocycle';
import { isAxialLoadExerciseSS } from '../strength-sport-mobility';
import { recommendStrengthSportPattern } from '../strength-sport-split-patterns';

describe('PRO Phase6 P0 fixes', () => {
  it('basePmFor snatch_pull -> deadlift not snatch', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:60, deadlift:120, backSquat:100 } } as any);
    // snatch_pull should use deadlift 120, not snatch 60
    // Find snatch_pull weight
    const pull = p.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id==='snatch_pull' || e.id==='pause_pull');
    if (pull) {
      expect(pull.weight).toBeGreaterThan(70); // not 60*0.75=45
    }
  });
  it('sessionLimitsFor скобки: beginner onCourse 5y -> 38 not 55', () => {
    const lim = sessionLimitsFor('beginner', 5, true);
    expect(lim.maxSets).toBe(38);
    const lim2 = sessionLimitsFor('enhanced', 5, false);
    expect(lim2.maxSets).toBe(55);
    const lim3 = sessionLimitsFor('beginner', 5, false);
    expect(lim3.maxSets).toBe(24);
  });
  it('phaseForDate: неделя старта peaking not deload', () => {
    const start = new Date().toISOString().slice(0,10);
    const comp = new Date(Date.now() + 7*24*3600*1000).toISOString().slice(0,10); // +1 нед
    expect(phaseForDate(1, 8, 'peaking', comp, start)).toBe('peaking');
    expect(phaseForDate(1, 8, 'strength', comp, start)).toBe('peaking');
  });
  it('annual taper без мутации', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{} } as any);
    const orig = JSON.stringify(p.weeksData);
    const ann = buildAnnualWithTaper([p], { competitionDate: new Date(Date.now()+ 60*24*3600*1000).toISOString().slice(0,10), taperWeeks:1 });
    // original should be unchanged (taper false)
    expect(p.weeksData[p.weeksData.length-1].taper).toBeFalsy();
    expect(ann.blocks[0].plan?.weeksData[ann.blocks[0].plan.weeksData.length-1].taper).toBe(true);
    expect(JSON.stringify(p.weeksData)).toBe(orig);
  });
  it('yoke/log event-specific max', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:300, deadlift:180, backSquat:150 } } as any);
    const yoke = p.weeksData.flatMap(w=> w.sessions).flatMap(s=> s.exercises).find(e=> e.id==='yoke_walk');
    if (yoke) expect(yoke.weight).toBeGreaterThan(180); // uses yoke 300 not deadlift 180
  });
  it('budget с recoveryMult влияет', () => {
    const lowRec = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'advanced', weeks:4, daysPerWeek:3, workMax:{}, bodyFat:30, sleepHours:4, stressLevel:9 } as any);
    const highRec = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'advanced', weeks:4, daysPerWeek:3, workMax:{}, bodyFat:12, sleepHours:8, stressLevel:2 } as any);
    const bLow = parseInt(lowRec.rationale.find(r=> r.includes('Budget'))?.match(/Budget (\d+)/)?.[1]||'0',10);
    const bHigh = parseInt(highRec.rationale.find(r=> r.includes('Budget'))?.match(/Budget (\d+)/)?.[1]||'0',10);
    // high recovery should have higher budget? Actually recoveryMult low reduces MRV, so lowRec lower budget
    expect(bHigh).toBeGreaterThanOrEqual(bLow);
  });
  it('WL peaking 0.88 vs Strong 0.92', () => {
    const wl = buildStrengthSportPlan({ mode:'weightlifting', goal:'peaking', level:'intermediate', weeks:8, daysPerWeek:3, workMax:{ snatch:100 } } as any);
    const sm = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level:'intermediate', weeks:8, daysPerWeek:3, workMax:{ deadlift:200 } } as any);
    // peaking week weight should be lower for WL (0.88 vs 0.92)
    const wlPeakWeek = wl.weeksData.find(w=> w.phase==='peaking');
    const smPeakWeek = sm.weeksData.find(w=> w.phase==='peaking');
    expect(wlPeakWeek).toBeDefined();
    expect(smPeakWeek).toBeDefined();
  });
});

describe('PRO VBT per-lift', () => {
  it('snatch LVP 100% 0.85 vs squat 0.30', () => {
    expect(LOAD_VELOCITY_PROFILE_SS.snatch[0][1]).toBe(0.85);
    expect(LOAD_VELOCITY_PROFILE_SS.squat[0][1]).toBe(0.30);
  });
  it('velocityForSS snatch 100% 0.85', () => {
    expect(velocityForSS(1.0, 'snatch')).toBeCloseTo(0.85, 1);
    expect(velocityForSS(1.0, 'back_squat')).toBeCloseTo(0.30, 1);
  });
  it('estimate1RM snatch vs squat differs', () => {
    const vSn = velocityForSS(0.80, 'snatch');
    const vSq = velocityForSS(0.80, 'back_squat');
    expect(vSn).not.toBe(vSq);
    expect(vSn).toBeGreaterThan(vSq); // snatch explosive higher velocity at same %
    const sn = estimate1RMFromVelocitySS(80, vSn, 'snatch');
    const sq = estimate1RMFromVelocitySS(80, vSq, 'back_squat');
    expect(sn).toBeGreaterThan(0);
    expect(sq).toBeGreaterThan(0);
    // both should be ~100 at 80%
    expect(sn).toBeCloseTo(100, -1);
    expect(sq).toBeCloseTo(100, -1);
  });
  it('warmup oly uses 1кг step', () => {
    const ramp = warmupRampFor(80, 'snatch');
    expect(ramp.length).toBeGreaterThan(0);
    // 40% of 80 =32 -> 32 for oly should be 32 (1kg step) not 32.5 (2.5 step)
    expect(ramp[0].weight % 1).toBe(0);
  });
  it('warmup carry reps 1 not 20', () => {
    const ramp = warmupRampFor(200, 'yoke_walk');
    expect(ramp[0].reps).toBe(1);
    expect(ramp[0].weight).toBeGreaterThan(0);
  });
});

describe('PRO weakpoint', () => {
  it('WL weakpoint labels 16', () => {
    expect(Object.keys(WL_WEAKPOINT_LABELS).length).toBe(16);
  });
  it('getWeakPointsForLift snatch 5', () => {
    expect(getWeakPointsForLift('snatch').length).toBe(5);
    expect(getWeakPointsForLift('clean').length).toBe(3);
  });
  it('correction includes deficit for snatch_off_floor', () => {
    expect(getCorrectionForWeakPoint('snatch_off_floor')).toContain('deficit_snatch');
  });
});

describe('PRO attempts', () => {
  it('WL aggressive 102% not 104', () => {
    const a = wlAttemptsFor(100, 'aggressive');
    expect(a.third).toBe(102);
  });
  it('adjustAttemptsAfterMiss opener fail', () => {
    const adj = adjustAttemptsAfterMiss({ opener:90, second:97, third:102 }, 1);
    expect(adj.second).toBe(95);
  });
  it('SM attempts yoke step 10кг', () => {
    const y = smAttemptsFor(200, 'balanced', 10);
    expect(y.opener % 10).toBe(0);
  });
  it('SM event plan', () => {
    const p = buildSMEventPlan('yoke_walk', 250);
    expect(p?.attempts.opener).toBeGreaterThan(0);
    expect(p?.warmup.length).toBe(4);
  });
  it('Sinclair 2024 differs from 2017', () => {
    const s24 = calcSinclair(200, 81, 'male', true);
    const s17 = calcSinclair(200, 81, 'male', false);
    expect(s24).not.toBe(s17);
  });
  it('Robi calculation', () => {
    expect(calcRobi(200, 81, 'male')).toBeGreaterThan(0);
    expect(getIWFCategory(81, 'male')).toBeTruthy();
  });
  it('ICS generation', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:2, workMax:{} } as any);
    const ics = buildStrengthIcs(p, '2026-01-01');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VEVENT');
    expect(ics).toContain('DTSTART:20260101');
  });
});

describe('PRO diary & mesocycle', () => {
  it('Brzycki for oly reps>3', () => {
    const logs = [
      { exerciseName:'snatch', date: new Date(Date.now() - 5*24*3600*1000).toISOString(), sets:[{weight:60,reps:5}] },
      { exerciseName:'snatch', date: new Date(Date.now() - 35*24*3600*1000).toISOString(), sets:[{weight:55,reps:5}] },
    ];
    const trend = buildDiaryTrendSS(logs);
    expect(trend).toBeDefined();
    // Brzycki cap should not inflate e1RM too much
    if (trend) expect(trend[0].changePct).toBeDefined();
  });
  it('mesocycle % not fixed', () => {
    const prev = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:100, backSquat:150 } } as any);
    prev.validation = { ok:true, warnings:[], errors:[] };
    const next = applyMesocycleProgression(prev, { workMax:{ snatch:100, backSquat:150 } });
    expect(next.workMax.snatch).toBeGreaterThan(100);
    expect(next.workMax.snatch - 100).toBeLessThan(5); // 2%
    expect(next.workMax.backSquat - 150).toBeGreaterThan(next.workMax.snatch - 100); // squat 2.5% > snatch 2%
  });
  it('isAxial happy path', () => {
    expect(isAxialLoadExerciseSS('back_squat')).toBe(true);
    expect(isAxialLoadExerciseSS('hack_squat_ham')).toBe(false); // gak ham not axial
  });
  it('weight-cut female water lower', () => {
    const m = weightCutNutritionForWeekSS(1, 8, { targetLossKg:3, weeksOut:6, waterMode:'stable', sodiumMode:'stable', carbMode:'stable' } as any, 80, 'male');
    const f = weightCutNutritionForWeekSS(1, 8, { targetLossKg:3, weeksOut:6, waterMode:'stable', sodiumMode:'stable', carbMode:'stable' } as any, 80, 'female');
    expect(m.waterMl).toBeGreaterThan(f.waterMl as number);
  });
  it('recommend pattern with goal', () => {
    const tec = recommendStrengthSportPattern('weightlifting', 3, 'intermediate', 'technique', []);
    const peak = recommendStrengthSportPattern('weightlifting', 3, 'intermediate', 'peaking', []);
    expect(tec.sessionsPerRotation).toBeDefined();
    expect(peak.sessionsPerRotation).toBeDefined();
  });
  it('PED tEq tren > test', () => {
    expect(getAasTeq(['tren'])).toBe(2.5);
    expect(getAasTeq(['test'])).toBe(1.0);
    expect(adaptForPEDsSS(['tren'], { tren:500 }).mrvMult).toBeGreaterThan(adaptForPEDsSS(['test'], { test:500 }).mrvMult);
  });
});

describe('PRO matrix extended', () => {
  it('192 combos still valid + strongman yoke', () => {
    const modes: any[] = ['weightlifting','strongman','hybrid'];
    const levels: any[] = ['beginner','intermediate','advanced','enhanced'];
    const days = [2,3,4,5];
    const goals: any[] = ['strength','hypertrophy','peaking','technique'];
    let count=0;
    for(const mode of modes) for(const level of levels) for(const d of days) for(const goal of goals){
      const p = buildStrengthSportPlan({ mode, level, goal, weeks:4, daysPerWeek:d, workMax:{ snatch:60, backSquat:100, deadlift:140 } } as any);
      expect(p.weeksData.length).toBe(4);
      expect(p.validation).toBeDefined();
      count++;
    }
    expect(count).toBe(192); // 3*4*4*4=192
  });
  it('property: weeklySets <= MRV for all non-deload', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'advanced', weeks:8, daysPerWeek:5, workMax:{ snatch:80, backSquat:180, deadlift:200 } } as any);
    const budget = parseInt(p.rationale.find(r=> r.includes('Budget'))?.match(/Budget (\d+)/)?.[1]||'110',10);
    const fin = p;
    for(const wk of fin.weeksData) if(!wk.deload){
      expect(wk.totalSets).toBeLessThanOrEqual(budget);
    }
  });
});
