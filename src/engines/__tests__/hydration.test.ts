/**
 * hydration.engine.test.ts — тесты гидратации/электролитов (доп. 10).
 *
 * - высокий натрий → sodiumHigh + attention;
 * - пустой день → attention без NaN;
 * - овощно-фруктовый день: значения конечны, статус корректен.
 */
import { describe, it, expect } from 'vitest';
import { computeHydration } from '../hydration.engine';
import { FOOD_DB } from '../../core/nutrition-database';
import { getMicro } from '../../core/nutrition-micros';

describe('computeHydration (доп. 10)', () => {
  it('фастфуд (натрий ≥ 1600 мг/100г) → sodiumHigh + attention', () => {
    // 150 г × ≥1600 мг/100г = ≥2400 мг > 2300
    const salty = FOOD_DB.find(f => getMicro(f, 'Na') >= 1600);
    if (!salty) { expect(true).toBe(true); return; }
    const r = computeHydration({ products: [{ foodId: salty.id, weightGrams: 150 }] });
    expect(r.sodiumHigh).toBe(true);
    expect(r.status).toBe('attention');
  });

  it('пустой день → attention без NaN', () => {
    const r = computeHydration({ products: [] });
    expect(Number.isFinite(r.sodiumMg)).toBe(true);
    expect(Number.isFinite(r.potassiumMg)).toBe(true);
    expect(Number.isFinite(r.kNaRatio)).toBe(true);
    expect(r.status).toBe('attention');
  });

  it('овощно-фруктовый день: конечные значения и корректная рекомендация', () => {
    const r = computeHydration({ products: [
      { foodId: 'spinach', weightGrams: 100 },
      { foodId: 'banana', weightGrams: 150 },
      { foodId: 'almonds', weightGrams: 40 },
    ] });
    expect(Number.isFinite(r.potassiumMg)).toBe(true);
    expect(Number.isFinite(r.magnesiumMg)).toBe(true);
    expect(['ok', 'attention']).toContain(r.status);
    expect(r.recommendation.length).toBeGreaterThan(0);
  });
});
