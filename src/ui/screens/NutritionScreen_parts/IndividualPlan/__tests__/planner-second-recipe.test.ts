import { describe, it, expect } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';
import type { Recipe } from '../../../../../engines/nutrition-periodization.engine';
import { scaleRecipeToTarget, recipeCompatibility, sumMealTotals } from '../planner-recipe-mode';

const mkRecipe = (over: Partial<Recipe> & { ingredientIds?: string[]; portions?: Record<string, number> } = {}): Recipe => ({
  name: 'Тест-рецепт', meal: 'lunch', prepTimeMin: 15,
  kcal: 480, protein: 45, fat: 15, carbs: 35,
  ingredients: ['Куриная грудка 150 г', 'Рис 60 г'], instructions: ['Готовить'], tags: ['тест'],
  ...over,
});

describe('scaleRecipeToTarget (порции под КБЖУ приёма)', () => {
  it('тяжелее атлет (больше цель приёма) → не меньше граммовки того же рецепта (порционный ряд: 80кг → ×0.5, 110кг → ×1)', () => {
    const r = mkRecipe({ ingredientIds: ['chicken_breast', 'rice_white'], portions: { chicken_breast: 150, rice_white: 60 } });
    const small = scaleRecipeToTarget(r, { kcal: 400, p: 35, f: 12, c: 40 }, 80);
    const big = scaleRecipeToTarget(r, { kcal: 800, p: 60, f: 18, c: 90 }, 110);
    expect(small).not.toBeNull();
    expect(big).not.toBeNull();
    const smallKcal = sumMealTotals(small!.items).kcal;
    const bigKcal = sumMealTotals(big!.items).kcal;
    expect(bigKcal).toBeGreaterThanOrEqual(smallKcal);
    // Чистка-2026: масштаб в ПОРЦИЯХ (ряд ×0.5/×1/×1.5/×2/×2.5/×3, исходный = 1 порция)
    expect(small!.portions).toBeGreaterThanOrEqual(0.5);
    expect(small!.portions).toBeLessThan(big!.portions + 0.01);
    expect(big!.portions).toBeLessThanOrEqual(2.8);
  });

  it('масштаб в допустимых рамках порционного ряда + items непустые', () => {
    const r = mkRecipe({ ingredientIds: ['chicken_breast'], portions: { chicken_breast: 200 } });
    const res = scaleRecipeToTarget(r, { kcal: 250, p: 30, f: 8, c: 10 }, 80);
    expect(res).not.toBeNull();
    expect(res!.items.length).toBeGreaterThan(0);
    // Чистка-2026: ряд порций начинается с ×0.5 (полпорции — «×0.61» не бывает)
    expect(res!.portions).toBeGreaterThanOrEqual(0.5);
    expect(res!.portions).toBeLessThanOrEqual(2.2);
    expect(res!.items.every(it => (it.amount || 0) >= 5)).toBe(true);
  });

  it('пустая декомпозиция → null', () => {
    const r = mkRecipe({ ingredientIds: [], ingredients: [], portions: {} });
    const res = scaleRecipeToTarget(r, { kcal: 500 }, 80);
    expect(res).toBeNull();
  });
});

describe('recipeCompatibility (два рецепта в одном приёме)', () => {
  it('тот же рецепт — несовместим', () => {
    const r = getRecipes().find(x => x.ingredientIds && x.ingredientIds.length > 2)!;
    const c = recipeCompatibility(r as any, r as any);
    expect(c.compatible).toBe(false);
  });

  it('разные рецепты без пересечения ингредиентов — совместимы', () => {
    const a = mkRecipe({ name: 'А', ingredientIds: ['chicken_breast', 'rice_white'] });
    const b = mkRecipe({ name: 'Б', ingredientIds: ['salmon', 'buckwheat'] });
    const c = recipeCompatibility(a as any, b as any);
    expect(c.compatible).toBe(true);
  });

  it('много общих ключевых ингредиентов — несовместимы', () => {
    const a = mkRecipe({ name: 'А', ingredientIds: ['chicken_breast', 'rice_white', 'broccoli'] });
    const b = mkRecipe({ name: 'Б', ingredientIds: ['chicken_breast', 'rice_white', 'carrot'] });
    const c = recipeCompatibility(a as any, b as any);
    expect(c.compatible).toBe(false);
  });
});
