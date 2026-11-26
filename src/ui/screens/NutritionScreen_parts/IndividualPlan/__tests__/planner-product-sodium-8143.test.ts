/**
 * §8.143 п.10: продуктовый путь ведёт натрий по тому же правилу, что рецептурный —
 * количество из ТЕКУЩЕГО `amount`, плотность из FOOD_DB. Кэш `it.na` (ставится один раз
 * в `makeItem` и живёт со старой порцией) — только фолбэк для составных блюд, у которых
 * плотности натрия в FOOD_DB нет.
 *
 * Два замка:
 *  1) свидетель «кэш против количества» на `mergeDuplicateItems` (краснеет, если
 *     `mealTotalsOf` снова начнёт суммировать `it.na`);
 *  2) свойство на выходе `buildDayPlan`: соль каждой тарелки и дня = FOOD_DB × финальные
 *     граммы — ГАРД согласованности выхода (§8.68/§8.72/последняя миля/§8.134 уже
 *     отработали). Честно: это свойство НЕ краснеет от удаления финального
 *     `refreshItemSodium` — после него `m.totals.na` = Σ `it.na`, и сравнение тавтологично
 *     (замерено на 32 днях, §8.143 п. 10.2). Класс дефекта держат свидетель №1 и
 *     source-shape замки в `planner-ui-sodium-8143`.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, mergeDuplicateItems } from '../meal-plan-engine';
import { itemSodiumMg } from '../planner-meal-sodium';
import { getMicroFromFood } from '../planner-micro-reader';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const baseInput = (overrides: any = {}) => ({
  weightKg: 90,
  lbmKg: 90 * 0.82,
  bodyFatPct: 18,
  sex: 'male' as const,
  goalKcal: 3000,
  goalProteinG: 180,
  goalFatG: 72,
  goalCarbsG: 408,
  mealsCount: 5,
  isTrainingDay: true,
  trainStartMin: 17 * 60 + 30,
  trainDurationMin: 90,
  allowIntraWorkout: true,
  budget: 'medium' as const,
  dayOffset: 0,
  cyclePhase: 'course' as const,
  variety: 'max' as const,
  eveningLowCarb: false,
  ...overrides,
});

/** Позиция приёма с кэшем `na` от ЗАДАННОЙ (уже устаревшей) порции. */
const itemOf = (food: any, amount: number, na: number) => ({
  id: food.id,
  name: food.name,
  amount,
  na,
  kcal: Math.round((Number(food.kcal) || 0) * (amount / 100)),
  p: ((Number(food.protein) || 0) * amount) / 100,
  f: ((Number(food.fat) || 0) * amount) / 100,
  c: ((Number(food.carbs) || 0) * amount) / 100,
  fiber: 0,
  leucine_mg: 0,
});

describe('§8.143 п.10 — натрий продуктового пути', () => {
  it('свидетель: totals приёма считает по количеству, а не по кэшу na', () => {
    const food = FOOD_DB.find((f) => getMicroFromFood(f as any, 'Na') > 100);
    expect(food, 'в FOOD_DB должен быть продукт с натрием > 100 мг/100 г').toBeTruthy();
    const per100 = getMicroFromFood(food as any, 'Na');
    // Кэш, который оставил бы `makeItem` для порции 100 г.
    const staleNa = itemSodiumMg({ id: (food as any).id, amount: 100 });
    const meal: any = {
      label: 'Обед',
      items: [itemOf(food, 100, staleNa), itemOf(food, 150, staleNa)],
    };

    const merged = mergeDuplicateItems([meal]);
    expect(merged).toBe(1);
    expect(meal.items).toHaveLength(1);
    expect(meal.items[0].amount).toBe(250);

    // Кэш после склейки — сумма старых `na` (2 × порция 100 г), граммы уже 250 г.
    const expected = itemSodiumMg({ id: (food as any).id, amount: 250 });
    expect(Math.abs(expected - Math.round((per100 * 250) / 100))).toBeLessThanOrEqual(1);
    expect(Math.abs(meal.items[0].na - expected)).toBeGreaterThan(5);
    // Тотал приёма обязан читать текущее количество, а не кэш.
    expect(Math.abs((meal.totals?.na || 0) - expected)).toBeLessThanOrEqual(1);
  });

  it('свойство: соль тарелки = FOOD_DB × финальные граммы (8 дней)', () => {
    // Ккал/Б/Ж/У согласованы (Б×4 + Ж×9 + У×4 = ккал), вес 90/60, 3/5/6 приёмов,
    // тренировочный/отдых, dayOffset 0..2.
    const cases: any[] = [
      { weightKg: 90, mealsCount: 5, isTrainingDay: true, dayOffset: 0 },
      { weightKg: 90, mealsCount: 3, isTrainingDay: false, dayOffset: 1 },
      { weightKg: 90, mealsCount: 6, isTrainingDay: true, dayOffset: 2 },
      {
        weightKg: 90,
        goalKcal: 2800,
        goalProteinG: 180,
        goalFatG: 68,
        goalCarbsG: 367,
        mealsCount: 6,
        isTrainingDay: false,
        dayOffset: 2,
      },
      {
        weightKg: 60,
        lbmKg: 60 * 0.82,
        goalKcal: 2000,
        goalProteinG: 120,
        goalFatG: 48,
        goalCarbsG: 272,
        mealsCount: 3,
        isTrainingDay: true,
        dayOffset: 0,
      },
      {
        weightKg: 60,
        lbmKg: 60 * 0.82,
        goalKcal: 2000,
        goalProteinG: 120,
        goalFatG: 48,
        goalCarbsG: 272,
        mealsCount: 5,
        isTrainingDay: false,
        dayOffset: 1,
      },
      {
        weightKg: 60,
        lbmKg: 60 * 0.82,
        goalKcal: 2000,
        goalProteinG: 120,
        goalFatG: 48,
        goalCarbsG: 272,
        mealsCount: 6,
        isTrainingDay: true,
        dayOffset: 2,
      },
      {
        weightKg: 60,
        lbmKg: 60 * 0.82,
        goalKcal: 1800,
        goalProteinG: 130,
        goalFatG: 40,
        goalCarbsG: 230,
        mealsCount: 5,
        isTrainingDay: false,
        dayOffset: 2,
      },
    ];

    for (const c of cases) {
      const plan = buildDayPlan(baseInput(c));
      for (const m of plan.meals as any[]) {
        const sum = (m.items || []).reduce((s: number, it: any) => s + itemSodiumMg(it), 0);
        expect(
          Math.abs((m.totals?.na || 0) - sum),
          `день ${c.dayOffset}/${c.weightKg}кг, приём «${m.label}»: totals.na vs Σ itemSodiumMg`,
        ).toBeLessThanOrEqual(1);
      }
      const daySum = (plan.meals as any[]).reduce((s: number, m: any) => s + (m.totals?.na || 0), 0);
      expect(
        Math.abs((plan.totals.na || 0) - daySum),
        `день ${c.dayOffset}/${c.weightKg}кг: totals.na vs Σ приёмов`,
      ).toBeLessThanOrEqual(1);
    }
  }, 600000);
});
