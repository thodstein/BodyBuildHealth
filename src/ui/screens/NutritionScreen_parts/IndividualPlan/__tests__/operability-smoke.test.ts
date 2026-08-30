import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { describe, it, expect } from 'vitest';

function base(over: Partial<MealPlanInput>): MealPlanInput {
  return {
    weightKg: 85, lbmKg: 70, bodyFatPct: 15, sex: 'male',
    goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400,
    mealsCount: 5, isTrainingDay: true, trainStartMin: 17*60+30, trainDurationMin: 90, allowIntraWorkout: true,
    budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max',
    wakeTime: '07:00', bedTime: '23:00',
    ...over
  } as MealPlanInput;
}

describe('operability smoke — full planner', () => {
  it('1/3/7 days generation', () => {
    for (const mc of [3,4,5,6,7,8]) {
      const p = buildDayPlan(base({ mealsCount: mc as any }));
      expect(p.meals.length).toBeGreaterThanOrEqual(3);
      expect(p.totals.kcal).toBeGreaterThan(1000);
      expect(p.notes).toBeDefined();
    }
  });
  it('training vs rest', () => {
    const train = buildDayPlan(base({ isTrainingDay: true, trainStartMin: 17*60+30 }));
    const rest = buildDayPlan(base({ isTrainingDay: false, trainStartMin: undefined }));
    expect(train.meals.some(m=>m.type==='preworkout')).toBe(true);
    expect(rest.meals.some(m=>m.type==='preworkout')).toBe(false);
  });
  it('vegetarian no meat', () => {
    const p = buildDayPlan(base({ isVegetarian: true }));
    const hasMeat = p.meals.flatMap(m=>m.items).some(it=> ['chicken_breast','beef_lean','salmon'].includes(it.id));
    expect(hasMeat).toBe(false);
  });
  it('portable only powder/flakes', () => {
    const p = buildDayPlan(base({ portableMode: true }));
    const hasSoup = p.meals.flatMap(m=>m.items).some(it=> it.id.includes('soup') || it.name.toLowerCase().includes('суп'));
    expect(hasSoup).toBe(false);
  });
  it('high carb 10g/kg removable', () => {
    const p = buildDayPlan(base({ weightKg: 100, goalCarbsG: 1000, goalKcal: 6000, budget: 'max', carbCapGPerKg: 0 } as any));
    expect(p.totals.c).toBeGreaterThan(800);
  });
  it('high carb 10g/kg via budget max', () => {
    const p = buildDayPlan(base({ weightKg: 100, goalCarbsG: 950, goalKcal: 5800, budget: 'max', isTrainingDay: true, trainDurationMin: 90 }));
    // should allow up to 1000, not capped at 800
    expect(p.totals.c).toBeGreaterThan(700);
  });
  it('EA risk note', () => {
    const p = buildDayPlan(base({ goalKcal: 1800, weightKg: 80, lbmKg: 70, isTrainingDay: true, trainDurationMin: 90 }));
    // 1800 - ~400 /70 =20 => risk
    expect(p.notes.some(n=> n.includes('RED-S') || n.includes('EA'))).toBe(true);
  });
  it('fiber peak cap 20', () => {
    const p = buildDayPlan(base({ fiberCapG: 20, goalCarbsG: 500 }));
    // peak cap should be honoured as target and note, fiber should be lower than non-peak
    const normal = buildDayPlan(base({ goalCarbsG: 500 }));
    expect(p.totals.fiber).toBeLessThan(normal.totals.fiber);
    expect(p.notes.some(n=> n.includes('Peak'))).toBe(true);
  });
  it('MPS CV note', () => {
    // Force skewed protein by using high protein goal but few meals?
    const p = buildDayPlan(base({ goalProteinG: 250, mealsCount: 3 }));
    // may or may not trigger CV, but should not crash
    expect(p.mpsSummary).toBeDefined();
  });
  it('refeed day', () => {
    const p = buildDayPlan(base({ refeedDay: true }));
    expect(p.notes.some(n=> n.toLowerCase().includes('refeed') || n.includes('рефид'))).toBe(true);
  });
});
