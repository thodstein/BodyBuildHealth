import { describe, it, expect } from 'vitest';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { decomposeRecipe } from '../recipe-engine';
import { assembleRecipeDay } from '../planner-recipe-mode';
import { isProteinPowderId } from '../food-availability';
import { buildDayPlan } from '../meal-plan-engine';

/**
 * Эпик F3: ГЕЙТЫ ДАННЫХ РЕЦЕПТОВ (грамовки, роли, порошки).
 * Источник багов: enrichment-генератор ставил безразмерным ингредиентам 100 г
 * («оливковое масло 100 г» = 884 ккал в «лёгкой треске 380 ккал»).
 */
describe('F3: гаранты рецептов', () => {
  it('масла ≤15 г, цитрус ≤60 г, соусы ≤30 г, специи ≤10 г — после sanitizeRecipePortions', () => {
    const caps: [RegExp, number][] = [
      [/^(oil_|butter_)/, 15],
      [/^(citrus|lemon|lime)$/, 60],
      [/^(sauce_|mayonnaise|mayo_|ketchup|sour_cream)/, 30],
      [/^(spice_|herb_)/, 10],
    ];
    let checked = 0;
    for (const r of RECIPE_DB) {
      for (const [fid, g] of Object.entries(r.portions || {})) {
        for (const [pat, cap] of caps) {
          if (pat.test(fid)) {
            checked++;
            expect(g, `${r.name}: ${fid} = ${g} г (кап ${cap})`).toBeLessThanOrEqual(cap);
          }
        }
      }
    }
    expect(checked, 'санитайзер должен был что-то проверять').toBeGreaterThan(50);
  });

  it('oats ≤150 г в рецептах — сухая мера ремапится на oats_dry', () => {
    for (const r of RECIPE_DB) {
      if (r.portions?.['oats'] !== undefined) {
        expect(r.portions['oats'], `${r.name}: варёная овсянка ${r.portions['oats']} г`).toBeGreaterThan(150);
      }
    }
  });

  it('decomposition в коридоре 0.6-1.6 шапки после sanitize (без split-scale легаси)', () => {
    // Рецепты БЕЗ ingredientIds (легаси) разбираются строками — они вне этого теста.
    const withIds = RECIPE_DB.filter(r => r.ingredientIds && r.ingredientIds.length > 0 && r.kcal > 0);
    expect(withIds.length).toBeGreaterThan(500);
    for (const r of withIds) {
      const items = decomposeRecipe(r, new Set());
      const sum = items.reduce((s, it) => s + it.kcal, 0);
      if (sum < 80) continue; // микрорецепты/заготовки
      const ratio = sum / r.kcal;
      expect(ratio, `${r.name}: декомпозиция ${Math.round(sum)} vs шапка ${r.kcal} (×${ratio.toFixed(2)})`).toBeGreaterThanOrEqual(0.6);
      expect(ratio, `${r.name}: декомпозиция ${Math.round(sum)} vs шапка ${r.kcal} (×${ratio.toFixed(2)})`).toBeLessThanOrEqual(1.6);
    }
  });

  it('D4: порошковый лимит в рецептурном дне — ≤2 приёмов с порошковыми рецептами', () => {
    const base = buildDayPlan({
      weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
      goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
      budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false, randomSalt: 42,
    } as any);
    const meals = base.meals.map((m: any) => ({ label: m.label, time: m.time, type: m.type, target: m.target || { kcal: m.totals?.kcal || 0 }, items: m.items, totals: m.totals, rationale: m.rationale }));
    const res = assembleRecipeDay({
      meals,
      pool: RECIPE_DB,
      targets: { kcal: 3200, p: 190, f: 80, c: 400 },
      excludedIds: new Set<string>(),
      cookProfile: { skill: 'basic', dailyMinutes: 60, maxMinutesPerMeal: 30, batchSize: 1 },
      budget: 'medium',
      isVegetarian: false,
      preferredRecipeNames: new Set<string>(),
      usedNamesAcrossDays: new Set<string>(),
      goal: 'mass',
    } as any);
    const powderMealCount = (res.meals as any[]).filter(m => (m.recipeAppliedData && (m.recipeAppliedData.ingredientIds || []).some((fid: string) => isProteinPowderId(fid)))).length;
    expect(powderMealCount, `${powderMealCount} рецептурных приёмов с порошком (лимит 2)`).toBeLessThanOrEqual(2);
  });
});
