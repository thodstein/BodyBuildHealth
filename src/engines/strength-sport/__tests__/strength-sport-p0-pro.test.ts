import { describe, it, expect } from 'vitest';
import { phaseForWeek, buildPhaseDistribution, pmForWeek, rirForWeek } from '../strength-sport-progression';
import { tempoForSS, restForSS } from '../strength-sport-loading';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { finalizeStrengthSportPlan } from '../strength-sport-finalize.engine';
import { buildAnnualWithTaper, validateAnnualSS } from '../strength-sport-annual';
import { applyDUP } from '../strength-sport-dup';
import { adaptForPEDsSS } from '../strength-sport-ped-adaptation';

describe('P0-1 block periodization 3/3/3/1', () => {
  it('10w = 3 acc /3 intens /3 peak /1 deload', () => {
    const d = buildPhaseDistribution(10, 'strength');
    expect(d.filter(p=>p==='accumulation').length).toBe(3);
    expect(d.filter(p=>p==='intensification').length).toBe(3);
    expect(d.filter(p=>p==='peaking').length).toBe(3);
    expect(d.filter(p=>p==='deload').length).toBe(1);
    expect(phaseForWeek(1,10,'strength')).toBe('accumulation');
    expect(phaseForWeek(10,10,'strength')).toBe('deload');
    expect(phaseForWeek(8,10,'strength')).toBe('peaking');
  });
  it('technique longer accumulation', () => {
    const d = buildPhaseDistribution(8, 'technique');
    expect(d.filter(p=>p==='accumulation').length).toBeGreaterThan(3);
    expect(d.includes('peaking')).toBe(false);
  });
});

describe('P0-3 per-lift k', () => {
  it('snatch slower than squat', () => {
    const input:any = { level:'intermediate', weeks:8, goal:'strength' };
    const sn = pmForWeek(100, 8, input, 'snatch');
    const sq = pmForWeek(100, 8, input, 'back_squat');
    expect(sq).toBeGreaterThan(sn);
    expect(sq - sn).toBeGreaterThan(2);
  });
  it('enhanced k = 0.005 not 0.006 (fix)', () => {
    const a:any = { level:'advanced', weeks:8, goal:'strength' };
    const e:any = { level:'enhanced', weeks:8, goal:'strength' };
    const pa = pmForWeek(100, 8, a, 'back_squat');
    const pe = pmForWeek(100, 8, e, 'back_squat');
    // enhanced slightly higher than advanced due to 0.005 vs 0.004 but not double
    expect(pe).toBeGreaterThanOrEqual(pa);
    expect(pe - pa).toBeLessThan(5);
  });
});

describe('P0-2 Prilepin % single source', () => {
  it('snatch accumulation 0.75', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:100, backSquat:150 } });
    const snDay = p.weeksData[0].sessions.find(s=> s.sessionTag==='snatch_day');
    const snEx = snDay?.exercises.find(e=> e.id.includes('snatch'));
    expect(snEx?.workSets[0].pct).toBe(75);
    expect(snEx?.tempo).toBe('X-0-X-0');
  });
  it('RIR for oly higher than strength', () => {
    expect(rirForWeek(2, 8, 'strength', true)).toBe(3);
    expect(rirForWeek(2, 8, 'strength', false)).toBe(2);
  });
});

describe('P0-6 rest 5-8 for carry', () => {
  it('yoke 360s, bench 180s', () => {
    expect(restForSS('тяж', true, 'yoke_walk')).toBe(360);
    expect(restForSS('тяж', true, 'farmers_walk_heavy')).toBe(360);
    expect(restForSS('тяж', true, 'log_press')).toBe(240);
    expect(restForSS('тяж', true, 'back_squat')).toBe(180);
    expect(restForSS('памп', false, 'yoke_walk')).toBe(120);
  });
  it('tempo deload oly keeps X-0-X-0', () => {
    expect(tempoForSS('snatch','тяж','deload')).toBe('X-0-X-0');
    expect(tempoForSS('bench_bar','тяж','deload')).toBe('3-1-1-0');
  });
});

describe('P0-4 budget per level', () => {
  it('beginner < advanced', () => {
    const beg = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'beginner', weeks:4, daysPerWeek:3, workMax:{} });
    const adv = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'advanced', weeks:4, daysPerWeek:3, workMax:{} });
    // через rationale budget
    const bBeg = parseInt(beg.rationale.find(r=> r.includes('Budget'))?.match(/Budget (\d+)/)?.[1]||'0',10);
    const bAdv = parseInt(adv.rationale.find(r=> r.includes('Budget'))?.match(/Budget (\d+)/)?.[1]||'0',10);
    expect(bBeg).toBeLessThan(bAdv);
    expect(bBeg).toBeGreaterThanOrEqual(60);
    expect(bAdv).toBeGreaterThanOrEqual(110);
  });
  it('finalize checks carry meters', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'beginner', weeks:2, daysPerWeek:3, workMax:{ backSquat:100 } });
    // искусственно перегрузим carry — 16 сетов *20 =320м > MRV 250
    const wk = p.weeksData[0];
    wk.sessions[0].exercises.push({ id:'yoke_walk', name:'Йок', group:'legs', pattern:'carry', role:'primary', character:'тяж', sets:16, reps:'5', rir:2, weight:200, workSets: Array(16).fill({ reps:5, rir:2, weight:200, pct:80, tempo:'1-0-1-0', restSeconds:360 }), tempo:'1-0-1-0', restSeconds:360 } as any);
    wk.totalSets = wk.sessions.reduce((a,s)=> a+s.exercises.reduce((x,e)=>x+e.sets,0),0);
    const fin = finalizeStrengthSportPlan(p);
    expect(fin.validation.warnings.some(w=> w.includes('переноски') || w.includes('carry') || w.includes('MRV'))).toBe(true);
  });
});

describe('P0-8 annual taper', () => {
  it('buildAnnualWithTaper marks taper', () => {
    const p1 = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{} });
    const p2 = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level:'advanced', weeks:6, daysPerWeek:3, workMax:{} });
    const ann = buildAnnualWithTaper([p1,p2], { competitionDate: new Date(Date.now()+60*24*3600*1000).toISOString().slice(0,10), taperWeeks:1 });
    expect(ann.blocks[1].taperWeeks).toBe(1);
    expect(ann.blocks[1].competitionDate).toBeTruthy();
    expect(validateAnnualSS(ann).ok).toBe(true);
  });
});

describe('P0-9 limits enforce', () => {
  it('cuts maxSets', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'beginner', weeks:2, daysPerWeek:5, workMax:{} });
    // форсим перебор сетов: 6 упр *6 сетов =36 >24
    const sess = p.weeksData[0].sessions[0];
    sess.exercises = Array(6).fill(null).map((_,i)=> ({ id:`ex${i}`, name:`Ex${i}`, group:'legs', pattern:'squat', role: i<2?'primary':'accessory', character:'тяж', sets:6, reps:'5', rir:2, weight:100, workSets: Array(6).fill({ reps:5, rir:2, weight:100, pct:80, tempo:'2-0-1-0', restSeconds:90 }), tempo:'2-0-1-0', restSeconds:90, isCompetitionLift:false } as any));
    p.weeksData[0].totalSets = 36;
    const fin = finalizeStrengthSportPlan(p);
    const total = fin.weeksData[0].sessions[0].exercises.reduce((a,e)=>a+e.sets,0);
    expect(total).toBeLessThanOrEqual(24);
    expect(fin.validation.warnings.some(w=> w.includes('лимита'))).toBe(true);
  });
});

describe('P1 PED tEq', () => {
  it('tren 500mg ~ 1250 tEq higher mult than test 500', () => {
    const t = adaptForPEDsSS(['tren'], { tren:500 });
    const s = adaptForPEDsSS(['test'], { test:500 });
    expect(t.mrvMult).toBeGreaterThan(s.mrvMult);
  });
});

describe('P1 DUP wave', () => {
  it('wave changes pct', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ backSquat:100 }, dupMode:'wave' } as any);
    // DUP уже применён внутри builder если dupMode wave
    expect(p.weeksData[0].sessions.length).toBeGreaterThan(0);
    // проверь что тяж сессия имеет отличный pct от лёгк
    const w = p.weeksData[0];
    if(w.sessions.length>=3){
      const p0 = w.sessions[0].exercises[0].workSets[0].pct;
      const p2 = w.sessions[2].exercises[0].workSets[0].pct;
      expect(p0).not.toBe(p2);
    }
  });
});
