import { describe, it, expect } from 'vitest';
import {
  rebalanceDayAfterRecipes,
  sumMealTotals,
  TOPUP_CARB_IDS,
  type PlanMealLike,
} from '../planner-recipe-mode';

// Lock-тест жалобы «батат 330 г в обед при рецепте ×0.5» (план §3 P3):
// обед собран из рецепта половинной порцией (большая «комната» target.c),
// ребаланс закрывает углеводный недобор топ-апом — топ-ап обязан уважать
// по-продуктовый кап сайдов (батат ≤300 г вне HV), а не общий кап 400 г.
describe('recipe rebalance topup cap (батат в обед)', () => {
  const mkMeal = (
    label: string,
    type: string,
    target: { p: number; f: number; c: number },
    items: any[],
    recipe?: { name: string; ingredientIds: string[] },
  ): PlanMealLike => {
    const m: PlanMealLike = {
      label,
      items,
      totals: sumMealTotals(items as any),
      target,
    } as PlanMealLike;
    (m as any).type = type;
    if (recipe) {
      (m as any).recipeApplied = recipe.name;
      (m as any).recipeAppliedData = {
        name: recipe.name,
        meal: 'lunch',
        kcal: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        prepTimeMin: 30,
        ingredients: [],
        instructions: [],
        tags: [],
        ingredientIds: recipe.ingredientIds,
      };
    }
    return m;
  };

  it('углеводный топ-ап ребаланса в обед с рецептом ×0.5 — батат ≤300 г', () => {
    // Обед: рецепт ×0.5 (курица 75 г + рис 40 г) — углей ~31 из цели 100,
    // комната ~69 г углей: без по-продуктового капа топ-ап льёт ~320-350 г.
    const lunchItems = [
      { name: 'Куриная грудка', id: 'chicken_breast', amount: 75, kcal: 83, p: 17.3, f: 0.8, c: 0, fiber: 0, role: 'protein' },
      { name: 'Рис белый', id: 'rice_white', amount: 40, kcal: 138, p: 2.7, f: 0.2, c: 31.2, fiber: 0.4, role: 'carb_slow' },
    ];
    // Завтрак/ужин закрыты полностью — единственный дефицит: угли обеда.
    const fullItems = (c: number) => [
      { name: 'Куриная грудка', id: 'chicken_breast', amount: 120, kcal: 132, p: 27.6, f: 1.2, c: 0, fiber: 0, role: 'protein' },
      { name: 'Рис белый', id: 'rice_white', amount: 130, kcal: 447, p: 8.7, f: 0.8, c: 101.4, fiber: 1.3, role: 'carb_slow' },
    ];
    const meals: PlanMealLike[] = [
      mkMeal('Завтрак', 'breakfast', { p: 35, f: 20, c: 100 }, fullItems(100)),
      mkMeal(
        'Обед',
        'lunch',
        { p: 40, f: 20, c: 100 },
        lunchItems,
        { name: 'Тест-рецепт обеда', ingredientIds: ['chicken_breast', 'rice_white'] },
      ),
      mkMeal('Ужин', 'dinner', { p: 35, f: 20, c: 100 }, fullItems(100)),
    ];
    const totals = meals.reduce(
      (s, m) => ({
        kcal: s.kcal + m.totals.kcal,
        p: s.p + m.totals.p,
        f: s.f + m.totals.f,
        c: s.c + m.totals.c,
      }),
      { kcal: 0, p: 0, f: 0, c: 0 },
    );
    const targets = {
      kcal: Math.round(totals.kcal + 300),
      p: Math.round(totals.p),
      f: Math.round(totals.f),
      c: Math.round(totals.c + 70),
    };
    // Форсируем батат: остальные углеводные топ-апы исключены.
    const excluded = new Set(TOPUP_CARB_IDS.filter((id) => id !== 'sweet_potato'));
    const rb = rebalanceDayAfterRecipes(meals, targets, { excludedIds: excluded });
    const lunch = rb.meals.find((m) => m.label === 'Обед')!;
    expect(lunch).toBeTruthy();
    const sweet = (lunch.items || []).filter((i: any) => i.id === 'sweet_potato');
    expect(sweet.length).toBeGreaterThan(0);
    for (const s of sweet as any[]) {
      expect(s.amount).toBeLessThanOrEqual(300);
    }
  });
});
