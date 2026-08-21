import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const avgRest = (plan: any): number => {
  let sum = 0, n = 0;
  for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
    if ((e as any).warmupActivator) continue;
    sum += (e.restSeconds || e.workSets?.[0]?.restSeconds || 0); n++;
  }
  return n ? sum / n : 0;
};

describe('BB интенсивность тренинга (отдых/восстановление)', () => {
  it('light → отдых больше, чем high', () => {
    const light = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, intensityLevel: 'light' });
    const high = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, intensityLevel: 'high' });
    expect(avgRest(light)).toBeGreaterThan(avgRest(high));
  });

  it('moderate — базовый отдых (между light и high)', () => {
    const light = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, intensityLevel: 'light' });
    const moderate = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, intensityLevel: 'moderate' });
    const high = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, intensityLevel: 'high' });
    expect(avgRest(moderate)).toBeGreaterThanOrEqual(avgRest(high));
    expect(avgRest(moderate)).toBeLessThanOrEqual(avgRest(light));
  });
});
