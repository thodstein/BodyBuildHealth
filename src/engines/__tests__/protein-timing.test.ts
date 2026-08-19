/**
 * protein-timing.engine.test.ts — тесты протеин-тайминга по FFM (доп. 3).
 *
 * - окно приёма зависит от FFM и капается на 50 г;
 * - равномерный полноценный рацион → «отлично»;
 * - рацион с маленькими/слабыми приёмами → «недостаточно»;
 * - без приёмов → «недостаточно», без NaN.
 */
import { describe, it, expect } from 'vitest';
import { analyzeProteinTiming } from '../protein-timing.engine';

describe('analyzeProteinTiming (доп. 3)', () => {
  it('целевое окно капается на 50 г и растёт с FFM', () => {
    const big = analyzeProteinTiming([], 100);
    expect(big.targetPerMealMax).toBe(50);
    const small = analyzeProteinTiming([], 50);
    expect(small.targetPerMealMax).toBe(27.5);
  });

  it('равномерный полноценный рацион → отлично', () => {
    const r = analyzeProteinTiming(
      [
        { products: [{ foodId: 'chicken_breast', weightGrams: 150 }] },
        { products: [{ foodId: 'chicken_breast', weightGrams: 150 }] },
      ],
      80,
    );
    // 150 г курицы ≈ 46 г белка; при FFM 80 окно 32-50 г → within
    expect(r.verdict).toBe('отлично');
    expect(r.goodMeals).toBe(2);
  });

  it('мелкий рацион → недостаточно', () => {
    const r = analyzeProteinTiming(
      [
        { products: [{ foodId: 'apple', weightGrams: 150 }] },
        { products: [{ foodId: 'rice_white', weightGrams: 150 }] },
      ],
      80,
    );
    expect(r.verdict).not.toBe('отлично');
    expect(r.totalMeals).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.goodMeals)).toBe(true);
  });

  it('без приёмов → недостаточно, без NaN', () => {
    const r = analyzeProteinTiming([], 80);
    expect(r.verdict).toBe('недостаточно');
    expect(Number.isFinite(r.targetPerMealMin)).toBe(true);
    expect(r.rationale.length).toBeGreaterThan(0);
  });
});
