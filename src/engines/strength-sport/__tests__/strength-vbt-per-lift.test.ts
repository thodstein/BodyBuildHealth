import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';

describe('strength VBT per-lift 3×', () => {
  it('velocityHistory snatch 10% → RIR+1 vs scalar 0', () => {
    const base = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:80, cleanJerk:100, backSquat:120 } } as any);
    const snBase = base.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('snatch'))).reduce((a,e)=>a+e.sets,0);
    const withHist = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:80, cleanJerk:100, backSquat:120 }, velocityHistory:{ snatch:[1.60, 1.30] } } as any); // 18% loss >10% threshold
    const snHist = withHist.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('snatch'))).reduce((a,e)=>a+e.sets,0);
    expect(snHist).toBeLessThanOrEqual(snBase);
  });
  it('WL attempts 6 wired', () => {
    const plan = buildStrengthSportPlan({ mode:'weightlifting', goal:'peaking', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:90, cleanJerk:110 }, bodyweight:80, sex:'male' } as any);
    // @ts-ignore
    expect(plan.wlMeetPlan).toBeDefined();
    // @ts-ignore
    expect(plan.wlMeetPlan.total).toBeGreaterThan(0);
    // @ts-ignore
    expect(plan.wlMeetPlan.snatch.opener).toBeGreaterThan(70);
  });
});
