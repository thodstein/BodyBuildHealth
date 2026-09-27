import { describe, it, expect } from 'vitest';
import {
  buildDayPlan,
  carbTimingForTrainingDay,
  isPreWorkoutEasyCarb,
  isPostWorkoutFastProtein,
  periProteinBudget,
} from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';

/**
 * Wave 5: Peri-workout nutrition.
 * Pre-workout: easily digestible carbs 60-90 min before training.
 * Post-workout: fast-absorbing protein within 60 min after training.
 * Training day vs rest day: carb timing adjusted based on schedule.
 */

const train = (o: any = {}) => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false, ...o,
});

const rest = (o: any = {}) => train({ isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false, ...o });

describe('Wave 5: carbTimingForTrainingDay', () => {
  it('training day: boosts peri-workout carbs', () => {
    const base = { breakfast: 1.0, lunch: 1.7, dinner: 0.7, prew: 1.0, postw: 1.2, intra: 0.4 };
    const adjusted = carbTimingForTrainingDay(true, base);
    expect(adjusted.prew).toBeGreaterThan(base.prew);
    expect(adjusted.postw).toBeGreaterThan(base.postw);
    expect(adjusted.intra).toBeGreaterThan(base.intra);
  });

  it('rest day: reduces peri-workout carbs, boosts breakfast/lunch', () => {
    const base = { breakfast: 1.0, lunch: 1.7, dinner: 0.7, prew: 1.0, postw: 1.2, intra: 0.4 };
    const adjusted = carbTimingForTrainingDay(false, base);
    expect(adjusted.prew).toBeLessThan(base.prew);
    expect(adjusted.postw).toBeLessThan(base.postw);
    expect(adjusted.breakfast).toBeGreaterThan(base.breakfast);
    expect(adjusted.lunch).toBeGreaterThan(base.lunch);
  });

  it('rest day: peri weights never drop below physiological minimums', () => {
    const base = { breakfast: 1.0, lunch: 1.7, dinner: 0.7, prew: 1.0, postw: 1.2, intra: 0.4 };
    const adjusted = carbTimingForTrainingDay(false, base);
    expect(adjusted.prew).toBeGreaterThanOrEqual(0.3);
    expect(adjusted.postw).toBeGreaterThanOrEqual(0.4);
  });

  it('training day: all weights remain positive', () => {
    const base = { breakfast: 1.0, lunch: 1.7, dinner: 0.7, prew: 1.0, postw: 1.2, snack: 0.5, intra: 0.4 };
    const adjusted = carbTimingForTrainingDay(true, base);
    for (const [k, v] of Object.entries(adjusted)) {
      expect(v, `weight for ${k}`).toBeGreaterThan(0);
    }
  });
});

describe('Wave 5: isPreWorkoutEasyCarb', () => {
  it('accepts known easily-digestible carbs by ID', () => {
    const foods = FOOD_DB.filter(f => ['rice_white', 'bread_white', 'cream_of_rice', 'pasta', 'banana', 'potato'].includes(f.id));
    expect(foods.length).toBeGreaterThan(0);
    for (const f of foods) {
      expect(isPreWorkoutEasyCarb(f), `${f.id} should be easy carb`).toBe(true);
    }
  });

  it('rejects high-fiber carbs unsuitable for pre-workout', () => {
    const foods = FOOD_DB.filter(f => ['lentils', 'chickpeas'].includes(f.id));
    for (const f of foods) {
      expect(isPreWorkoutEasyCarb(f), `${f.id} should NOT be easy carb`).toBe(false);
    }
  });

  it('fallback: accepts low-fiber moderate-GI foods', () => {
    const fakeFood = { id: 'test_food', name: 'Test', protein: 5, fat: 2, carbs: 60, fiber: 2, gi: 55 } as any;
    expect(isPreWorkoutEasyCarb(fakeFood)).toBe(true);
  });

  it('fallback: rejects high-fiber foods even with good GI', () => {
    const fakeFood = { id: 'test_food', name: 'Test', protein: 5, fat: 2, carbs: 60, fiber: 8, gi: 55 } as any;
    expect(isPreWorkoutEasyCarb(fakeFood)).toBe(false);
  });

  it('fallback: rejects very low GI foods (<40)', () => {
    const fakeFood = { id: 'test_food', name: 'Test', protein: 5, fat: 2, carbs: 60, fiber: 1, gi: 30 } as any;
    expect(isPreWorkoutEasyCarb(fakeFood)).toBe(false);
  });

  it('handles null/undefined gracefully', () => {
    expect(isPreWorkoutEasyCarb(null as any)).toBe(false);
    expect(isPreWorkoutEasyCarb(undefined as any)).toBe(false);
  });
});

describe('Wave 5: isPostWorkoutFastProtein', () => {
  it('accepts known fast-absorbing proteins by ID', () => {
    const foods = FOOD_DB.filter(f => ['whey_isolate', 'whey_concentrate', 'egg_white', 'chicken_breast', 'white_fish'].includes(f.id));
    expect(foods.length).toBeGreaterThan(0);
    for (const f of foods) {
      expect(isPostWorkoutFastProtein(f), `${f.id} should be fast protein`).toBe(true);
    }
  });

  it('rejects high-fat proteins unsuitable for post-workout', () => {
    const foods = FOOD_DB.filter(f => ['pork_belly', 'salmon_fatty', 'beef_ribeye'].includes(f.id));
    for (const f of foods) {
      expect(isPostWorkoutFastProtein(f), `${f.id} should NOT be fast protein`).toBe(false);
    }
  });

  it('fallback: accepts high-protein low-fat foods', () => {
    const fakeFood = { id: 'test_protein', name: 'Test', protein: 25, fat: 3, carbs: 0, fiber: 0 } as any;
    expect(isPostWorkoutFastProtein(fakeFood)).toBe(true);
  });

  it('fallback: rejects low-protein foods', () => {
    const fakeFood = { id: 'test_protein', name: 'Test', protein: 5, fat: 2, carbs: 60, fiber: 2 } as any;
    expect(isPostWorkoutFastProtein(fakeFood)).toBe(false);
  });

  it('handles null/undefined gracefully', () => {
    expect(isPostWorkoutFastProtein(null as any)).toBe(false);
    expect(isPostWorkoutFastProtein(undefined as any)).toBe(false);
  });
});

describe('Wave 5: buildDayPlan peri-workout integration', () => {
  it('training day: pre-workout meal exists with easily digestible carbs', () => {
    for (const salt of [1, 2, 3]) {
      const plan = buildDayPlan(train({ randomSalt: salt }));
      const prew = plan.meals.find(m => m.type === 'preworkout');
      expect(prew, `salt ${salt}: pre-workout meal missing`).toBeTruthy();
      const carbs = prew!.items.reduce((s, i) => s + i.c, 0);
      expect(carbs, `salt ${salt}: pre-workout carbs ${carbs}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('training day: post-workout meal exists with fast-absorbing protein', () => {
    for (const salt of [1, 2, 3]) {
      const plan = buildDayPlan(train({ randomSalt: salt }));
      const postw = plan.meals.find(m => m.type === 'postworkout');
      expect(postw, `salt ${salt}: post-workout meal missing`).toBeTruthy();
      const protein = postw!.items.reduce((s, i) => s + i.p, 0);
      expect(protein, `salt ${salt}: post-workout protein ${protein}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('rest day: no pre/post-workout meals', () => {
    const plan = buildDayPlan(rest({ randomSalt: 1 }));
    const prew = plan.meals.find(m => m.type === 'preworkout');
    const postw = plan.meals.find(m => m.type === 'postworkout');
    expect(prew).toBeUndefined();
    expect(postw).toBeUndefined();
  });

  it('training day: peri-workout carbs are a meaningful share of daily carbs', () => {
    const plan = buildDayPlan(train({ randomSalt: 1 }));
    const totalCarbs = plan.totals.c;
    const prew = plan.meals.find(m => m.type === 'preworkout');
    const postw = plan.meals.find(m => m.type === 'postworkout');
    const periCarbs = (prew?.totals.c || 0) + (postw?.totals.c || 0);
    const periShare = periCarbs / totalCarbs;
    expect(periShare).toBeGreaterThan(0.15);
    expect(periShare).toBeLessThan(0.55);
  });

  it('training day: peri protein budget is respected', () => {
    const plan = buildDayPlan(train({ randomSalt: 1 }));
    const budget = periProteinBudget(73.8, true, { preworkout: true, postworkout: true });
    const prew = plan.meals.find(m => m.type === 'preworkout');
    const postw = plan.meals.find(m => m.type === 'postworkout');
    const prewP = prew?.items.reduce((s, i) => s + i.p, 0) || 0;
    const postwP = postw?.items.reduce((s, i) => s + i.p, 0) || 0;
    expect(prewP).toBeGreaterThanOrEqual(15);
    expect(postwP).toBeGreaterThanOrEqual(20);
  });

  it('training day: pre-workout has low fat (<=8g) for gastric emptying', () => {
    const plan = buildDayPlan(train({ randomSalt: 1 }));
    const prew = plan.meals.find(m => m.type === 'preworkout');
    expect(prew).toBeTruthy();
    const fat = prew!.items.reduce((s, i) => s + i.f, 0);
    expect(fat).toBeLessThanOrEqual(8);
  });

  it('training day: post-workout has fast carbs (high GI preferred)', () => {
    const plan = buildDayPlan(train({ randomSalt: 1 }));
    const postw = plan.meals.find(m => m.type === 'postworkout');
    expect(postw).toBeTruthy();
    const carbs = postw!.items.reduce((s, i) => s + i.c, 0);
    expect(carbs).toBeGreaterThanOrEqual(30);
  });

  it('carb timing: training day shifts carbs toward peri windows vs rest day', () => {
    const trainPlan = buildDayPlan(train({ randomSalt: 1, carbAutoCycle: true }));
    const restPlan = buildDayPlan(rest({ randomSalt: 1, carbAutoCycle: true }));
    const trainPeriCarbs = (trainPlan.meals.find(m => m.type === 'preworkout')?.totals.c || 0)
      + (trainPlan.meals.find(m => m.type === 'postworkout')?.totals.c || 0);
    const restPeriCarbs = (restPlan.meals.find(m => m.type === 'preworkout')?.totals.c || 0)
      + (restPlan.meals.find(m => m.type === 'postworkout')?.totals.c || 0);
    expect(trainPeriCarbs).toBeGreaterThan(restPeriCarbs);
  });

  it('training day: intra-workout meal exists for long sessions (>=75min)', () => {
    const plan = buildDayPlan(train({ randomSalt: 1, trainDurationMin: 90 }));
    const intra = plan.meals.find(m => m.type === 'intra');
    expect(intra).toBeTruthy();
  });

  it('training day: no intra-workout for short sessions (<75min)', () => {
    const plan = buildDayPlan(train({ randomSalt: 1, trainDurationMin: 60 }));
    const intra = plan.meals.find(m => m.type === 'intra');
    expect(intra).toBeUndefined();
  });
});

describe('Wave 5: periProteinBudget with training schedule', () => {
  it('training day with both slots: budget is LBM-scaled', () => {
    const budget = periProteinBudget(73.8, true, { preworkout: true, postworkout: true });
    expect(budget.preworkoutG).toBeGreaterThanOrEqual(20);
    expect(budget.postworkoutG).toBeGreaterThanOrEqual(25);
    expect(budget.totalG).toBe(budget.preworkoutG + budget.postworkoutG);
  });

  it('rest day: budget is zero', () => {
    const budget = periProteinBudget(73.8, false, { preworkout: true, postworkout: true });
    expect(budget.totalG).toBe(0);
  });

  it('training day with only preworkout: budget is pre-only', () => {
    const budget = periProteinBudget(73.8, true, { preworkout: true, postworkout: false });
    expect(budget.preworkoutG).toBeGreaterThanOrEqual(20);
    expect(budget.postworkoutG).toBe(0);
  });

  it('small LBM: budget scales down (not fixed 25/35)', () => {
    const small = periProteinBudget(45, true, { preworkout: true, postworkout: true });
    const large = periProteinBudget(90, true, { preworkout: true, postworkout: true });
    expect(small.totalG).toBeLessThan(large.totalG);
  });
});
