import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { isSauceCondimentFood, isHerbSpiceId, stapleFamilyOf } from '../food-availability';

// E4 (PRO-план §3): приправы/специи — только вкус, НЕ носитель добора калорий.
// Соус/специя ≤15 г, масло — кап на приём.

const base = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false,
  ...over,
});

const profiles: MealPlanInput[] = [
  base({}),
  base({ isTrainingDay: false, trainStartMin: undefined, dayOffset: 1, weightKg: 60, lbmKg: 48, goalKcal: 1610, goalProteinG: 130, goalFatG: 50, goalCarbsG: 160, variety: 'medium' }),
  base({ dayOffset: 3, weightKg: 95, lbmKg: 78, goalKcal: 4000, goalProteinG: 220, goalFatG: 100, goalCarbsG: 300, budget: 'max' }),
];

describe('E4: соусы/специи — не носитель калорий', () => {
  for (let i = 0; i < profiles.length; i++) {
    it(`профиль ${i}: соус/специя ≤15 г, масло ≤ капа на приём`, () => {
      const p = buildDayPlan({ ...profiles[i], randomSalt: 3 });
      for (const m of p.meals) {
        for (const it of m.items) {
          if (isSauceCondimentFood({ id: it.id } as any)) {
            expect(it.amount, `${m.label}: ${it.id} ${it.amount} г соуса`).toBeLessThanOrEqual(15);
          }
          if (isHerbSpiceId(it.id)) {
            expect(it.amount, `${m.label}: специя ${it.id} ${it.amount} г`).toBeLessThanOrEqual(15);
          }
          if (stapleFamilyOf(it.id) === 'oils') {
            expect(it.amount, `${m.label}: ${it.id} ${it.amount} г масла (кап приёма)`).toBeLessThanOrEqual(30);
          }
        }
      }
    });
  }
});
