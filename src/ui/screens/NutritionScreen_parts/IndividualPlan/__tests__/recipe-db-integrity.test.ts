/**
 * recipe-db-integrity.test.ts — гейт целостности базы рецептов (Aug 28 2026).
 * Жалобы: «рецепты ужатые/не соответствуют» — источник: битые ingredientIds
 * (молча выбрасываются → декомпозиция раздувается масштабом), опечатки порций
 * (coconut_oil 150-300 г → scale 0.09 → все ингредиенты флорятся в 5 г), плейсхолдеры.
 */
import { describe, it, expect } from 'vitest';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const FOOD_IDS = new Set(FOOD_DB.map(f => f.id));

function decomposeKcal(r: any): number {
  if (!r.ingredientIds || r.ingredientIds.length === 0) return 0;
  let sum = 0;
  for (const fid of r.ingredientIds) {
    const food = FOOD_DB.find((f: any) => f.id === fid);
    if (!food) continue;
    const g = r.portions?.[fid] ?? 100;
    const k = g / 100;
    sum += Math.round(4 * (food.protein || 0) * k + 9 * (food.fat || 0) * k + 4 * (food.carbs || 0) * k);
  }
  return sum;
}

describe('recipe-db integrity (Aug 28)', () => {
  it('все ingredientIds существуют в FOOD_DB (битые → декомпозиция врёт)', () => {
    const bad: string[] = [];
    for (const r of RECIPE_DB) {
      for (const fid of r.ingredientIds || []) {
        if (!FOOD_IDS.has(fid)) bad.push(`${r.name}: ${fid}`);
      }
    }
    expect(bad, `битые id:\n${bad.slice(0, 20).join('\n')}`).toEqual([]);
  });

  it('coconut_oil порция ≤ 30 г (были опечатки 150-300 г → scale 0.09 → порции по 5 г)', () => {
    const bad: string[] = [];
    for (const r of RECIPE_DB) {
      const g = r.portions?.['coconut_oil'];
      if (typeof g === 'number' && g > 30) bad.push(`${r.name}: coconut_oil ${g}г`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('декомпозиция покрывает 70-140% заявленного kcal (иначе порции «ужимаются» масштабом)', () => {
    const bad: string[] = [];
    for (const r of RECIPE_DB) {
      if (!r.ingredientIds || r.ingredientIds.length === 0) continue; // легаси — отдельный вопрос
      const decomp = decomposeKcal(r);
      if (decomp <= 0) { bad.push(`${r.name}: пустая декомпозиция`); continue; }
      const ratio = r.kcal / decomp;
      if (ratio > 1.41 || ratio < 0.69) bad.push(`${r.name}: kcal ${r.kcal} / decomp ${Math.round(decomp)} (×${ratio.toFixed(2)})`);
    }
    expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
  });

  it('нет вырожденных рецептов (non-snack с kcal < 150 после нормализации)', () => {
    const bad: string[] = [];
    for (const r of RECIPE_DB) {
      if (r.meal !== 'snack' && r.kcal < 150) bad.push(`${r.name}: ${r.kcal} ккал для ${r.meal}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('партия p30 «Масса» присутствует и закрывает крупных атлетов (Aug 28)', () => {
    const p30 = RECIPE_DB.filter(r => (r.tags || []).includes('масса') && r.name.startsWith('BB-Масса'));
    expect(p30.length).toBeGreaterThanOrEqual(38);
    const breakfasts = p30.filter(r => r.meal === 'breakfast');
    expect(breakfasts.length).toBeGreaterThanOrEqual(10);
    // до p30 максимальный завтрак БД был 560 ккал — не покрывал 110 кг атлета
    expect(Math.min(...breakfasts.map(r => r.kcal))).toBeGreaterThanOrEqual(700);
    const mains = p30.filter(r => r.meal === 'lunch' || r.meal === 'dinner');
    expect(mains.length).toBeGreaterThanOrEqual(12);
    expect(Math.max(...mains.map(r => r.protein))).toBeGreaterThanOrEqual(95);
  });
});
