/**
 * planner-meal-structure.test.ts — E1/E2/E3: структура дня (инсулин/ААС),
 * утренний белок, единый учёт рабочего графика и portable в рецептах.
 */
import { describe, it, expect } from 'vitest';
import { planMealStructure, perMealProteinCapG } from '../planner-meal-count';
import { resolveShiftWorkDay, isWorkDayForIndex } from '../planner-work';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay } from '../planner-recipe-mode';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { isPortableFood } from '../food-availability';

describe('E1: planMealStructure — приёмы с учётом инсулина и ААС', () => {
  it('обычный день: 5 основных, без окон и peri', () => {
    const s = planMealStructure({ awakeH: 16, proteinG: 180, carbsG: 400, kcal: 3000, weightKg: 85 });
    expect(s.regularMeals).toBe(5);
    expect(s.insulinWindows).toBe(0);
    expect(s.periMeals).toBe(0);
    expect(s.totalMeals).toBe(5);
  });

  it('ААС/курс: кап белка 0.55 г/кг (111 кг → 61 г)', () => {
    expect(perMealProteinCapG(111, true)).toBe(61);
    expect(perMealProteinCapG(111, false)).toBe(50);
    const s = planMealStructure({ awakeH: 16, proteinG: 400, carbsG: 500, kcal: 4700, weightKg: 111, onCourse: true });
    expect(s.pCap).toBe(61);
    expect(s.regularMeals).toBeGreaterThanOrEqual(7); // 400/61 = 7
  });

  it('инсулин: окна учитываются в числе приёмов', () => {
    const s = planMealStructure({ awakeH: 16, proteinG: 220, carbsG: 800, kcal: 5100, weightKg: 110, insulinBoluses: 3 });
    expect(s.insulinWindows).toBe(3);
    expect(s.regularMeals).toBeGreaterThanOrEqual(6); // 3 окна + 3
  });

  it('peri: трен-день учитывает приёмы вокруг тренировки', () => {
    expect(planMealStructure({ awakeH: 16, proteinG: 180, carbsG: 400, kcal: 3000, weightKg: 85, isTrainingDay: true, allowIntraWorkout: true }).periMeals).toBe(3);
    expect(planMealStructure({ awakeH: 16, proteinG: 180, carbsG: 400, kcal: 3000, weightKg: 85, isTrainingDay: true }).periMeals).toBe(2);
  });
});

describe('E3b: единый учёт рабочего графика (смены)', () => {
  it('shift_day_night: 2 через 2', () => {
    expect([0, 1, 2, 3, 4].map(i => resolveShiftWorkDay(i, 'shift_day_night'))).toEqual([true, true, false, false, true]);
  });
  it('shift_2_1: 2 работы / 1 отдых', () => {
    expect([0, 1, 2, 3, 4].map(i => resolveShiftWorkDay(i, 'shift_2_1'))).toEqual([true, true, false, true, true]);
  });
  it('календарь (не смена): workDays по индексу', () => {
    const workDays = [true, false, true, false, true, false, false]; // Пн,Ср,Пт
    expect(isWorkDayForIndex(0, { enabled: true, workDays, dowBase: 0 })).toBe(true);
    expect(isWorkDayForIndex(1, { enabled: true, workDays, dowBase: 0 })).toBe(false);
    expect(resolveShiftWorkDay(0, 'standard')).toBeNull();
  });
});

const base = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 110, lbmKg: 92, bodyFatPct: 16, sex: 'male',
  goalKcal: 4700, goalProteinG: 400, goalFatG: 100, goalCarbsG: 520,
  mealsCount: 6, isTrainingDay: false, budget: 'medium', dayOffset: 0,
  cyclePhase: 'course', variety: 'medium', eveningLowCarb: false, quality: 'basic',
  randomSalt: 3, carbCapGPerKg: 0, wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
} as MealPlanInput);

describe('E2: утренний белок на курсе / при высоком белке', () => {
  it('400 г белка, курс: завтрак ≥ 0.5 г/кг и ≤ MPS-коридора', () => {
    const p = buildDayPlan(base({ mealsCount: 6 }));
    const bf = p.meals.find((m: any) => m.type === 'breakfast' || /Завтрак/i.test(m.label))!;
    expect(bf, 'завтрак есть').toBeTruthy();
    expect(bf.target?.p || 0).toBeGreaterThanOrEqual(50); // 110 кг × 0.5
    expect(bf.target?.p || 0).toBeLessThanOrEqual(68);    // _mainPCap
  });

  it('обычный белок без курса: завтрак не форсируется', () => {
    const p = buildDayPlan(base({ mealsCount: 5, weightKg: 85, lbmKg: 70, goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408, cyclePhase: 'maintenance' as any }));
    const bf = p.meals.find((m: any) => m.type === 'breakfast' || /Завтрак/i.test(m.label))!;
    expect(bf.target?.p || 0).toBeLessThan(50);
  });
});

describe('E3a: portable в рецептурном рабочем окне', () => {
  const meals = () => ([
    { label: 'Завтрак', time: '08:00', items: [], totals: { kcal: 0, p: 0, f: 0, c: 0 }, target: { p: 45, c: 120, f: 20 } },
    { label: 'Обед', time: '13:00', items: [{ id: 'oats_dry', name: 'Овсяные хлопья', amount: 80, kcal: 300, p: 10, f: 6, c: 50, role: 'carb' }], totals: { kcal: 300, p: 10, f: 6, c: 50 }, target: { p: 55, c: 180, f: 20 } },
  ]);

  it('приём в окне 09:00–18:00 → рецепт только портативный, иначе приём остаётся продуктовым', () => {
    const res = assembleRecipeDay({
      meals: meals() as any, pool: RECIPE_DB as any,
      targets: { kcal: 3000, p: 170, f: 70, c: 400 },
      excludedIds: new Set<string>(), athleteWeightKg: 90, trainDay: false, seed: 3, goal: 'mass',
      portableMode: true, isWorkDay: true, workStartMin: 9 * 60, workEndMin: 18 * 60,
    });
    const lunch = res.meals.find((m: any) => /Обед/i.test(m.label || ''))!;
    const d: any = (lunch as any).recipeAppliedData;
    if (d && Array.isArray(d.ingredientIds) && d.ingredientIds.length > 0) {
      const allPortable = d.ingredientIds.every((id: string) => {
        const f = FOOD_DB.find(x => x.id === id);
        return !!f && isPortableFood(f as any);
      });
      expect(allPortable, `обед-рецепт не портативный: ${d.name} [${d.ingredientIds}]`).toBe(true);
    } else {
      // Непортативных рецептов в окне нет → приём остался продуктовым (хлопья).
      expect((lunch.items || []).length).toBeGreaterThan(0);
    }
  });
});
