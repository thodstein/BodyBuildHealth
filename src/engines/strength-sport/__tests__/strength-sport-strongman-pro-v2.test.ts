import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { finalizeStrengthSportPlan } from '../strength-sport-finalize.engine';
import { EVENT_META, STRONG_FALLBACK_COEFF, isCarry } from '../strength-sport-event-types';
import { SS_STRICT_GROUPS } from '../strength-sport-selection';
import { TAPER_CESSATION_DAYS, taperForWeekFromEnd, isEventCessated, buildTaperRationale } from '../strength-sport-taper.engine';
import { buildStrongmanPoints, pointsForPlace, buildMedleyPlan } from '../strength-sport-strongman-attempts.engine';
import { conditioningForWeek, modalityForWeek, buildConditioningRationale } from '../strength-sport-conditioning';
import { VBT_SS_THRESHOLDS, velocityForSS } from '../strength-sport-vbt.engine';
import { buildAnnualMultiPeak, buildAnnualFromSS } from '../strength-sport-annual';
import { CONTEST_PRESETS, validateContest } from '../strength-sport-contest.types';

describe('Strongman PRO v2: contest packet taxonomy A', () => {
  it('EVENT_META 35+ events', () => {
    expect(Object.keys(EVENT_META).length).toBeGreaterThanOrEqual(35);
    expect(EVENT_META['conan_wheel']).toBeDefined();
    expect(EVENT_META['viking_press']).toBeDefined();
    expect(EVENT_META['truck_pull']).toBeDefined();
    expect(EVENT_META['atlas_stone_over_bar']).toBeDefined();
    expect(EVENT_META['natural_stone_shoulder']).toBeDefined();
    expect(EVENT_META['duck_walk']).toBeDefined();
  });
  it('STRONG_FALLBACK_COEFF covers new', () => {
    expect(STRONG_FALLBACK_COEFF['conan_wheel']).toBeDefined();
    expect(STRONG_FALLBACK_COEFF['truck_pull']).toBeDefined();
    expect(STRONG_FALLBACK_COEFF['viking_press']).toBeDefined();
  });
  it('STRICT 12 groups', () => {
    expect(Object.keys(SS_STRICT_GROUPS).length).toBeGreaterThanOrEqual(12);
    expect(SS_STRICT_GROUPS['carry_drag']).toBeDefined();
    expect(SS_STRICT_GROUPS['overhead_medley']).toBeDefined();
  });
  it('CONTEST_PRESETS 3 presets valid', () => {
    expect(CONTEST_PRESETS['uss_105'].events.length).toBeGreaterThanOrEqual(5);
    expect(validateContest(CONTEST_PRESETS['uss_105']).length).toBe(0);
    expect(validateContest({ events: [] } as any).length).toBeGreaterThan(0);
  });
  it('contest injection prioritizes yoke+stone over generic', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ yokeWalk:250, atlasStone:120 }, contest: CONTEST_PRESETS['uss_105'], equipment:['barbell','other'] } as any);
    const hasYoke = p.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> ['yoke_walk','atlas_stone_load'].includes(e.id))));
    expect(hasYoke).toBe(true);
    const rationaleContest = p.rationale.some(r=> r.includes('Контест'));
    expect(rationaleContest).toBe(true);
  });
});

describe('Strongman PRO v2: taper Winwood D', () => {
  it('cessation days per event', () => {
    expect(TAPER_CESSATION_DAYS['yoke_walk']).toBe(7);
    expect(TAPER_CESSATION_DAYS['log_press']).toBe(5);
    expect(TAPER_CESSATION_DAYS['tire_flip']).toBe(4);
    expect(TAPER_CESSATION_DAYS['sled_push_sprint']).toBe(3);
  });
  it('isEventCessated true when daysOut < need', () => {
    expect(isEventCessated('yoke_walk', 3)).toBe(true);
    expect(isEventCessated('yoke_walk', 8)).toBe(false);
  });
  it('WINWOOD_TAPER week1 vs week2', () => {
    const w1 = taperForWeekFromEnd(1);
    const w2 = taperForWeekFromEnd(2);
    expect(w1.volumeMult).toBeCloseTo(0.45,2);
    expect(w2.volumeMult).toBeCloseTo(0.55,2);
    expect(w1.intensityPctMult).toBeLessThan(w2.intensityPctMult);
  });
  it('buildTaperRationale strongman emits', () => {
    const r = buildTaperRationale(8, '2026-09-20');
    expect(r.join(' ')).toMatch(/Winwood/);
  });
  it('contest taper cessats yoke in last week', () => {
    const start = new Date(); start.setDate(start.getDate() + 0);
    const comp = new Date(start); comp.setDate(comp.getDate() + 21); // 3нед
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level:'advanced', weeks:3, daysPerWeek:3, workMax:{ yokeWalk:300 }, competitionDate: comp.toISOString().slice(0,10), startDate: start.toISOString().slice(0,10), contest: { events:[{id:'yoke_walk', format:'max', weight:300}] } } as any);
    // last week should have taper flag or reduced sets for yoke
    const last = p.weeksData[2];
    const yokeEx = last.sessions.flatMap(s=> s.exercises).find(e=> e.id==='yoke_walk');
    if (yokeEx) expect(yokeEx.sets).toBeLessThanOrEqual(3);
  });
});

describe('Strongman PRO v2: points E', () => {
  it('pointsForPlace', () => {
    expect(pointsForPlace(1,10)).toBe(10);
    expect(pointsForPlace(10,10)).toBe(1);
    expect(pointsForPlace(2,12)).toBe(11);
  });
  it('buildStrongmanPoints sums', () => {
    const r = buildStrongmanPoints([{event:'yoke', place:1, points:10},{event:'log', place:3, points:8}]);
    expect(r.totalPoints).toBe(18);
    expect(r.averagePlace).toBeCloseTo(2,1);
  });
});

describe('Strongman PRO v2: conditioning F', () => {
  it('modalityForWeek progression', () => {
    expect(modalityForWeek(1,12,'strongman')).toBe('aerobic');
    expect(modalityForWeek(11,12,'strongman')).toBe('alactic');
  });
  it('conditioningForWeek strongman non-empty', () => {
    const c = conditioningForWeek(1,8,'strongman', false);
    expect(c.length).toBeGreaterThan(0);
    expect(buildConditioningRationale(1,8,'strongman').length).toBeGreaterThan(0);
  });
  it('conditioning outside high -> empty', () => {
    expect(conditioningForWeek(5,8,'strongman', true).length).toBe(0);
  });
});

describe('Strongman PRO v2: VBT thresholds H', () => {
  it('VBT_SS_THRESHOLDS defined for yoke/stone', () => {
    expect(VBT_SS_THRESHOLDS['yoke_walk']).toBeDefined();
    expect(VBT_SS_THRESHOLDS['atlas_stone_load']).toBeDefined();
    expect(velocityForSS(0.80,'yoke_walk')).toBeGreaterThan(velocityForSS(0.90,'yoke_walk'));
  });
  it('velocityForSS carry faster than squat at same pct', () => {
    const yoke08 = velocityForSS(0.80,'yoke_walk');
    const squat08 = velocityForSS(0.80,'back_squat');
    expect(yoke08).toBeGreaterThan(squat08);
  });
});

describe('Strongman PRO v2: annual multi-peak H', () => {
  it('buildAnnualMultiPeak 2 comps + gpp', () => {
    const p1 = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:8, daysPerWeek:3, workMax:{ yokeWalk:200 } } as any);
    const p2 = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level:'advanced', weeks:6, daysPerWeek:3, workMax:{ yokeWalk:250 } } as any);
    const ann = buildAnnualMultiPeak([p1,p2], { competitions:[{date:'2026-09-01'},{date:'2026-12-01'}], gppWeeks:4, transitionWeeks:2 });
    expect(ann.blocks.length).toBeGreaterThanOrEqual(4); // gpp + peak1 + trans + peak2
    expect(ann.totalWeeks).toBeGreaterThan(14);
    expect(ann.blocks[0].id).toMatch(/gpp/);
    expect(ann.blocks.some(b=> b.competitionDate==='2026-09-01')).toBe(true);
  });
});
