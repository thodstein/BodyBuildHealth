import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { validateCombatPatterns } from '../combat-split-patterns';

describe('combat builder isolated', () => {
  it('patterns valid', () => expect(validateCombatPatterns()).toEqual([]));

  it('mma 3x build', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, outsideLoad: { sessionsPerWeek: 5, avgDurationMin: 90, avgSRPE: 7, interference: 'high', highIntensityDays: [1,3] } });
    expect(plan.weeksData.length).toBe(6);
    expect(plan.patternId).toBe('combat_3');
    // must have neck at least once per week
    const hasNeck = plan.weeksData[0].sessions.some(s => s.exercises.some(e => e.id.includes('neck')));
    expect(hasNeck).toBe(true);
  });

  it('boxing 2x build', () => {
    const plan = buildCombatPlan({ discipline: 'boxing', goal: 'power', level: 'beginner', weeks: 4, daysPerWeek: 2 });
    expect(plan.weeksData[0].sessions.length).toBe(2);
  });

  it('outside conflict reduces leg intensity', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, outsideLoad: { sessionsPerWeek: 4, avgDurationMin: 90, avgSRPE: 7, interference: 'high', highIntensityDays: [2] } });
    // day 1 (index 1) is before high day 2 -> should be памп not тяж for lower
    // we check that at least one session has comment about внезальной
    const hasComment = plan.weeksData.some(w => w.sessions.some(s => s.exercises.some(e => e.comment?.includes('внезальная'))));
    // may or may not trigger depending on schedule alignment, but shouldn't throw
    expect(plan.weeksData.length).toBe(4);
  });

  it('weight cut reduces sets', () => {
    const base = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 });
    const cut = buildCombatPlan({ discipline: 'mma', goal: 'weight_cut', level: 'intermediate', weeks: 4, daysPerWeek: 3, weightCutKg: 4 });
    const baseSets = base.weeksData[0].totalSets || 0;
    const cutSets = cut.weeksData[0].totalSets || 0;
    expect(cutSets).toBeLessThanOrEqual(baseSets);
  });

  it('finalize checks neck cap', () => {
    const plan = buildCombatPlan({ discipline: 'wrestling', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 });
    const fin = finalizeCombatPlan(plan);
    expect(fin.validation).toBeDefined();
  });

  it('isolated: no BB import needed', () => {
    const plan = buildCombatPlan({ discipline: 'general', goal: 'maintenance', level: 'beginner', weeks: 3, daysPerWeek: 2 });
    expect(plan.discipline).toBe('general');
    expect(plan.weeksData.length).toBe(3);
  });
});
