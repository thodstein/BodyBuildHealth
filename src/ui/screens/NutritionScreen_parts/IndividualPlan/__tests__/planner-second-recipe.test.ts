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
  it('тяжелее атлет (больше цель приёма) → больше граммовки того же рецепта', () => {
    const r = mkRecipe({ ingredientIds: ['chicken_breast', 'rice_white'], portions: { chicken_breast: 150, rice_white: 60 } });
    const small = scaleRecipeToTarget(r, { kcal: 400, p: 35, f: 12, c: 40 }, 80);
    const big = scaleRecipeToTarget(r, { kcal: 800, p: 60, f: 18, c: 90 }, 110);
    expect(small).not.toBeNull();
    expect(big).not.toBeNull();
    const smallKcal = sumMealTotals(small!.items).kcal;
    const bigKcal = sumMealTotals(big!.items).kcal;
    expect(bigKcal).toBeGreaterThan(smallKcal);
    // обе порции в рамках клампа масштаба
    expect(small!.scale).toBeGreaterThanOrEqual(0.7);
    expect(big!.scale).toBeLessThanOrEqual(2.8);
  });

  it('масштаб в допустимых рамках + items непустые', () => {
    const r = mkRecipe({ ingredientIds: ['chicken_breast'], portions: { chicken_breast: 200 } });
    const res = scaleRecipeToTarget(r, { kcal: 250, p: 30, f: 8, c: 10 }, 80);
    expect(res).not.toBeNull();
    expect(res!.items.length).toBeGreaterThan(0);
    expect(res!.scale).toBeGreaterThanOrEqual(0.7);
    expect(res!.scale).toBeLessThanOrEqual(2.2);
    // граммовки положительны
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
