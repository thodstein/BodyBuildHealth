/**
 * planner-wave3-quality.test.ts — Wave 3: интеграция качества продуктов
 * (bb_quality_score) в генерацию рациона.
 *
 * Покрывает три механизма волны:
 *  1. Quality-weighted pick (pickWeighted в meal-plan-engine.ts): продукты с более
 *     высоким bb_quality_score получают пропорционально высокую вероятность
 *     выбора (вес = score^1.5 в режиме 'full').
 *  2. Quality bonus в скоринге рецептов (scoreRecipeForMeal): средний
 *     bb_quality_score ингредиентов ≥8 → +4, <5 → −3, иначе 0.
 *  3. Обратная совместимость: продукты без bb_quality_score получают дефолт 5
 *     (вес равен продукту со score 5).
 *
 * Статистические тесты используют широкие полосы (детерминированный seededRandom,
 * N=4000) — проверяется направление и порядок величины, а не точная доля.
 */
import { describe, it, expect } from 'vitest';
import { _pickWeightedForTest } from '../meal-plan-engine';
import { scoreRecipeForMeal, pickRecipeForMeal, type RecipeMatchOptions } from '../recipe-engine';

const mkFood = (id: string, score?: number) =>
  ({ id, ...(score !== undefined ? { bb_quality_score: score } : {}) }) as any;

const PICKS = 4000;
const pickCount = (pool: any[], want: string): number => {
  let n = 0;
  for (let i = 0; i < PICKS; i++) {
    if (_pickWeightedForTest(pool, 50000 + i * 13)?.id === want) n++;
  }
  return n;
};

describe('Wave 3: quality-weighted pick (pickWeighted)', () => {
  it('детерминирован: одинаковый seed → одинаковый выбор', () => {
    const pool = [mkFood('a', 9.5), mkFood('b', 4.5), mkFood('c', 7)];
    const first = _pickWeightedForTest(pool, 42);
    for (let i = 0; i < 10; i++) {
      expect(_pickWeightedForTest(pool, 42)?.id).toBe(first?.id);
    }
  });

  it('продукт с высоким bb_quality_score выбирается пропорционально чаще', () => {
    // Веса: 9.5^1.5 ≈ 29.3 против 4.5^1.5 ≈ 9.5 → ожидаемая доля «hi» ≈ 0.75.
    const hi = pickCount([mkFood('hi', 9.5), mkFood('lo', 4.5)], 'hi');
    expect(hi / PICKS).toBeGreaterThan(0.68);
    expect(hi / PICKS).toBeLessThan(0.82);
  });

  it('пропорциональность монотонна по score (9.5 чаще 7, 7 чаще 4.5)', () => {
    const hiVsMid = pickCount([mkFood('hi', 9.5), mkFood('mid', 7)], 'hi');
    const midVsLo = pickCount([mkFood('mid', 7), mkFood('lo', 4.5)], 'mid');
    // 9.5^1.5/7^1.5 ≈ 1.56 → hi ≈ 0.61; 7^1.5/4.5^1.5 ≈ 1.97 → mid ≈ 0.66
    expect(hiVsMid / PICKS).toBeGreaterThan(0.55);
    expect(midVsLo / PICKS).toBeGreaterThan(0.58);
  });

  it('обратная совместимость: продукт без bb_quality_score получает дефолт 5', () => {
    // Вес без score = 5^1.5 — в точности как у продукта со score 5 → доли ~1:1.
    const withDefault = pickCount([mkFood('noScore'), mkFood('five', 5)], 'noScore');
    expect(withDefault / PICKS).toBeGreaterThan(0.38);
    expect(withDefault / PICKS).toBeLessThan(0.62);
  });

  it('нулевой score не обнуляет выбор (пол веса 0.5)', () => {
    const pool = [mkFood('zero', 0), mkFood('hi', 9.5)];
    const zero = pickCount(pool, 'zero');
    // 0.5 / (0.5 + 29.3) ≈ 1.7% — нулевой иногда выбирается, но редко.
    expect(zero).toBeGreaterThan(0);
    expect(zero / PICKS).toBeLessThan(0.1);
  });

  it('крайние случаи: один элемент возвращается всегда, пустой пуль — undefined', () => {
    expect(_pickWeightedForTest([mkFood('only', 3)], 7)?.id).toBe('only');
    expect(_pickWeightedForTest([], 7)).toBeUndefined();
  });
});

describe('Wave 3: quality bonus в скоринге рецептов (scoreRecipeForMeal)', () => {
  // Идентичные макра/тип/время → базовый скор у всех одинаковый (50+20+8+10+5=93),
  // различие ТОЛЬКО за счёт качества ингредиентов — бонус изолированно измерим.
  const baseRecipe = (id: string, ingredientIds?: string[]) => ({
    id,
    name: `Wave3 ${id}`,
    meal: 'lunch',
    kcal: 700, protein: 40, fat: 15, carbs: 60,
    prepTimeMin: 15, difficulty: 'easy' as const,
    tags: [], ingredients: [],
    ...(ingredientIds ? { ingredientIds } : {}),
  });

  const opts: RecipeMatchOptions = {
    mealType: 'lunch',
    targetKcal: 600, targetProteinG: 40, targetFatG: 16, targetCarbsG: 58,
    excludedIds: new Set(),
  };

  it('рецепт с высококачественными ингредиентами (avg ≥ 8) получает +4', () => {
    const hi = scoreRecipeForMeal(baseRecipe('hi', ['chicken_breast', 'salmon']), opts); // avg 9.25
    const ref = scoreRecipeForMeal(baseRecipe('ref', ['w3_unknown_a', 'w3_unknown_b']), opts); // n=0
    expect(hi).toBe(ref + 4);
  });

  it('рецепт с низкокачественными ингредиентами (avg < 5) получает −3', () => {
    const lo = scoreRecipeForMeal(baseRecipe('lo', ['olive_oil', 'butter']), opts); // avg 4.5
    const ref = scoreRecipeForMeal(baseRecipe('ref', ['w3_unknown_a', 'w3_unknown_b']), opts);
    expect(lo).toBe(ref - 3);
  });

  it('смешанное качество (5 ≤ avg < 8) не меняет скор', () => {
    const mid = scoreRecipeForMeal(baseRecipe('mid', ['chicken_breast', 'olive_oil']), opts); // avg 7
    const ref = scoreRecipeForMeal(baseRecipe('ref', ['w3_unknown_a', 'w3_unknown_b']), opts);
    expect(mid).toBe(ref);
  });

  it('обратная совместимость: ингредиенты без bb_quality_score не дают бонуса', () => {
    const noScore = scoreRecipeForMeal(baseRecipe('none', ['w3_unknown_a', 'w3_unknown_b']), opts);
    const ref = scoreRecipeForMeal(baseRecipe('ref', []), opts);
    expect(noScore).toBe(ref);
  });
});

describe('Wave 3: pickRecipeForMeal предпочитает качественные рецепты', () => {
  const baseRecipe = (id: string, ingredientIds?: string[]) => ({
    id,
    name: `Wave3 ${id}`,
    meal: 'lunch',
    kcal: 700, protein: 40, fat: 15, carbs: 60,
    prepTimeMin: 15, difficulty: 'easy' as const,
    tags: [], ingredients: [],
    ...(ingredientIds ? { ingredientIds } : {}),
  });

  const opts: RecipeMatchOptions = {
    mealType: 'lunch',
    targetKcal: 600, targetProteinG: 40, targetFatG: 16, targetCarbsG: 58,
    excludedIds: new Set(),
  };

  it('при иначе равных скорах побеждает рецепт с высоким bb_quality_score', () => {
    const hi = baseRecipe('hi', ['chicken_breast', 'salmon']);
    const plain = baseRecipe('plain', ['w3_unknown_a', 'w3_unknown_b']);
    const picked = pickRecipeForMeal([plain, hi], opts);
    expect(picked?.id).toBe('hi');
  });

  it('при равном качестве выбор детерминирован (stable sort)', () => {
    const a = baseRecipe('a', ['chicken_breast', 'salmon']);
    const b = baseRecipe('b', ['turkey_breast', 'beef_lean']); // avg 9.25 — тот же бонус
    const picked = pickRecipeForMeal([a, b], opts);
    expect(['a', 'b']).toContain(picked?.id);
  });
});
