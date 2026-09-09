/**
 * planner-sauce-canned-variety.test.ts — P0-фиксы плана NUTRITION-VARIETY-PLAN (Sep 09 2026).
 *
 * Жалобы пользователя: «консервированный тунец в рационе», «80 г соевого соуса на приём»,
 * «генерация почти одно и то же». Мутационные тесты: без фиксов падают.
 */
import { describe, it, expect } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { realisticFloorG, applyRealisticFloors, type MealItem } from '../meal-plan-engine';
import { decomposeRecipe } from '../recipe-engine';
import { isSauceCondimentFood } from '../food-availability';

const foodOf = (id: string) => FOOD_DB.find(f => f.id === id)!;

describe('P0-2: соусы — не белок (полы реалистичных порций)', () => {
  it('isSauceCondimentFood: соусы да, готовые блюда/напитки/снэки — нет', () => {
    expect(isSauceCondimentFood(foodOf('sauce_soy'))).toBe(true);
    expect(isSauceCondimentFood(foodOf('sauce_ketchup'))).toBe(true);
    expect(isSauceCondimentFood(foodOf('ru_borscht'))).toBe(false);
    expect(isSauceCondimentFood(foodOf('drink_kefir'))).toBe(false);
    expect(isSauceCondimentFood(foodOf('snack_rice_cakes'))).toBe(false);
    expect(isSauceCondimentFood(foodOf('chicken_breast'))).toBe(false);
  });

  it('realisticFloorG для соуса = 0 (мутация: пол белка давал 80-151 г соуса)', () => {
    const soy = foodOf('sauce_soy');
    expect(realisticFloorG(soy, 'protein', false, 110)).toBe(0);
    expect(realisticFloorG(soy, 'fat', false, 80)).toBe(0);
  });

  it('applyRealisticFloors не поднимает соус даже с legacy-ролью protein (жалоба «80 г соевого соуса»)', () => {
    const soy = foodOf('sauce_soy');
    const mk = (grams: number): MealItem => ({
      id: soy.id, name: soy.name, amount: grams, kcal: Math.round(soy.kcal * grams / 100),
      p: soy.protein * grams / 100, f: soy.fat * grams / 100, c: soy.carbs * grams / 100,
      fiber: 0, leucine_mg: 0, role: 'protein' as any,
    });
    const items: MealItem[] = [
      { id: 'chicken_breast', name: 'Курица', amount: 150, kcal: 248, p: 46.5, f: 5.4, c: 0, fiber: 0, leucine_mg: 0, role: 'protein' as any },
      mk(15),
    ];
    const out = applyRealisticFloors(items, false, 700, true, 110) as any[];
    const soyOut = out.find(i => i.id === 'sauce_soy');
    expect(soyOut.amount).toBe(15); // мутация: без guard'а поднимался до 80
    const chickenOut = out.find(i => i.id === 'chicken_breast');
    expect(chickenOut.amount).toBeGreaterThanOrEqual(110); // пол белка для НЕ-соусов цел
  });
});

describe('P0-3: консервы в рецептах замещаются свежими', () => {
  it('decomposeRecipe: tuna_canned → tuna_steak (гейт «не бич-пакет» действует и в рецептах)', () => {
    const recipe = {
      name: 'Тест-боул с тунцом', meal: 'lunch' as const, prepTimeMin: 15,
      kcal: 380, protein: 45, fat: 8, carbs: 28,
      ingredients: ['Тунец консервированный 200г'], instructions: ['Смешать'], tags: [],
      ingredientIds: ['bulgur', 'tuna_canned', 'sauce_soy'],
      portions: { bulgur: 80, tuna_canned: 200, sauce_soy: 15 },
    } as any;
    const items = decomposeRecipe(recipe);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some(i => i.id === 'tuna_canned')).toBe(false);
    expect(items.some(i => i.id === 'tuna_steak')).toBe(true);
  });

  it('ккал рецепта сохраняется при замещении консервы (нормализация scaleToRecipeKcal)', () => {
    const recipe = {
      name: 'Тест-консерва', meal: 'lunch' as const, prepTimeMin: 10,
      kcal: 300, protein: 40, fat: 5, carbs: 20,
      ingredients: ['Тунец консервированный 200г'], instructions: [], tags: [],
      ingredientIds: ['tuna_canned'], portions: { tuna_canned: 200 },
    } as any;
    const items = decomposeRecipe(recipe);
    const tot = items.reduce((s, i) => s + i.kcal, 0);
    expect(Math.abs(tot - 300) / 300).toBeLessThan(0.05);
  });
});

describe('P0-4/5/6: разнообразие без ломки детерминизма', () => {
  it('та же соль → тот же план (инвариант детерминизма по seeded-соли)', async () => {
    const { buildDayPlan } = await import('../meal-plan-engine');
    const mkInput = () => ({
      weightKg: 85, lbmKg: 72, bodyFatPct: 14, sex: 'male' as const,
      goalKcal: 2900, goalProteinG: 180, goalFatG: 80, goalCarbsG: 330,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
      excludedIds: new Set<string>(), allergenTags: new Set<string>(), budget: 'medium' as const,
      dayOffset: 0, cyclePhase: 'course' as const, variety: 'max' as const, quality: 'full' as const,
      randomSalt: 42, wakeTime: '08:00', bedTime: '23:00',
    });
    const a = buildDayPlan(mkInput());
    const b = buildDayPlan(mkInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
