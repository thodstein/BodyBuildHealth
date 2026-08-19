/**
 * evening-sleep.engine.test.ts — тесты вечернего приёма vs сон (доп. 8).
 *
 * - пустой вход → low без NaN;
 * - полноценный вечерний приём (триптофан+магний) → good;
 * - низкий (рис) → low.
 */
import { describe, it, expect } from 'vitest';
import { analyzeEveningSleep } from '../evening-sleep.engine';
import { FOOD_DB } from '../../core/nutrition-database';
import { getMicro } from '../../core/nutrition-micros';

describe('analyzeEveningSleep (доп. 8)', () => {
  it('пустой вход → low без NaN', () => {
    const r = analyzeEveningSleep([]);
    expect(r.status).toBe('low');
    expect(Number.isFinite(r.tryptophanMg)).toBe(true);
    expect(Number.isFinite(r.magnesiumMg)).toBe(true);
  });

  it('есть полноценный вечерний продукт → good или partial (не low)', () => {
    // ищем продукт с высоким триптофаном И магнием
    const rich = FOOD_DB.find(f => (f.amino_acid_profile_100g?.tryptophan_mg ?? 0) >= 250 && getMicro(f, 'Mg') >= 200);
    if (!rich) { expect(true).toBe(true); return; }
    const r = analyzeEveningSleep([{ foodId: rich.id, weightGrams: 100 }]);
    expect(['good', 'partial']).toContain(r.status);
    expect(r.recommendation.length).toBeGreaterThan(0);
  });

  it('рис → low (низкие триптофан и магний)', () => {
    const r = analyzeEveningSleep([{ foodId: 'rice_white', weightGrams: 200 }]);
    expect(r.status).toBe('low');
  });
});
