/**
 * day-variety.engine.test.ts — тесты variety-скора дня (доп. 9).
 *
 * - разнообразный день → высокий скор;
 * - однообразный день (рис) → низкий скор;
 * - пустой день → 0, без NaN.
 */
import { describe, it, expect } from 'vitest';
import { computeDayVariety } from '../day-variety.engine';

describe('computeDayVariety (доп. 9)', () => {
  it('разнообразный день → скор ≥ 5 (выше, чем однообразный)', () => {
    const r = computeDayVariety({
      meals: [
        { products: [{ foodId: 'chicken_breast', weightGrams: 150 }, { foodId: 'broccoli', weightGrams: 150 }] },
        { products: [{ foodId: 'salmon', weightGrams: 150 }, { foodId: 'rice_white', weightGrams: 150 }] },
        { products: [{ foodId: 'banana', weightGrams: 120 }] },
      ],
    });
    const mono = computeDayVariety({ meals: [{ products: [{ foodId: 'rice_white', weightGrams: 300 }] }] });
    expect(r.score).toBeGreaterThan(mono.score);
    expect(r.score).toBeGreaterThanOrEqual(5);
    expect(r.categories.length).toBeGreaterThanOrEqual(2);
  });

  it('однообразный день (рис) → низкий скор', () => {
    const r = computeDayVariety({ meals: [{ products: [{ foodId: 'rice_white', weightGrams: 300 }] }] });
    expect(r.score).toBeLessThan(5);
  });

  it('пустой день → 0 без NaN', () => {
    const r = computeDayVariety({ meals: [] });
    expect(r.score).toBe(0);
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.categories).toHaveLength(0);
  });
});
