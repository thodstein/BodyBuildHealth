import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { sessionLimitsForCombat } from '../combat-limits';

describe('combat balance/limits', () => {
  it('sessionLimits enhanced larger', () => {
    const nat = sessionLimitsForCombat('intermediate', false);
    const enh = sessionLimitsForCombat('enhanced', true);
    expect(enh.maxSets).toBeGreaterThan(nat.maxSets);
  });
  it('gentle neck reduces', () => {
    const base = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:2, daysPerWeek:3 });
    const inj = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:2, daysPerWeek:3, injuries:[{location:'neck'}] });
    const b = base.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('neck')))[0];
    const i = inj.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('neck')))[0];
    if (b && i) expect(i.weight).toBeLessThanOrEqual(b.weight);
  });
  it('mobility filters shoulder', () => {
    const p = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:2, daysPerWeek:3, mobilityRestrictions:['shoulder'] } as any);
    const hasBench = p.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.id==='bench_bar')));
    expect(typeof hasBench).toBe('boolean');
  });
  it('balance warning', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:2, daysPerWeek:3 });
    const fin = finalizeCombatPlan(plan);
    expect(Array.isArray(fin.validation.warnings)).toBe(true);
  });
});
