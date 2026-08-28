import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { WL_LANDMARKS, STRONG_LANDMARKS, getWL } from '../strength-sport-volume';
import { selectDiverse, filterByTier, filterByInjury } from '../strength-sport-selection';
import { volumeMultForExercise } from '../strength-sport-specialization';
import { tempoForSS, repsForSS } from '../strength-sport-loading';

describe('strength-sport PRO gym', () => {
  it('WL landmarks per level', () => {
    expect(WL_LANDMARKS.beginner.snatch.mev).toBe(15);
    expect(WL_LANDMARKS.enhanced.snatch.mrv).toBe(95);
    expect(getWL('advanced','snatch')!.mav).toBe(50);
    expect(getWL('intermediate','squat')!.unit).toBe('sets');
  });
  it('focus snatch increases snatch sets', () => {
    const base = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{snatch:70, backSquat:120} });
    const foc = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{snatch:70, backSquat:120}, focus:'snatch' });
    const baseSn = base.weeksData[0].sessions.flatMap(s=>s.exercises.filter(e=>e.id.includes('snatch'))).reduce((a,e)=>a+e.sets,0);
    const focSn = foc.weeksData[0].sessions.flatMap(s=>s.exercises.filter(e=>e.id.includes('snatch'))).reduce((a,e)=>a+e.sets,0);
    expect(focSn).toBeGreaterThanOrEqual(baseSn);
  });
  it('outside high reduces sets', () => {
    const base = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{snatch:70} });
    const out = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{snatch:70}, outsideLoad:{sessionsPerWeek:5, avgDurationMin:90, avgSRPE:8, interference:'high'} });
    expect((out.weeksData[0].totalSets||0)).toBeLessThanOrEqual(base.weeksData[0].totalSets||0);
  });
  it('filterByTier beginner without exotic removes yoke', () => {
    const pool = ['snatch','yoke_walk','back_squat'];
    const f = filterByTier(pool,'beginner', false, false);
    expect(f).not.toContain('yoke_walk');
    expect(f).toContain('back_squat');
  });
  it('filterByInjury knee exclude removes squat', () => {
    const pool=['back_squat','deadlift','ohp'];
    const f = filterByInjury(pool, [{type:'knee', location:'knee', exclude:true} as any]);
    expect(f).not.toContain('back_squat');
    expect(f).toContain('ohp');
  });
  it('filterByInjury knee graded keeps squat (gentle via weight ×0.6)', () => {
    const pool=['back_squat','deadlift','ohp'];
    const f = filterByInjury(pool, [{type:'knee', location:'knee'} as any]);
    expect(f).toContain('back_squat');
  });
  it('selectDiverse respects ANGLE', () => {
    const pool=['snatch','hang_snatch','snatch_pull','back_squat'];
    const fav=new Set<string>();
    const sel = selectDiverse(pool,'snatch_day',3,fav);
    expect(sel.length).toBe(3);
    // should contain at least one from each class if possible
    expect(sel).toContain('snatch');
  });
  it('volumeMultForExercise focus', () => {
    expect(volumeMultForExercise('snatch','snatch')).toBe(1.25);
    expect(volumeMultForExercise('back_squat','snatch')).toBe(0.92);
    expect(volumeMultForExercise('back_squat',null)).toBe(1);
  });
  it('tempoForSS', () => {
    expect(tempoForSS('snatch','тяж','accumulation')).toBe('X-0-X-0');
    expect(tempoForSS('back_squat','тяж','deload')).toBe('3-1-1-0');
  });
  it('repsForSS', () => {
    expect(repsForSS('snatch_day','accumulation','strength',true)).toEqual([1,3]);
    expect(repsForSS('event_day','accumulation','strength',true)).toEqual([1,5]);
  });
});
