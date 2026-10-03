import { describe, it, expect } from 'vitest';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { RECIPE_DB_P26 } from '../../../../../data/recipe-db-p26';
import { RECIPE_DB_P27 } from '../../../../../data/recipe-db-p27';
import { RECIPE_DB_P28 } from '../../../../../data/recipe-db-p28';
import { RECIPE_DB_P29 } from '../../../../../data/recipe-db-p29';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { kbjuFormulaDeviationPct } from '../planner-recipe-mode';
import { recipeDecompositionDeviationPct, recipeDecompositionFacts } from '../recipe-engine';

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

/**
 * Честность «шапка рецепта ↔ декомпозиция» (остаток плана единого источника).
 * Декомпозиция (ingredientIds × portions) — это фактически съедаемые Б/Ж/У; шапка —
 * авторская заявка. Замер: 953 из 994 рецептов с ingredientIds расходятся >3%
 * (топ-оффендеры: жир ×2.9–3.9 от шапки). Это унаследованный дефект данных:
 * шапки не пересчитываются из раскладки (нормализуется только kcal из шапки).
 * Лок — ПОТОЛОК: расхождение не должно РАСТИ (новые рецепты — писать порции под шапку).
 * Полная синхронизация шапки из декомпозиции = отдельная сессия (меняет числа планов).
 */
describe('Рецепт: шапка vs декомпозиция (baseline-ceiling)', () => {
  const BASELINE_BAD = 953;

  it('helper: рецепт без ingredientIds → 0; facts совпадают с декомпозицией', () => {
    const noIds = { ...RECIPE_DB[0], ingredientIds: undefined } as any;
    expect(recipeDecompositionDeviationPct(noIds)).toBe(0);
    const withIds = RECIPE_DB.find(r => r.ingredientIds && r.ingredientIds.length > 0)!;
    const facts = recipeDecompositionFacts(withIds);
    expect(Number.isFinite(facts.p) && Number.isFinite(facts.f) && Number.isFinite(facts.c)).toBe(true);
    expect(facts.kcal).toBe(Math.round(4 * facts.p + 9 * facts.f + 4 * facts.c));
  });

  it('число рецептов с расхождением >3% не превышает baseline (не растёт)', () => {
    const withIds = RECIPE_DB.filter(r => r.ingredientIds && r.ingredientIds.length > 0);
    const bad = withIds.filter(r => recipeDecompositionDeviationPct(r) > 3);
    expect(withIds.length).toBeGreaterThan(0);
    expect(bad.length, `было ${BASELINE_BAD}, стало ${bad.length} — новые рецепты должны писать порции под шапку`).toBeLessThanOrEqual(BASELINE_BAD);
  });
});
