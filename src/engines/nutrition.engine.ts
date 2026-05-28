import type { FoodItem } from '../core/types';

export function calculateMacros(foods: FoodItem[]) {
  return foods.reduce((acc, food) => ({
    kcal: acc.kcal + food.macros.kcal,
    p: acc.p + food.macros.p,
    f: acc.f + food.macros.f,
    c: acc.c + food.macros.c
  }), { kcal: 0, p: 0, f: 0, c: 0 });
}

export function suggestFoodByMacro(target: 'protein' | 'carb' | 'fat', foods: FoodItem[]): FoodItem[] {
  return foods.filter(f => {
    if (target === 'protein') return f.macros.p > 20;
    if (target === 'carb') return f.macros.c > 30;
    if (target === 'fat') return f.macros.f > 15;
    return false;
  });
}
