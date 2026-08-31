import { describe, it, expect } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';
import { rebalanceDayAfterRecipes, sumDayTotals, scaleRecipeToTarget, buildRecipeMealItems, sumMealTotals, flattenRecipeOption } from '../planner-recipe-mode';

function itemize(recipe: any, targetKcal: number) {
  const sc = scaleRecipeToTarget(recipe as any, { kcal: targetKcal, p: 35, f: 12, c: 40 }, 110);
  return sc ? sc.items : [];
}

describe('два рецепта в одном приёме', () => {
  it('оба рецепта остаются в items после ребаланса (первый не выдавливается)', () => {
    const pool = getRecipes();
    const rA = pool.find(r => r.meal === 'lunch' && r.ingredientIds && r.ingredientIds.length >= 3)!;
    const rB = pool.find(r => r.meal === 'lunch' && r.ingredientIds && r.ingredientIds.length >= 3 && r.name !== rA.name)!;

    const itemsA = itemize(rA, 500);
    const itemsB = itemize(rB, 300);
    const merged = [...itemsA, ...itemsB];
    const flatA = flattenRecipeOption(rA);
    const flatB = flattenRecipeOption(rB);

    const meal = {
      label: 'Обед', items: merged, totals: sumMealTotals(merged),
      recipeApplied: rA.name, recipeAppliedData: flatA,
      recipeApplied2: rB.name, recipeAppliedData2: flatB,
    };
    const snack = { label: 'Перекус', items: [{ id: 'walnuts', name: 'Орехи', amount: 40, kcal: 260, p: 6, f: 26, c: 6 }], totals: { kcal: 260, p: 6, f: 26, c: 6 } };
    const day = [meal, snack];

    const rb = rebalanceDayAfterRecipes(day as any, { kcal: 1200, p: 90, f: 50, c: 110 });

    const mealAfter = rb.meals.find((m: any) => m.recipeApplied)!;
    const idsAfter = new Set(mealAfter.items.map((i: any) => i.id));
    // продукты обоих рецептов в приёме
    for (const id of rA.ingredientIds) expect(idsAfter.has(id), `рецепт А потерял ${id}`).toBe(true);
    for (const id of rB.ingredientIds!) expect(idsAfter.has(id), `рецепт Б потерял ${id}`).toBe(true);
    // обе метки целы
    expect(mealAfter.recipeApplied).toBe(rA.name);
    expect(mealAfter.recipeApplied2).toBe(rB.name);
  });
});
