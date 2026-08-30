/**
 * planner-recipe-quality.test.ts — гарантии Эпика C (NUTRITION-PLANNER-QUALITY-PLAN):
 *   C1 — дневные квоты действуют на рецептурный путь;
 *   C2 — peri-рецепты (p32/p35) достижимы в автогенерации (предтрен/пост-трен/перед сном);
 *   C3 — аллергены/вег гейтятся для 100% БД (включая легаси без ingredientIds);
 *   C5 — ккал-гейт приёмки ±15% (±20% перекусы) + субротация доборов.
 */
import { describe, it, expect } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { scoreRecipeForMeal, type RecipeMatchOptions } from '../recipe-engine';
import { assembleRecipeDay, type PlanMealLike } from '../planner-recipe-mode';
import type { Recipe } from '../../../../../engines/nutrition-periodization.engine';

const food = (id: string) => FOOD_DB.find(f => f.id === id)!;

/** Рецепт-фикстура: kcal считается из FOOD_DB по формуле (как в p36-p38). */
function mkRecipe(name: string, meal: Recipe['meal'], ing: [string, number][], over: Partial<Recipe> = {}): Recipe {
  let kcal = 0, p = 0, f = 0, c = 0;
  for (const [id, g] of ing) {
    const fd = food(id); const k = g / 100;
    kcal += (fd.kcal || 0) * k; p += (fd.protein || 0) * k; f += (fd.fat || 0) * k; c += (fd.carbs || 0) * k;
  }
  kcal = Math.round(4 * p + 9 * f + 4 * c / 1) / 1;
  return {
    name, meal, prepTimeMin: 10,
    kcal: Math.round(kcal), protein: Math.round(p * 10) / 10, fat: Math.round(f * 10) / 10, carbs: Math.round(c * 10) / 10,
    ingredientIds: ing.map(([id]) => id),
    portions: Object.fromEntries(ing.map(([id, g]) => [id, g])),
    ingredients: ing.map(([id, g]) => `${food(id).name} ${g} г`),
    instructions: ['Готовить', 'Подать'],
    tags: ['высокий белок'],
    difficulty: 'easy',
    ...over,
  } as Recipe;
}

const BASE_TARGETS = { kcal: 2600, p: 170, f: 75, c: 300 };
const EXCLUDED = new Set<string>();

function meal(label: string, target?: { p: number; c: number; f: number }, items: PlanMealLike['items'] = []): PlanMealLike {
  const totals = { kcal: items.reduce((s, i) => s + (i.kcal || 0), 0), p: 0, f: 0, c: 0 };
  return { label, time: '12:00', items, totals, ...(target ? { target } : {}) };
}

describe('C2: peri-рецепты достижимы', () => {
  const pool = [
    mkRecipe('PreW: рис-мёд-шейкер', 'preworkout', [['rice_white', 80], ['honey', 20], ['whey_isolate', 20]]),
    mkRecipe('PostW: курица-рис анаболик', 'postworkout', [['chicken_breast', 150], ['rice_white', 120]]),
    mkRecipe('PreSleep: творог-казеин ночь', 'presleep', [['cottage_cheese_0', 200], ['casein', 20]]),
  ];
  const mkMeals = (): PlanMealLike[] => [
    meal('Завтрак', { p: 40, c: 60, f: 15 }),
    meal('Обед', { p: 45, c: 70, f: 18 }),
    meal('Предтрен', { p: 20, c: 45, f: 5 }),
    meal('Пост-трен', { p: 35, c: 60, f: 8 }),
    meal('Ужин', { p: 40, c: 50, f: 16 }),
    meal('Перед сном', { p: 30, c: 20, f: 8 }),
  ];
  const tgt = { p: 30, c: 50, f: 10 };

  it('трен-день: предтрен/пост-трен/перед сном получают свои рецепты', () => {
    const meals = mkMeals();
    const res = assembleRecipeDay({ meals, pool, targets: BASE_TARGETS, excludedIds: EXCLUDED, trainDay: true, athleteWeightKg: 85 });
    const byLabel = (l: string) => res.meals.find(m => m.label === l);
    const missing = ['Предтрен', 'Пост-трен', 'Перед сном']
      .filter(l => { const ra = byLabel(l)?.recipeApplied; return !ra || !/PreW|PostW|PreSleep/.test(ra); })
      .map(l => `${l} → ${String(byLabel(l)?.recipeApplied)} opts=${JSON.stringify(byLabel(l)?.recipeOptions?.map(o => o.name) || [])} notes=${JSON.stringify(res.notes)}`);
    require('fs').writeFileSync('.tmp-c2dbg.txt', missing.join('\n') || 'ALL-OK', 'utf8');
    expect(missing, missing.join(' | ')).toEqual([]);
  });

  it('день отдыха: предтрен/пост-трен остаются продуктовыми', () => {
    const meals = mkMeals();
    const res = assembleRecipeDay({ meals, pool, targets: BASE_TARGETS, excludedIds: EXCLUDED, trainDay: false, athleteWeightKg: 85 });
    expect(res.meals.find(m => m.label === 'Предтрен')?.recipeApplied).toBeUndefined();
    expect(res.meals.find(m => m.label === 'Пост-трен')?.recipeApplied).toBeUndefined();
  });
});

describe('C1: дневные квоты на рецептурном пути', () => {
  it('семейство гарнира (рис) не чаще 3 приёмов в дне, когда есть альтернатива', () => {
    const riceRecipes = [1, 2, 3].map(n => mkRecipe(`Рис-боул №${n}`, 'lunch', [['rice_white', 150], ['chicken_breast', 150], ['broccoli', 80]]));
    const altRecipe = mkRecipe('Гречка-боул с говядиной', 'dinner', [['buckwheat', 150], ['beef_lean', 150], ['tomato', 80]]);
    const meals: PlanMealLike[] = [
      meal('Завтрак', { p: 40, c: 60, f: 15 }),
      meal('Обед', { p: 45, c: 70, f: 18 }),
      meal('Ужин', { p: 40, c: 50, f: 16 }),
      meal('Перед сном', { p: 30, c: 20, f: 8 }),
    ];
    const res = assembleRecipeDay({ meals, pool: [...riceRecipes, altRecipe], targets: BASE_TARGETS, excludedIds: EXCLUDED, athleteWeightKg: 85 });
    const riceMeals = res.meals.filter(m => (m.items || []).some(it => it.id === 'rice_white' || it.id === 'rice_brown' || it.id === 'rice_basmati')).length;
    expect(riceMeals).toBeLessThanOrEqual(3);
  });

  it('финальный грамм-трим: орехи не превышают квоту × масштаб веса', () => {
    // Настраиваем: перекусы с орехами 100 г суммарно (квота при 80 кг = 60)
    const nutOver: PlanMealLike[] = [
      meal('Завтрак', { p: 40, c: 60, f: 15 }, [
        { name: 'Миндаль', id: 'almonds', amount: 60, kcal: 348, p: 12.6, f: 30, c: 6.6, fiber: 7.5 },
      ]),
      meal('Обед', { p: 45, c: 70, f: 18 }, [
        { name: 'Курица', id: 'chicken_breast', amount: 150, kcal: 248, p: 46.5, f: 5.4, c: 0, fiber: 0 },
        { name: 'Грецкие', id: 'walnuts', amount: 50, kcal: 328, p: 7.6, f: 32.5, c: 6.9, fiber: 3.4 },
      ]),
      meal('Ужин', { p: 40, c: 50, f: 16 }, [
        { name: 'Треска', id: 'cod', amount: 200, kcal: 164, p: 35.6, f: 1.6, c: 0, fiber: 0 },
      ]),
    ];
    const res = assembleRecipeDay({
      meals: nutOver, pool: [], targets: BASE_TARGETS, excludedIds: EXCLUDED, athleteWeightKg: 80,
    });
    const nutG = res.meals.flatMap(m => m.items || []).filter(it => ['almonds', 'walnuts', 'cashew'].includes(it.id)).reduce((s, it) => s + (it.amount || 0), 0);
    expect(nutG).toBeLessThanOrEqual(60 + 10 + 5); // квота 60 + запас катчелла
  });
});

describe('C3: аллергены/вег для легаси (без ingredientIds)', () => {
  const opts = (over: Partial<RecipeMatchOptions>): RecipeMatchOptions => ({
    mealType: 'lunch', targetKcal: 500, targetProteinG: 40, targetCarbsG: 50, targetFatG: 15,
    excludedIds: new Set<string>(), ...over,
  });
  const legacyChicken: Recipe = {
    name: 'Легаси куриный салат', meal: 'lunch', prepTimeMin: 10,
    kcal: 480, protein: 42, fat: 12, carbs: 45,
    ingredients: ['Куриная грудка 180 г', 'Рис белый 100 г', 'Оливковое масло 8 г'],
    instructions: ['Смешать'], tags: ['обед'],
  } as Recipe;

  it('исключённый продукт (из декомпозиции строк) — hardReject', () => {
    const s = scoreRecipeForMeal(legacyChicken, opts({ excludedIds: new Set(['chicken_breast']) }));
    expect(s).toBe(0);
  });

  it('isVegetarian + мясная декомпозиция — hardReject', () => {
    const s = scoreRecipeForMeal(legacyChicken, opts({ isVegetarian: true }));
    expect(s).toBe(0);
  });

  it('без исключений легаси-рецепт скорится нормально', () => {
    const s = scoreRecipeForMeal(legacyChicken, opts({}));
    expect(s).toBeGreaterThan(30);
  });
});

describe('C5: ккал-гейт приёмки', () => {
  it('кандидат с дистанцией >±15% проигрывает точному при одинаковой базе', () => {
    // Цель приёма 500 ккал: near-рецепт ~500, far ~300 (девиация 40% — reject зона)
    const near = mkRecipe('Точный обед 500', 'lunch', [['chicken_breast', 150], ['rice_white', 110], ['olive_oil', 10]]);
    const far = mkRecipe('Лёгкий салат 250', 'lunch', [['cod', 150], ['cucumber', 100], ['lettuce_romaine', 50]]);
    const meals = [meal('Обед', { p: 40, c: 55, f: 14 })];
    const res = assembleRecipeDay({
      meals, pool: [far, near], targets: BASE_TARGETS, excludedIds: EXCLUDED, athleteWeightKg: 85,
    });
    expect(res.meals[0].recipeApplied).toBe(near.name);
    expect(res.appliedCount).toBe(1);
  });
});
