import { describe, it, expect } from 'vitest';
import { scoreRecipeForMeal, pickRecipesForMeal, decomposeRecipe, filterRecipesByHardRestrictions, type RecipeMatchOptions } from '../recipe-engine';
import { assembleRecipeDay } from '../planner-recipe-mode';
import { resolveSpecialMealExcludedIds } from '../planner-special-meal-state';
import { selectedAllergenTags, resolveAllExcludedFoodIds, isMilkProteinId } from '../planner-restrictions';
import { FOOD_DB, FOOD_ALLERGEN_DIET } from '../../../../../core/nutrition-database';
import type { Recipe } from '../../../../engines/nutrition-periodization.engine';
import { _validateImportedPlan, _normalizeImportedPlan } from '../IndividualPlanResults';

const BASE_COOK = { skill: 'basic' as const, frequency: 'weekly' as const, timePerDayMin: 30 };

const mkRecipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: 'r_test',
  name: 'Тестовый рецепт',
  meal: 'lunch',
  ingredients: ['Куриная грудка 200г', 'Рис 100г'],
  kcal: 500,
  protein: 45,
  fat: 10,
  carbs: 55,
  prepTimeMin: 15,
  difficulty: 'easy',
  batchFriendly: true,
  tags: [],
  ...over,
} as Recipe);

const baseOpts = (over: Partial<RecipeMatchOptions> = {}): RecipeMatchOptions => ({
  mealType: 'lunch',
  targetKcal: 500,
  targetProteinG: 45,
  targetCarbsG: 55,
  targetFatG: 10,
  excludedIds: new Set<string>(),
  cookProfile: BASE_COOK,
  ...over,
});

// scoreRecipeForMeal возвращает число; hardReject принудительно даёт score 0.
const isRejected = (score: number) => score === 0;

describe('Волна 1 · P1-04: исключение рецепта по имени (маркер __recipe__)', () => {
  it('рецепт, исключённый по имени, отбраковывается', () => {
    const r = mkRecipe({ ingredientIds: ['chicken_breast', 'rice'] });
    const ok = scoreRecipeForMeal(r, baseOpts());
    const blocked = scoreRecipeForMeal(r, baseOpts({ excludedRecipeNames: new Set(['Тестовый рецепт']) }));
    expect(isRejected(blocked)).toBe(true);
    expect(isRejected(ok)).toBe(false);
  });

  it('другой рецепт с тем же именем-префиксом не блокируется', () => {
    const r = mkRecipe({ name: 'Другой рецепт', ingredientIds: ['chicken_breast', 'rice'] });
    const s = scoreRecipeForMeal(r, baseOpts({ excludedRecipeNames: new Set(['Тестовый рецепт']) }));
    expect(isRejected(s)).toBe(false);
  });

  it('выдача не содержит исключённый рецепт даже при единственном кандидате', () => {
    const r = mkRecipe({ ingredientIds: ['chicken_breast', 'rice'] });
    const out = pickRecipesForMeal([r], baseOpts({ excludedRecipeNames: new Set(['Тестовый рецепт']) }), 3);
    expect(out).toHaveLength(0);
  });
});

describe('Волна 1 · P1-05: подмена консервов не обходит исключения', () => {
  it('если исключён свежий аналог, рецепт с консервами отбраковывается', () => {
    // recipe-engine подменяет tuna_canned → tuna_steak; исключаем ИМЕННО замену.
    const fresh = FOOD_DB.find(f => f.id === 'tuna_steak');
    const freshId = fresh?.id || 'tuna_steak';
    const r = mkRecipe({ ingredientIds: ['tuna_canned', 'rice'] });
    const s = scoreRecipeForMeal(r, baseOpts({ excludedIds: new Set([freshId]) }));
    expect(isRejected(s)).toBe(true);
  });

  it('если исключён сам консерв, рецепт отбраковывается', () => {
    const r = mkRecipe({ ingredientIds: ['tuna_canned', 'rice'] });
    const s = scoreRecipeForMeal(r, baseOpts({ excludedIds: new Set(['tuna_canned']) }));
    expect(isRejected(s)).toBe(true);
  });

  it('без исключений рецепт с консервами проходит и декомпозируется в свежий аналог', () => {
    const r = mkRecipe({ ingredientIds: ['tuna_canned', 'rice'] });
    const s = scoreRecipeForMeal(r, baseOpts());
    expect(isRejected(s)).toBe(false);
    const items = decomposeRecipe(r);
    expect(items.every(i => i.id !== 'tuna_canned')).toBe(true);
  });
});

describe('Волна 1 · P1-03: allergenTags реально участвует в гейте', () => {
  it('молочный белок отбраковывается по тегу, даже если его id НЕ в excludedIds', () => {
    const r = mkRecipe({ ingredientIds: ['whey_protein', 'oats'] });
    const tags = selectedAllergenTags(['молочные'], []);
    // Ключевой случай: id НЕ в excludedIds — гейт обязан сработать по тегу.
    const s = scoreRecipeForMeal(r, baseOpts({ excludedIds: new Set<string>(), allergenTags: tags }));
    expect(isRejected(s)).toBe(true);
  });

  it('«лактоза» (не «молочные») не блокирует сывороточный белок', () => {
    const r = mkRecipe({ ingredientIds: ['whey_protein', 'oats'] });
    const tags = selectedAllergenTags(['лактоза'], []);
    const s = scoreRecipeForMeal(r, baseOpts({ excludedIds: new Set<string>(), allergenTags: tags }));
    expect(isRejected(s)).toBe(false);
  });

  it('пустой набор тегов ничего не блокирует', () => {
    const r = mkRecipe({ ingredientIds: ['whey_protein', 'oats'] });
    const s = scoreRecipeForMeal(r, baseOpts({ allergenTags: new Set<string>() }));
    expect(isRejected(s)).toBe(false);
  });

  it('whey/casein помечены dairy в БД и распознаются как молочные белки', () => {
    for (const id of ['whey_protein', 'casein', 'whey_isolate']) {
      expect(isMilkProteinId(id)).toBe(true);
      expect(FOOD_ALLERGEN_DIET[id]?.allergens || []).toContain('dairy');
      // Молочные белки совместимы с ЛАКТО-вегетарианским рационом (isVegetarian: true),
      // но НЕ веганские — веган отсекает их по isVegan:false. Это корректная семантика.
      expect(FOOD_ALLERGEN_DIET[id]?.isVegetarian).toBe(true);
      expect(FOOD_ALLERGEN_DIET[id]?.isVegan).toBe(false);
    }
  });
});

describe('Волна 1 · P1-10: спецприёмы уважают excludedFoods и excludedCategories', () => {
  it('явный excludedFood попадает в набор запрещённых', () => {
    const ids = resolveSpecialMealExcludedIds([], [], ['chicken_breast'], []);
    expect(ids).toContain('chicken_breast');
  });

  it('исключённая категория выносит все её продукты', () => {
    const cat = 'grain';
    const ids = resolveSpecialMealExcludedIds([], [], [], [cat]);
    const expected = FOOD_DB.filter(f => f.category === cat).map(f => f.id);
    expect(expected.length).toBeGreaterThan(0);
    for (const id of expected) expect(ids).toContain(id);
  });

  it('аллергены по-прежнему учитываются (без регрессии)', () => {
    const base = resolveAllExcludedFoodIds(FOOD_DB, ['молочные'], []);
    const ids = resolveSpecialMealExcludedIds(['молочные'], [], [], []);
    for (const id of base) expect(ids).toContain(id);
  });

  it('пустые входы не ломают резолвер', () => {
    expect(Array.isArray(resolveSpecialMealExcludedIds([], [], [], []))).toBe(true);
  });
});

describe('Волна 1 · P1-09: строгая валидация импортируемого плана', () => {
  const goodPlan = () => ({
    meals: [{
      label: 'Обед', time: '12:00',
      items: [
        { id: 'chicken_breast', name: 'Куриная грудка', amount: 200, kcal: 330, p: 62, f: 7, c: 0, fiber: 0 },
        { id: 'rice', name: 'Рис', amount: 100, kcal: 130, p: 2.8, f: 0.3, c: 28, fiber: 0.4 },
      ],
    }],
  });

  it('корректный план проходит', () => {
    expect(_validateImportedPlan(goodPlan()).ok).toBe(true);
  });

  it('amount = undefined отклоняется', () => {
    const p = goodPlan() as any;
    delete p.meals[0].items[0].amount;
    const r = _validateImportedPlan(p);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('граммовка');
  });

  it('amount = 0 / отрицательный / NaN отклоняются', () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      const p = goodPlan() as any;
      p.meals[0].items[0].amount = bad;
      expect(_validateImportedPlan(p).ok).toBe(false);
    }
  });

  it('отрицательные макросы отклоняются', () => {
    const p = goodPlan() as any;
    p.meals[0].items[0].p = -1;
    expect(_validateImportedPlan(p).ok).toBe(false);
  });

  it('пустое имя продукта отклоняется', () => {
    const p = goodPlan() as any;
    p.meals[0].items[0].name = '   ';
    expect(_validateImportedPlan(p).ok).toBe(false);
  });

  it('пустой meals / отсутствие meals / items отклоняются', () => {
    expect(_validateImportedPlan({ meals: [] }).ok).toBe(false);
    expect(_validateImportedPlan({}).ok).toBe(false);
    expect(_validateImportedPlan({ meals: [{ label: 'Обед' }] }).ok).toBe(false);
  });

  it('нормализация ПЕРЕСЧИТЫВАЕТ totals из items (файл не может «наврать» КБЖУ)', () => {
    const p = goodPlan() as any;
    p.meals[0].totals = { kcal: 99999, p: 0, f: 0, c: 0 };
    p.totals = { kcal: 99999, p: 0, f: 0, c: 0 };
    const n = _normalizeImportedPlan(p);
    expect(n.meals[0].totals.kcal).toBe(460);
    expect(n.totals.kcal).toBe(460);
    expect(n.totals.p).toBeCloseTo(64.8, 1);
  });

  it('нормализация проставляет fiber = 0, если его не было', () => {
    const p = goodPlan() as any;
    delete p.meals[0].items[0].fiber;
    const n = _normalizeImportedPlan(p);
    expect(n.meals[0].items[0].fiber).toBe(0);
  });

  it('валидатор собирает id продуктов для проверки ограничений', () => {
    const r = _validateImportedPlan(goodPlan());
    expect(r.ok).toBe(true);
    expect(r.blocked).toContain('chicken_breast');
  });
});

describe('Волна 1 · рецептурная сборка принимает новые гейты', () => {
  const oneMealDay = () => [{
    label: 'Обед', time: '12:00',
    target: { p: 45, c: 55, f: 10 }, totals: { kcal: 500, p: 45, c: 55, f: 10 },
  }];

  const runDay = (recipe: Recipe, over: Record<string, any> = {}) => assembleRecipeDay({
    meals: oneMealDay() as any,
    pool: [recipe],
    targets: { kcal: 2000, p: 160, f: 60, c: 220 } as any,
    excludedIds: new Set<string>(),
    maxPrepTimeMin: 60,
    ...over,
  } as any);

  it('исключённый рецепт не попадает в собранный день', () => {
    const recipe = mkRecipe({ meal: 'lunch', name: 'Обед с курицей', ingredientIds: ['chicken_breast', 'rice'] });
    const res = runDay(recipe, { excludedRecipeNames: new Set(['Обед с курицей']) });
    const applied = (res.meals || []).some((m: any) => m?.recipeApplied === 'Обед с курицей');
    expect(applied).toBe(false);
  });

  it('РЕГРЕСС-ОБХОД: фолбэк-подбор не возвращает рецепт с аллергеном (главный баг)', () => {
    // Раньше: скоринг отбрасывал рецепт по аллергену, затем фолбэк по макро-дистанции
    // брал его обратно — пользователю с аллергией на молоко возвращался молочный рецепт.
    const recipe = mkRecipe({ meal: 'lunch', name: 'Молочный десерт', ingredientIds: ['whey_protein', 'oats'] });
    const res = runDay(recipe, { allergenTags: new Set(['dairy']) });
    const applied = (res.meals || []).some((m: any) => m?.recipeApplied === 'Молочный десерт');
    expect(applied).toBe(false);
  });

  it('фолбэк не возвращает рецепт с исключённым ингредиентом', () => {
    const recipe = mkRecipe({ meal: 'lunch', name: 'Обед с курицей', ingredientIds: ['chicken_breast', 'rice'] });
    const res = runDay(recipe, { excludedIds: new Set(['chicken_breast']) });
    const applied = (res.meals || []).some((m: any) => m?.recipeApplied === 'Обед с курицей');
    expect(applied).toBe(false);
  });

  it('без ограничений рецепт по-прежнему применяется (нет регрессии сборки)', () => {
    const recipe = mkRecipe({ meal: 'lunch', name: 'Обед с курицей', ingredientIds: ['chicken_breast', 'rice'] });
    const res = runDay(recipe);
    const applied = (res.meals || []).some((m: any) => m?.recipeApplied === 'Обед с курицей');
    expect(applied).toBe(true);
  });

  it('единый фильтр пикера убирает рецепт по имени и категории', () => {
    const byName = mkRecipe({ meal: 'lunch', name: 'Обед с рисом', ingredientIds: ['rice_white'] });
    const byCategory = mkRecipe({ meal: 'lunch', name: 'Обед с курицей', ingredientIds: ['chicken_breast'] });
    const allowed = mkRecipe({ meal: 'lunch', name: 'Обед с овсянкой', ingredientIds: ['oats'] });
    const out = filterRecipesByHardRestrictions([byName, byCategory, allowed], baseOpts({
      excludedRecipeNames: new Set(['Обед с рисом']),
      categoryPref: { preferred: [], excluded: ['protein'] },
    }));
    expect(out.map(r => r.name)).toEqual(['Обед с овсянкой']);
  });
});

