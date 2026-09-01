import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { buildAnnualFromSS, buildAnnualWithTaper, validateAnnualSSPhases, weeksUntilCompetition } from '../strength-sport-annual';

describe('annual taper 2нед separate', () => {
  it('buildAnnualWithTaper 1нед taper marks last week', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ yokeWalk:200 } } as any);
    const annual = buildAnnualWithTaper([p], { competitionDate: '2026-09-01', taperWeeks:1 });
    const last = annual.blocks[0];
    expect(last.taperWeeks).toBe(1);
    expect(last.competitionDate).toBe('2026-09-01');
    const taperWeeks = last.plan!.weeksData.filter((w:any)=> w.taper);
    expect(taperWeeks.length).toBe(1);
    expect(taperWeeks[0].phase).toBe('peaking');
  });
  it('buildAnnualWithTaper 2нед taper marks last 2 weeks as taper', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'peaking', level:'advanced', weeks:6, daysPerWeek:4, workMax:{ snatch:90 } } as any);
    const annual = buildAnnualWithTaper([p], { competitionDate: '2026-10-15', taperWeeks:2 });
    const last = annual.blocks[0];
    expect(last.taperWeeks).toBe(2);
    const tw = last.plan!.weeksData.filter((w:any)=> w.taper);
    expect(tw.length).toBe(2);
    // taper not deload
    expect(tw.every((w:any)=> !w.deload)).toBe(true);
    // validate passes with taper
    const warns = validateAnnualSSPhases(annual);
    expect(warns.filter(w=> w.includes('taper')).length).toBe(0);
  });
  it('validateAnnualSSPhases 3x peaking warns', () => {
    const p1 = buildStrengthSportPlan({ mode:'weightlifting', goal:'peaking', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    const p2 = buildStrengthSportPlan({ mode:'weightlifting', goal:'peaking', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    const p3 = buildStrengthSportPlan({ mode:'weightlifting', goal:'peaking', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    // force phase peaking via manual injection
    for(const p of [p1,p2,p3]) for(const w of p.weeksData) w.phase='peaking' as any;
    const annual = buildAnnualFromSS([p1,p2,p3] as any);
    const warns = validateAnnualSSPhases(annual);
    expect(warns.some(w=> w.includes('3+ peaking'))).toBe(true);
  });
  it('validateAnnualSSPhases taper mismatch warns', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{} } as any);
    const annual = buildAnnualWithTaper([p], { competitionDate: '2026-09-01', taperWeeks:1 });
    // manually break taper
    annual.blocks[0].taperWeeks = 2;
    const warns = validateAnnualSSPhases(annual);
    expect(warns.some(w=> w.includes('taper'))).toBe(true);
  });
  it('weeksUntilCompetition fallback', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{} } as any);
    const annual = buildAnnualFromSS([p] as any);
    const w = weeksUntilCompetition(annual, '2026-12-01');
    expect(typeof w === 'number' || w===null).toBe(true);
    const w2 = weeksUntilCompetition(annual, '2026-12-01', '2026-09-01');
    expect(w2).not.toBeNull();
  });
  it('bridge MANUAL taper separate phase', async () => {
    const { syncStrengthAnnualToGeneral } = await import('../strength-sport-annual-bridge');
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ yokeWalk:200 } } as any);
    const annual = buildAnnualWithTaper([p], { competitionDate: '2026-10-01', taperWeeks:2 });
    // mock localStorage
    const store:any = {};
    const origGet = global.localStorage?.getItem;
    const origSet = global.localStorage?.setItem;
    try{
      (global as any).localStorage = {
        getItem:(k:string)=> store[k]||null,
        setItem:(k:string,v:string)=> { store[k]=v; },
        removeItem:(k:string)=> delete store[k],
      } as any;
      syncStrengthAnnualToGeneral(annual);
      const general = JSON.parse(store['he_annual_training_plan_v1']);
      // should have 2 blocks (main + taper) for 1 SS block with 2нед taper
      expect(general.blocks.length).toBe(2);
      expect(general.blocks[1].ref.phase).toBe('taper');
      expect(general.blocks[1].config.taper.enabled).toBe(true);
    } finally {
      if(origGet) (global as any).localStorage.getItem = origGet;
      if(origSet) (global as any).localStorage.setItem = origSet;
    }
  });
});
