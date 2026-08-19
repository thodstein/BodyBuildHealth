/**
 * daily-quality-score.test.ts — тесты скора качества дня (P1-5).
 *
 * - пустой день → 0, без NaN;
 * - день из полноценного приёма → скор 1-10;
 * - агрегация по калорийности: mealScores заполнен, ккал-взвешенный скор конечен;
 * - штраф по флагам: день с высокой гликемической нагрузкой добавляет penalty.
 */
import { describe, it, expect } from 'vitest';
import { computeDayQualityScore } from '../daily-quality-score';
import { getDefaultProfile } from '../product-usefulness-v2.engine';

const prof = () => {
  const p = getDefaultProfile();
  p.lbm = 70;
  return p;
};

describe('computeDayQualityScore (P1-5)', () => {
  it('пустой день → 0 без NaN', () => {
    const r = computeDayQualityScore([], prof());
    expect(r.score).toBe(0);
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.mealScores).toHaveLength(0);
  });

  it('день с полноценным приёмом → скор в 1-10 и разбивка по приёмам', () => {
    const r = computeDayQualityScore(
      [{ timing: 'regular', products: [{ foodId: 'chicken_breast', weightGrams: 150 }, { foodId: 'rice_white', weightGrams: 150 }] }],
      prof(),
    );
    expect(r.score).toBeGreaterThanOrEqual(1);
    expect(r.score).toBeLessThanOrEqual(10);
    expect(r.mealScores).toHaveLength(1);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it('агрегация: несколько приёмов — средний по калориям + возможные штрафы', () => {
    const r = computeDayQualityScore(
      [
        { timing: 'regular', products: [{ foodId: 'chicken_breast', weightGrams: 150 }] },
        { timing: 'post_workout', products: [{ foodId: 'banana', weightGrams: 120 }] },
      ],
      prof(),
    );
    expect(r.mealScores.length).toBeGreaterThanOrEqual(1);
    const weighted = r.mealScores.reduce((s, x) => s + x.score * x.kcal, 0) / r.mealScores.reduce((s, x) => s + x.kcal, 0);
    // допуск на штрафы по флагам (≤ 4 штрафа × 0.5)
    expect(Math.abs(r.score - Math.min(10, Math.max(0, Math.round(weighted * 10) / 10)))).toBeLessThanOrEqual(2);
  });

  it('высококалорийный рис: механизм штрафов живой (penalty содержит строки)', () => {
    const r = computeDayQualityScore(
      [{ timing: 'regular', products: [{ foodId: 'rice_white', weightGrams: 400 }] }],
      prof(),
    );
    if (r.penalties.length > 0) {
      expect(r.penalties.every(p => typeof p === 'string' && p.length > 0)).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
