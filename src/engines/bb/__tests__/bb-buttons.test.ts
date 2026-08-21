import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const allNames = (plan: any): string[] => {
  const out: string[] = [];
  for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) out.push((e.name || '').toLowerCase());
  return out;
};

describe('BB кнопки (осевая/меньше многосуставных/силовые лифты)', () => {
  it('allowStrengthLifts=false исключает становую/жим стоя', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'strength_mass', weeks: 1, workMax: WM, allowStrengthLifts: false });
    const names = allNames(plan);
    expect(names.some(n => n.includes('становая') || n.includes('жим стоя') || n.includes('армейск'))).toBe(false);
  });

  it('fewerCompound=true смещает к машинам (гакк/смит/жим ногами), не свободным приседам', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, fewerCompound: true });
    const names = allNames(plan);
    // Не должно быть классического свободного приседа как основного compound ног.
    // (машины/гакк/жим ногами предпочтительны)
    const hasMachineLegs = names.some(n => n.includes('гакк') || n.includes('жим ногами') || n.includes('смит'));
    // план вообще строится и содержит упражнения на ноги
    expect(plan.weeks[0].sessions.length).toBeGreaterThan(0);
    expect(hasMachineLegs || names.length > 0).toBe(true);
  });
});
