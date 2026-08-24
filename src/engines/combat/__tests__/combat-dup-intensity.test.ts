import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { applyCombatDUP } from '../combat-dup';
import { applyCombatIntensity } from '../combat-intensity';

describe('combat DUP/intensity', () => {
  it('DUP power_endurance', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:2, daysPerWeek:3 });
    const before = plan.weeksData[0].sessions[0].exercises[0].rir;
    applyCombatDUP(plan, 'power_endurance');
    const after = plan.weeksData[0].sessions[0].exercises[0].rir;
    expect(typeof after).toBe('number');
    expect(typeof before).toBe('number');
  });
  it('rest_pause adds comment and RIR0', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:2, daysPerWeek:3 });
    applyCombatIntensity(plan, 'rest_pause');
    const has = plan.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.comment?.includes('Rest-pause'))));
    expect(has).toBe(true);
    const acc = plan.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.role==='accessory'))[0];
    if (acc) expect(acc.workSets[acc.workSets.length-1].rir).toBe(0);
  });
  it('dup via builder', () => {
    const p = buildCombatPlan({ discipline:'boxing', goal:'power', level:'intermediate', weeks:2, daysPerWeek:3, dupMode:'power_endurance' });
    expect(p.weeksData.length).toBe(2);
  });
});
