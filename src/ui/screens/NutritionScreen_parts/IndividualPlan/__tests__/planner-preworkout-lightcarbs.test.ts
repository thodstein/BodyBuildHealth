import { describe, it, expect } from 'vitest';
import { buildDayPlan, isPreWorkoutBannedCarb, isPreWorkoutEasyCarb, type MealPlanInput } from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';

// E2 (PRO-план §3): предтрен — строго «лёгкие» углеводы по умолчанию.
// Инварианты: в pre нет бобовых/овощей/масла/соуса, fiber ≤6 г, fat ≤5 г (по цели).

const train = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 90, lbmKg: 74, bodyFatPct: 18, sex: 'male',
  goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 430,
  mealsCount: 7, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false,
  quality: 'full', randomSalt: 3, wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

describe('E2: isPreWorkoutBannedCarb', () => {
  it('банит бобовые/овощи/масла/соусы/орехи по токенам id', () => {
    for (const id of ['legume_navy_bean', 'lentils', 'veg_broccoli', 'cabbage', 'olive_oil', 'sauce_mayo', 'almonds', 'chia_seeds', 'avocado']) {
      // конструируем минимальный FoodItem-подобный объект
      expect(isPreWorkoutBannedCarb({ id, fat: 1, carbs: 20 } as any), id).toBe(true);
    }
  });
  it('разрешает лёгкие крахмалы/фрукты', () => {
    for (const id of ['rice_white', 'cream_of_rice', 'bread_white', 'banana', 'potato_boiled']) {
      expect(isPreWorkoutBannedCarb({ id, fat: 1, carbs: 60 } as any), id).toBe(false);
    }
  });
  it('масло (fat≥20, carbs<20) банится даже без «oil» в id', () => {
    expect(isPreWorkoutBannedCarb({ id: 'ghee', fat: 99, carbs: 0 } as any)).toBe(true);
  });
  it('null/undefined — безопасно', () => {
    expect(isPreWorkoutBannedCarb(null)).toBe(false);
    expect(isPreWorkoutBannedCarb(undefined)).toBe(false);
  });
});

describe('E2: предтрен лёгкий по умолчанию (products-путь)', () => {
  it('ни один пункт предтрена не off-slot (бобовые/овощи/масло/соус)', () => {
    for (let salt = 1; salt <= 4; salt++) {
      const p = buildDayPlan(train({ randomSalt: salt }));
      const pre = p.meals.find(m => m.type === 'preworkout');
      expect(pre, `salt ${salt}: pre missing`).toBeTruthy();
      for (const it of pre!.items) {
        expect(isPreWorkoutBannedCarb({ id: it.id, fat: it.f, carbs: it.c } as any), `salt ${salt}: ${it.id} off-slot в предтрене`).toBe(false);
      }
    }
  });

  it('предтрен: клетчатка ≤6 г и жир ≤5 г', () => {
    for (let salt = 1; salt <= 4; salt++) {
      const p = buildDayPlan(train({ randomSalt: salt }));
      const pre = p.meals.find(m => m.type === 'preworkout')!;
      // item.fiber — уже абсолютные граммы для порции (как p/f/c).
      const fiber = pre.items.reduce((s, i) => s + (i.fiber || 0), 0);
      const fat = pre.items.reduce((s, i) => s + i.f, 0);
      expect(fiber, `salt ${salt}: fiber ${fiber}`).toBeLessThanOrEqual(6);
      expect(fat, `salt ${salt}: fat ${fat}`).toBeLessThanOrEqual(5.01);
    }
  });

  it('углеводный носитель предтрена — лёгкий крахмал/фрукт (белый список или fallback low-fiber)', () => {
    const p = buildDayPlan(train({ randomSalt: 2 }));
    const pre = p.meals.find(m => m.type === 'preworkout')!;
    const carb = pre.items.find(i => i.role === 'carb_slow' || i.role === 'carb_fast');
    expect(carb).toBeTruthy();
    const food = FOOD_DB.find(f => f.id === carb!.id);
    expect(food).toBeTruthy();
    expect(isPreWorkoutEasyCarb(food as any), `${carb!.id}`).toBe(true);
  });
});
