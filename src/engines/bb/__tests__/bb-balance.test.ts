import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

describe('BB final balance report', () => {
  it('reports press/pull, compound/isolation and position coverage', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, workMax: { chest: 100, back: 120, quads: 140, hamstrings: 100 } });
    expect(plan.balanceReport).toBeTruthy();
    expect(plan.balanceReport!.press + plan.balanceReport!.pull).toBeGreaterThan(0);
    expect(Object.keys(plan.balanceReport!.patterns).length).toBeGreaterThan(0);
  });
});
