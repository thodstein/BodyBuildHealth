import { describe, it, expect } from 'vitest';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { RECIPE_DB_P26 } from '../../../../../data/recipe-db-p26';
import { RECIPE_DB_P27 } from '../../../../../data/recipe-db-p27';
import { RECIPE_DB_P28 } from '../../../../../data/recipe-db-p28';
import { RECIPE_DB_P29 } from '../../../../../data/recipe-db-p29';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { kbjuFormulaDeviationPct } from '../planner-recipe-mode';

/**
 * C-требование «Разночтение КБЖУ ≤3%»: kcal рецепта = 4Б + 4У + 9Ж (±3%).
 * Легаси-рецепты нормализуются на этапе сборки recipe-db.ts (normalizeRecipeKcal),
 * новые партии (p26/p27) написаны сразу по формуле.
 */
describe('КБЖУ-консистентность RECIPE_DB (≤3%)', () => {
  it('вся БД после нормализации сходится с формулой 4Б+4У+9Ж в пределах 3%', () => {
    const bad = RECIPE_DB.filter(r => kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs) > 3);
    expect(bad).toEqual([]);
  });

  it('новая партия p26 — kcal выведены из формулы (≤3%)', () => {
    const bad = RECIPE_DB_P26.filter(r => kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs) > 3);
    expect(bad.map(r => `${r.name}: dev=${kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs).toFixed(1)}%`)).toEqual([]);
  });

  it('новая партия p27 — kcal выведены из формулы (≤3%)', () => {
    const bad = RECIPE_DB_P27.filter(r => kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs) > 3);
    expect(bad.map(r => `${r.name}: dev=${kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs).toFixed(1)}%`)).toEqual([]);
  });

  it('новая партия p28 — kcal выведены из формулы (≤3%)', () => {
    const bad = RECIPE_DB_P28.filter(r => kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs) > 3);
    expect(bad.map(r => `${r.name}: dev=${kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs).toFixed(1)}%`)).toEqual([]);
  });

  it('новая партия p29 — kcal выведены из формулы (≤3%)', () => {
    const bad = RECIPE_DB_P29.filter(r => kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs) > 3);
    expect(bad.map(r => `${r.name}: dev=${kbjuFormulaDeviationPct(r.kcal, r.protein, r.fat, r.carbs).toFixed(1)}%`)).toEqual([]);
  });

  it('новые партии: ingredientIds существуют в FOOD_DB', () => {
    for (const shard of [RECIPE_DB_P26, RECIPE_DB_P27, RECIPE_DB_P28, RECIPE_DB_P29]) {
      for (const r of shard) {
        if (!r.ingredientIds) continue;
        const unknown = r.ingredientIds.filter(id => !FOOD_DB.some(f => f.id === id));
        expect(unknown, `${r.name}: неизвестные id ${unknown.join(', ')}`).toEqual([]);
      }
    }
  });

  it('новые партии: у рецептов с ingredientIds есть portions', () => {
    for (const shard of [RECIPE_DB_P26, RECIPE_DB_P27, RECIPE_DB_P28, RECIPE_DB_P29]) {
      for (const r of shard) {
        if (!r.ingredientIds || r.ingredientIds.length === 0) continue;
        expect(r.portions, r.name).toBeTruthy();
        for (const id of r.ingredientIds) {
          expect(typeof r.portions?.[id] === 'number' && (r.portions![id] || 0) > 0, `${r.name}: нет порции для ${id}`).toBe(true);
        }
      }
    }
  });

  it('партия добавила ~150 рецептов, имена уникальны в рамках партии', () => {
    const all = [...RECIPE_DB_P26, ...RECIPE_DB_P27, ...RECIPE_DB_P28, ...RECIPE_DB_P29];
    expect(all.length).toBeGreaterThanOrEqual(148);
    const names = new Set(all.map(r => r.name));
    expect(names.size).toBe(all.length);
  });
});
