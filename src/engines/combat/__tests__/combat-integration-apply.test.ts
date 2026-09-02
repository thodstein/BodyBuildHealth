import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { combatToNutritionPayload, combatToCardioPayload } from '../combat-integration.engine';
import { combatWeightCutToMealInput, buildWeightCutProtocol } from '../combat-weight-cut.engine';

describe('combat integration apply', () => {
  it('payload contains ISSN fields', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'weight_cut', level:'intermediate', weeks:4, daysPerWeek:3, weightCutKg:4, bodyweight:80 } as any);
    const nut = combatToNutritionPayload(plan);
    expect(nut.kcal).toBeGreaterThan(1400);
    expect(nut.fiberG).toBe(28); // W1 camp
    expect(nut.mealInput).toBeDefined();
    expect(nut.mealInput.fiberMaxG).toBe(28);
    // direct fight week should be 10
    const proto = buildWeightCutProtocol(4, { startWeightKg:80 } as any);
    expect(combatWeightCutToMealInput(4,4,proto,80,'male')!.fiberMaxG).toBe(10);
  });
  it('cardio payload zone2 even high outside', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, outsideLoad:{ sessionsPerWeek:5, avgDurationMin:90, avgSRPE:7 } } as any);
    const card = combatToCardioPayload(plan);
    expect(card).not.toBeNull();
    expect(card!.zone2MinPerWeek).toBeGreaterThan(0);
    expect(card!.needsAerobicMaintenance).toBe(true);
  });
  it('he-combat-updated payload structure', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const nut = combatToNutritionPayload(plan);
    const card = combatToCardioPayload(plan);
    const detail = { planId: plan.id, nutrition: nut, cardio: card };
    expect(detail.planId).toBe(plan.id);
    expect(detail.nutrition.kcal).toBeDefined();
    expect(detail.cardio?.zone2MinPerWeek).toBeDefined();
  });
});
