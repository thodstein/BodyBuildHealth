import { describe, expect, it } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const input = (quality: 'full' | 'basic'): MealPlanInput => ({
  weightKg: 80,
  lbmKg: 68,
  sex: 'male',
  goalKcal: 2400,
  goalProteinG: 170,
  goalFatG: 70,
  goalCarbsG: 250,
  mealsCount: 5,
  isTrainingDay: false,
  budget: 'medium',
  dayOffset: 0,
  randomSalt: 17,
  quality,
});

describe('nutrition planner quality modes', () => {
  it('full keeps micro coverage and quality notes', () => {
    const plan = buildDayPlan(input('full'));

    expect(plan.meals.length).toBeGreaterThan(0);
    expect(plan.microSummary?.coverage.length).toBeGreaterThan(0);
    expect(plan.notes.some(note => note.startsWith('Сводка MPS:'))).toBe(true);
  });

  it('basic keeps a valid KBJU plan without V2 enrichment', () => {
    const plan = buildDayPlan(input('basic'));

    expect(plan.meals.length).toBeGreaterThan(0);
    expect(plan.totals.kcal).toBeGreaterThan(0);
    expect(plan.microSummary?.coverage).toEqual([]);
    expect(plan.notes.some(note => note.startsWith('Сводка MPS:'))).toBe(false);
  });

  it('quality defaults to full for existing callers', () => {
    const plan = buildDayPlan({ ...input('full'), quality: undefined });

    expect(plan.microSummary?.coverage.length).toBeGreaterThan(0);
  });
});
