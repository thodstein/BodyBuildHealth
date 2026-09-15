/**
 * planner-recipe-optimizer.test.ts — E4 (MIGP-lite) фундамент:
 * совместный подбор дискретных порций рецептов дня лучше независимого округления.
 */
import { describe, it, expect } from 'vitest';
import { optimizeRecipePortionScales, maxRelativeDeviation } from '../planner-recipe-optimizer';
import { RECIPE_DB } from '../../../../../data/recipe-db';

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3];

describe('E4: optimizeRecipePortionScales', () => {
  it('сходится к цели совместно (пример с решением ≤3%)', () => {
    const cores = [
      { kcal: 600, p: 40, f: 20, c: 60 },
      { kcal: 500, p: 30, f: 15, c: 70 },
    ];
    const target = { kcal: 600 * 1.5 + 500 * 1, p: 40 * 1.5 + 30, f: 20 * 1.5 + 15, c: 60 * 1.5 + 70 };
    const r = optimizeRecipePortionScales(cores, target, STEPS);
    expect(r.devPct).toBeLessThanOrEqual(0.03);
    expect(r.scales.every(s => STEPS.includes(s))).toBe(true);
  });

  it('лучше независимого «ближайший шаг к своей доле»', () => {
    // Цель требует, чтобы первый приём был ×2, а второй ×1 — наивная доля даёт ×1.5/×1.5.
    const cores = [
      { kcal: 300, p: 30, f: 5, c: 10 },
      { kcal: 900, p: 30, f: 20, c: 100 },
    ];
    const target = { kcal: 300 * 2 + 900 * 1, p: 30 * 2 + 30, f: 5 * 2 + 20, c: 10 * 2 + 100 };
    const best = optimizeRecipePortionScales(cores, target, STEPS);
    const naive = optimizeRecipePortionScales(cores, target, [1.5]); // только один шаг — «уравниловка»
    expect(best.devPct).toBeLessThan(naive.devPct);
    expect(best.devPct).toBeLessThanOrEqual(0.001);
  });

  it('учитывает фиксированную часть (перекусы/peri) в сумме дня', () => {
    const cores = [{ kcal: 500, p: 40, f: 15, c: 60 }];
    const target = { kcal: 1500, p: 120, f: 45, c: 180 };
    const fixed = { kcal: 500, p: 40, f: 15, c: 60 };
    const r = optimizeRecipePortionScales(cores, target, STEPS, fixed);
    expect(r.devPct).toBeLessThanOrEqual(0.03); // ядро ×2 + фикс = цель
  });

  it('null-ядро игнорируется, пустой вход не падает', () => {
    expect(optimizeRecipePortionScales([], { kcal: 100, p: 10, f: 5, c: 10 }, STEPS).devPct).toBeGreaterThan(0);
    const r = optimizeRecipePortionScales([null, { kcal: 500, p: 40, f: 15, c: 60 }], { kcal: 500, p: 40, f: 15, c: 60 }, STEPS);
    expect(r.devPct).toBeLessThanOrEqual(0.001);
  });

  it('maxRelativeDeviation считает по ненулевым целям', () => {
    expect(maxRelativeDeviation({ kcal: 110, p: 0, f: 0, c: 0 }, { kcal: 100, p: 0, f: 0, c: 0 })).toBeCloseTo(0.1, 4);
  });

  it('на реальных рецептах: подбор ≤ независимого, HV-цель в разумном допуске', () => {
    const pick = (meal: string, n = 1) => RECIPE_DB.filter((r: any) => r.meal === meal && (r.ingredientIds || []).length > 0).slice(0, n);
    const mains = [...pick('breakfast'), ...pick('lunch'), ...pick('dinner')] as any[];
    const cores = mains.map(r => ({ kcal: r.kcal, p: r.protein, f: r.fat, c: r.carbs }));
    const base = cores.reduce((s, c) => ({ kcal: s.kcal + c.kcal, p: s.p + c.p, f: s.f + c.f, c: s.c + c.c }), { kcal: 0, p: 0, f: 0, c: 0 });
    // Цель = ядро ×2 (типичный масс-день) + фикс перекусов.
    const target = { kcal: base.kcal * 2 + 900, p: base.p * 2 + 80, f: base.f * 2 + 30, c: base.c * 2 + 150 };
    const fixed = { kcal: 900, p: 80, f: 30, c: 150 };
    const r = optimizeRecipePortionScales(cores, target, STEPS, fixed);
    expect(r.devPct).toBeLessThanOrEqual(0.06);
    // и строго не хуже, чем жать минимальный шаг всем
    const min = optimizeRecipePortionScales(cores, target, [STEPS[0]]);
    expect(r.devPct).toBeLessThanOrEqual(min.devPct + 1e-9);
  });
});
