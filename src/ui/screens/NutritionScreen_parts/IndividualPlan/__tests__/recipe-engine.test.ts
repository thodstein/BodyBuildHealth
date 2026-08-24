import { describe, it, expect } from 'vitest';
import {
  decomposeRecipe,
  scoreRecipeForMeal,
  pickRecipeForMeal,
  pickRecipesForMeal,
  flavorCompatibilityScore,
  filterByCookSkill,
  prepTimeBudgetPerMeal,
  cookProfileFromSettings,
  type CookProfile,
} from '../recipe-engine';
import type { Recipe } from '../../../../../engines/nutrition-periodization.engine';

const baseRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  name: 'Test Recipe',
  meal: 'lunch',
  prepTimeMin: 20,
  kcal: 500,
  protein: 40,
  fat: 15,
  carbs: 50,
  ingredients: ['Куриная грудка 200г', 'Рис 100г', 'Брокколи 150г'],
  instructions: ['Готовить'],
  tags: ['обед'],
  usefulness: 8,
  ...overrides,
});

describe('recipe-engine', () => {
  describe('decomposeRecipe', () => {
    it('декомпозиция через ingredientIds + portions', () => {
      const r = baseRecipe({
        ingredientIds: ['chicken_breast', 'rice_white', 'broccoli'],
        portions: { chicken_breast: 200, rice_white: 100, broccoli: 150 },
      });
      const items = decomposeRecipe(r);
      expect(items.length).toBe(3);
      expect(items.some(i => i.id === 'chicken_breast')).toBe(true);
      expect(items.some(i => i.id === 'rice_white')).toBe(true);
      expect(items.some(i => i.id === 'broccoli')).toBe(true);
    });

    it('добавляет молоко к завтраку если нет в ingredientIds', () => {
      const r = baseRecipe({
        meal: 'breakfast',
        ingredientIds: ['oats', 'whey_isolate'],
        portions: { oats: 80, whey_isolate: 30 },
      });
      const items = decomposeRecipe(r);
      expect(items.some(i => i.id === 'milk')).toBe(true);
    });

    it('декомпозиция через парсинг ingredients (fallback)', () => {
      const r = baseRecipe({
        ingredients: ['Куриная грудка 200г', 'Рис 100г'],
      });
      const items = decomposeRecipe(r);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('масштабирует к recipe.kcal если расхождение >5%', () => {
      const r = baseRecipe({
        kcal: 1000,
        ingredientIds: ['chicken_breast'],
        portions: { chicken_breast: 100 },
      });
      const items = decomposeRecipe(r);
      expect(items[0].amount).toBeGreaterThan(100); // масштабировано вверх
    });

    it('граммовки кратны 5', () => {
      const r = baseRecipe({
        ingredientIds: ['chicken_breast', 'rice_white'],
        portions: { chicken_breast: 203, rice_white: 77 },
      });
      const items = decomposeRecipe(r);
      items.forEach(it => {
        expect(it.amount % 5).toBe(0);
      });
    });
  });

  describe('scoreRecipeForMeal', () => {
    const baseOpts = {
      mealType: 'lunch' as const,
      targetKcal: 500,
      targetProteinG: 40,
      targetCarbsG: 50,
      targetFatG: 15,
      excludedIds: new Set<string>(),
    };

    it('высокий score для подходящего рецепта', () => {
      const r = baseRecipe({ meal: 'lunch', kcal: 500, protein: 40, usefulness: 8.5 });
      const score = scoreRecipeForMeal(r, baseOpts);
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('штраф за неподходящий meal-тип', () => {
      const r = baseRecipe({ meal: 'breakfast' });
      const score = scoreRecipeForMeal(r, baseOpts);
      expect(score).toBeLessThan(80);
    });

    it('штраф за большое расхождение КБЖУ', () => {
      const r = baseRecipe({ kcal: 1000 }); // 2× от цели
      const score = scoreRecipeForMeal(r, baseOpts);
      expect(score).toBeLessThan(70);
    });

    it('учитывает навык готовки', () => {
      const cookProfile: CookProfile = { skill: 'basic', timePerDayMin: 30, frequency: 'daily', batchCooking: false };
      const easy = baseRecipe({ difficulty: 'easy', prepTimeMin: 10 });
      const hard = baseRecipe({ difficulty: 'hard', prepTimeMin: 45 });
      const scoreEasy = scoreRecipeForMeal(easy, { ...baseOpts, cookProfile });
      const scoreHard = scoreRecipeForMeal(hard, { ...baseOpts, cookProfile });
      expect(scoreEasy).toBeGreaterThan(scoreHard);
    });

    it('штраф за исключённый ингредиент', () => {
      const r = baseRecipe({ ingredientIds: ['chicken_breast', 'rice_white'] });
      const opts = { ...baseOpts, excludedIds: new Set(['chicken_breast']) };
      const score = scoreRecipeForMeal(r, opts);
      expect(score).toBeLessThan(40);
    });

    it('бонус за предпочтение пользователя', () => {
      const r = baseRecipe({ name: 'Любимый рецепт' });
      const opts = { ...baseOpts, preferredRecipeNames: new Set(['Любимый рецепт']) };
      const score = scoreRecipeForMeal(r, opts);
      expect(score).toBeGreaterThanOrEqual(85);
    });

    it('вегетарианский фильтр — штраф за мясо', () => {
      const r = baseRecipe({ ingredients: ['Куриная грудка 200г'] });
      const opts = { ...baseOpts, isVegetarian: true };
      const score = scoreRecipeForMeal(r, opts);
      expect(score).toBeLessThan(40);
    });
  });

  describe('pickRecipeForMeal', () => {
    it('возвращает лучший рецепт', () => {
      const recipes = [
        baseRecipe({ name: 'A', meal: 'breakfast', usefulness: 5 }),
        baseRecipe({ name: 'B', meal: 'lunch', usefulness: 8.5 }),
        baseRecipe({ name: 'C', meal: 'lunch', usefulness: 7 }),
      ];
      const best = pickRecipeForMeal(recipes, {
        mealType: 'lunch', targetKcal: 500, targetProteinG: 40, targetCarbsG: 50, targetFatG: 15, excludedIds: new Set(),
      });
      expect(best?.name).toBe('B');
    });

    it('null если нет подходящих (score < 40)', () => {
      const recipes = [baseRecipe({ meal: 'breakfast', kcal: 2000 })];
      const best = pickRecipeForMeal(recipes, {
        mealType: 'lunch', targetKcal: 500, targetProteinG: 40, targetCarbsG: 50, targetFatG: 15, excludedIds: new Set(),
      });
      expect(best).toBeNull();
    });
  });

  describe('pickRecipesForMeal (несколько на выбор)', () => {
    it('возвращает до count рецептов', () => {
      const recipes = [
        baseRecipe({ name: 'A', usefulness: 8 }),
        baseRecipe({ name: 'B', usefulness: 7.5 }),
        baseRecipe({ name: 'C', usefulness: 7 }),
        baseRecipe({ name: 'D', usefulness: 6 }),
      ];
      const picks = pickRecipesForMeal(recipes, {
        mealType: 'lunch', targetKcal: 500, targetProteinG: 40, targetCarbsG: 50, targetFatG: 15, excludedIds: new Set(),
      }, 3);
      expect(picks.length).toBe(3);
      expect(picks[0].name).toBe('A');
    });
  });

  describe('flavorCompatibilityScore', () => {
    it('разные meal-типы — бонус', () => {
      const a = baseRecipe({ name: 'A', meal: 'breakfast' });
      const b = baseRecipe({ name: 'B', meal: 'lunch' });
      const score = flavorCompatibilityScore(a, b);
      expect(score).toBeGreaterThanOrEqual(60);
    });

    it('pairsWith — явная совместимость', () => {
      const a = baseRecipe({ name: 'A', pairsWith: ['B'] });
      const b = baseRecipe({ name: 'B' });
      const score = flavorCompatibilityScore(a, b);
      expect(score).toBeGreaterThanOrEqual(65);
    });

    it('разные белковые источники — бонус за разнообразие', () => {
      const a = baseRecipe({ ingredients: ['Куриная грудка 200г'] });
      const b = baseRecipe({ ingredients: ['Лосось 200г'] });
      const score = flavorCompatibilityScore(a, b);
      expect(score).toBeGreaterThanOrEqual(60);
    });
  });

  describe('filterByCookSkill', () => {
    it('basic → только easy', () => {
      const recipes = [
        baseRecipe({ name: 'easy', difficulty: 'easy', prepTimeMin: 10 }),
        baseRecipe({ name: 'hard', difficulty: 'hard', prepTimeMin: 45 }),
      ];
      const filtered = filterByCookSkill(recipes, 'basic');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('easy');
    });

    it('advanced → все', () => {
      const recipes = [
        baseRecipe({ difficulty: 'easy' }),
        baseRecipe({ difficulty: 'medium' }),
        baseRecipe({ difficulty: 'hard' }),
      ];
      const filtered = filterByCookSkill(recipes, 'advanced');
      expect(filtered.length).toBe(3);
    });

    it('без difficulty — выводится из prepTimeMin', () => {
      const recipes = [
        baseRecipe({ prepTimeMin: 5 }),
        baseRecipe({ prepTimeMin: 20 }),
        baseRecipe({ prepTimeMin: 40 }),
      ];
      const filtered = filterByCookSkill(recipes, 'basic');
      expect(filtered.length).toBe(1);
    });
  });

  describe('prepTimeBudgetPerMeal', () => {
    it('daily → timePerDay / mealsCount', () => {
      const p: CookProfile = { skill: 'basic', timePerDayMin: 30, frequency: 'daily', batchCooking: false };
      expect(prepTimeBudgetPerMeal(p, 4)).toBe(8); // 30/4 = 7.5 → 8
    });

    it('weekly → timePerDay × 7 / mealsCount', () => {
      const p: CookProfile = { skill: 'medium', timePerDayMin: 60, frequency: 'weekly', batchCooking: true };
      expect(prepTimeBudgetPerMeal(p, 4)).toBe(105); // 60×7/4 = 105
    });

    it('every_3_days → timePerDay × 3 / mealsCount', () => {
      const p: CookProfile = { skill: 'medium', timePerDayMin: 30, frequency: 'every_3_days', batchCooking: true };
      expect(prepTimeBudgetPerMeal(p, 3)).toBe(30); // 30×3/3 = 30
    });
  });

  describe('cookProfileFromSettings', () => {
    it('корректный маппинг', () => {
      const p = cookProfileFromSettings({ cookingSkill: 'advanced', cookingFrequency: 'weekly', cookTimeMin: 45, batchCooking: true });
      expect(p.skill).toBe('advanced');
      expect(p.frequency).toBe('weekly');
      expect(p.timePerDayMin).toBe(45);
      expect(p.batchCooking).toBe(true);
    });

    it('defaults для пустых', () => {
      const p = cookProfileFromSettings({});
      expect(p.skill).toBe('basic');
      expect(p.frequency).toBe('daily');
      expect(p.timePerDayMin).toBe(30);
      expect(p.batchCooking).toBe(false);
    });
  });
});