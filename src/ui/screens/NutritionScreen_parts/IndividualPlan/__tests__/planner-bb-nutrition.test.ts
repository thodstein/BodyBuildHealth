/**
 * planner-bb-nutrition.test.ts — Ф4.25: чистая логика применения ББ-плана к дневным целям.
 * (калораж + циклирование углеводов по трен-дням; Atwater-консистентно; no-op без заметки).
 */
import { describe, it, expect } from 'vitest';
import { applyBBNutritionToTargets } from '../planner-bb-nutrition';

const base = () => ({ protein: 160, fats: 70, carbs: 300 }); // Atwater kcal = 2470

describe('applyBBNutritionToTargets (Ф4.25)', () => {
  it('без заметки — no-op (макросы и kcal не меняются, breakdown пуст)', () => {
    const r = applyBBNutritionToTargets({ ...base(), bbNote: null, todayDow: 1 });
    expect(r.carbs).toBe(300);
    expect(r.fats).toBe(70);
    expect(r.kcal).toBe(2470); // 160*4 + 300*4 + 70*9
    expect(r.isTrainToday).toBeNull();
    expect(r.breakdown).toEqual([]);
  });

  it('трен-день: углеводы +30 г, жир − (kcal остаётся Atwater-консистентным)', () => {
    const r = applyBBNutritionToTargets({ ...base(), bbNote: { trainDays: [1] }, todayDow: 1 });
    expect(r.isTrainToday).toBe(true);
    expect(r.carbs).toBe(330);
    expect(r.fats).toBe(70 - Math.round((30 * 4) / 9)); // ≈ 57
    expect(r.kcal).toBe(Math.round(160 * 4 + 330 * 4 + r.fats * 9));
    expect(r.breakdown.some(b => b.includes('трен-день'))).toBe(true);
  });

  it('день отдыха: углеводы −25 г', () => {
    const r = applyBBNutritionToTargets({ ...base(), bbNote: { trainDays: [1] }, todayDow: 2 });
    expect(r.isTrainToday).toBe(false);
    expect(r.carbs).toBe(275);
    expect(r.breakdown.some(b => b.includes('день отдыха'))).toBe(true);
  });

  it('целевой калораж ББ-плана применяется (в пределах 15%)', () => {
    const r = applyBBNutritionToTargets({ ...base(), bbNote: { kcal: 2600 }, todayDow: 1 });
    expect(r.kcal).toBe(2600);
    expect(r.breakdown.some(b => b.includes('Целевой калораж'))).toBe(true);
  });

  it('калораж вне 15% — не применяется (сохраняется Atwater)', () => {
    const r = applyBBNutritionToTargets({ ...base(), bbNote: { kcal: 4000 }, todayDow: 1 });
    expect(r.kcal).not.toBe(4000);
  });
});
