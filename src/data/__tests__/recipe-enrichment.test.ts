import { describe, it, expect } from 'vitest';
import { RECIPE_ENRICHMENT, enrichRecipe, enrichRecipes } from '../recipe-enrichment';
import type { Recipe } from '../../engines/nutrition-periodization.engine';

describe('recipe-enrichment', () => {
  describe('RECIPE_ENRICHMENT', () => {
    it('содержит enrichment для ключевых рецептов', () => {
      expect(Object.keys(RECIPE_ENRICHMENT).length).toBeGreaterThanOrEqual(30);
    });

    it('каждый enrichment имеет ingredientIds и portions', () => {
      for (const [name, enr] of Object.entries(RECIPE_ENRICHMENT)) {
        expect(Array.isArray(enr.ingredientIds)).toBe(true);
        expect(enr.ingredientIds.length).toBeGreaterThan(0);
        expect(typeof enr.portions).toBe('object');
        expect(enr.difficulty).toMatch(/^(easy|medium|hard)$/);
        expect(enr.cookSkill).toMatch(/^(basic|medium|advanced)$/);
      }
    });

    it('portions соответствуют ingredientIds', () => {
      for (const [name, enr] of Object.entries(RECIPE_ENRICHMENT)) {
        for (const fid of enr.ingredientIds) {
          expect(enr.portions[fid]).toBeDefined();
          expect(enr.portions[fid]).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('enrichRecipe', () => {
    const baseRecipe = (name: string): Recipe => ({
      name, meal: 'lunch', prepTimeMin: 20, kcal: 500, protein: 40, fat: 15, carbs: 50,
      ingredients: ['Куриная грудка 200г'], instructions: ['Готовить'], tags: ['обед'],
      usefulness: 8,
    });

    it('обогащает рецепт с match по имени', () => {
      const r = enrichRecipe(baseRecipe('Курица с рисом в одной кастрюле'));
      expect(r.ingredientIds).toBeDefined();
      expect(r.portions).toBeDefined();
      expect(r.difficulty).toBe('medium');
      expect(r.batchFriendly).toBe(true);
      expect(r.cookSkill).toBe('medium');
    });

    it('не обогащает рецепт без match (возвращает как есть)', () => {
      const r = enrichRecipe(baseRecipe('Неизвестный рецепт'));
      expect(r.ingredientIds).toBeUndefined();
      expect(r.portions).toBeUndefined();
    });
  });

  describe('enrichRecipes', () => {
    it('обогащает массив рецептов', () => {
      const recipes = [
        { name: 'Протеиновые овсяноблины', meal: 'breakfast', prepTimeMin: 10, kcal: 520, protein: 45, fat: 14, carbs: 52, ingredients: [], instructions: [], tags: [] },
        { name: 'Неизвестный', meal: 'lunch', prepTimeMin: 20, kcal: 500, protein: 40, fat: 15, carbs: 50, ingredients: [], instructions: [], tags: [] },
      ] as Recipe[];
      const enriched = enrichRecipes(recipes);
      expect(enriched[0].ingredientIds).toBeDefined();
      expect(enriched[1].ingredientIds).toBeUndefined();
    });
  });
});