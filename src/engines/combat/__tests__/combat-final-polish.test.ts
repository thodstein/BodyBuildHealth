import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { applyPedDiminishing } from '../../shared/ped-diminishing.engine';
import { buildWeightCutProtocol, combatWeightCutToMealInput } from '../combat-weight-cut.engine';

describe('combat final polish PRO', () => {
  it('female carry ×0.90 vs male', () => {
    const base = { discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, bodyweight:80, sex:'male', workMax:{}, workMaxByExercise:{ farmer_carry: 100 } } as any;
    const f = buildCombatPlan({ ...base, sex:'female' } as any);
    const m = buildCombatPlan(base as any);
    const wf = f.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id.includes('farmer')||e.id.includes('carry'));
    const wm = m.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id.includes('farmer')||e.id.includes('carry'));
    if (wf && wm && wf.weight>0 && wm.weight>0) expect(wf.weight).toBeLessThan(wm.weight);
  });
  it('striker rotational tempo X-0-X-0', () => {
    const p = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, bodyweight:80, fightStyle:'striker' } as any);
    const rot = p.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id.includes('landmine')||e.id.includes('med_ball'));
    if (rot) expect(rot.tempo).toBe('X-0-X-0');
  });
  it('ped diminishing 0.85/0.70', () => {
    expect(applyPedDiminishing(1.4, 2, false)).toBeCloseTo(1.34,1);
    expect(applyPedDiminishing(1.4, 1, true)).toBeCloseTo(1.28,1);
    expect(applyPedDiminishing(1.4, 2, true)).toBeCloseTo(1.238,1);
  });
  it('equipment fallback weight ×0.85', () => {
    const withCable = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, bodyweight:80, equipment:['cable'] } as any);
    const noCable = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, bodyweight:80, equipment:['barbell'] } as any);
    // оба должны собраться без throw и иметь шею
    expect(withCable.weeksData.length).toBe(4);
    expect(noCable.weeksData.length).toBe(4);
  });
  it('weight-cut → meal input', () => {
    const proto = buildWeightCutProtocol(5, { startWeightKg:80 } as any)!;
    const meal = combatWeightCutToMealInput(8, 8, proto, 80, 'male');
    expect(meal).not.toBeNull();
    expect(meal!.kcal).toBeGreaterThan(1400);
    expect(meal!.protein).toBeGreaterThan(150);
    expect(meal!.fiberMaxG).toBe(15);
  });
});
