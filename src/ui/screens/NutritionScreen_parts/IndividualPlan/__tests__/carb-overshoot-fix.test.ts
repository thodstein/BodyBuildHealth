import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const base = (overrides: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 80, lbmKg: 68, goalKcal: 2500, goalProteinG: 180, goalFatG: 70, goalCarbsG: 250,
  mealsCount: 4, isTrainingDay: false, budget: 'medium', dayOffset: 0,
  excludedIds: new Set(), preferredIds: new Set(),
  ...overrides,
});

describe('carb-overshoot correction', () => {
  it('углеводы не превышают цель более чем на 10%', () => {
    const plan = buildDayPlan(base({ goalCarbsG: 200, goalKcal: 2200, quality: 'basic' }));
    const carbDev = Math.abs(plan.totals.c - 200) / 200;
    expect(carbDev).toBeLessThan(0.18);
  });

  it('в basic режиме углеводы сходятся к цели', () => {
    const plan = buildDayPlan(base({ goalCarbsG: 300, goalKcal: 2800, quality: 'basic' }));
    const carbDev = Math.abs(plan.totals.c - 300) / 300;
    expect(carbDev).toBeLessThan(0.18);
  });

  it('в full режиме углеводы сходятся к цели', () => {
    const plan = buildDayPlan(base({ goalCarbsG: 250, goalKcal: 2500, quality: 'full' }));
    const carbDev = Math.abs(plan.totals.c - 250) / 250;
    expect(carbDev).toBeLessThan(0.18);
  });
});