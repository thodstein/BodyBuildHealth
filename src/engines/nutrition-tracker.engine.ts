import type { FoodItem } from '../core/types';

export function calculateDailyTotals(foods: FoodItem[]) {
  return foods.reduce((acc, food) => ({
    kcal: acc.kcal + food.macros.kcal,
    p: acc.p + food.macros.p,
    f: acc.f + food.macros.f,
    c: acc.c + food.macros.c,
    fiber: acc.fiber + food.macros.fiber,
    water: acc.water + food.macros.water,
    steps: acc.steps + food.macros.steps
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, water: 0, steps: 0 });
}

export function trackNutrition(foods: FoodItem[]) {
  const totals = calculateDailyTotals(foods);
  return { foods, totals };
}
