import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.95/§8.96: матрица 36 ячеек — сеть против регресса канона дня ──────────
//
// Отдельный файл намеренно: `assembleRecipeDay` течёт через модульный `_pickCtx`
// (долг «развязка рецептурной сборки от раскладки продуктового дня»), и внутри одного
// файла после recipe-вызовов продуктовые дни строятся в чужом контексте (замер: 70 кг
// cut/4 показывал 12.8% вместо 2.1%). Vitest даёт свежий модуль на файл — так замер
// честный и повторяемый.
//
// Замер (2026-11, после §8.95/§8.96): продуктовый контур 5/36 за 3% (худшая 3.9%),
// рецептурный 4/36 (худшая 7.8%). Долги B13 (подбор рецептов зависит от базового
// продуктового дня) и B15 (перебор внутри ядер рецептов) — в аудите §8.95c.

function profile(w: number, mode: 'mass' | 'cut', meals: number, pPerKg: number): MealPlanInput {
  const kcal = Math.round(w * (mode === 'mass' ? 36 : 26));
  const p = Math.round(w * pPerKg);
  const f = Math.round((kcal * 0.2) / 9);
  const c = Math.round((kcal - 4 * p - 9 * f) / 4);
  return {
    weightKg: w, lbmKg: Math.round(w * 0.85), bodyFatPct: 15, sex: 'male',
    goalKcal: 4 * p + 9 * f + 4 * c, goalProteinG: p, goalFatG: f, goalCarbsG: c,
    mealsCount: meals, isTrainingDay: false, trainStartMin: 18 * 60, trainDurationMin: 75,
    excludedIds: new Set<string>(), allergenTags: new Set<string>(),
    budget: 'medium', dayOffset: 0, cyclePhase: 'none',
    variety: 'medium', quality: 'full', randomSalt: 0, goal: mode,
    wakeTime: '08:00', bedTime: '23:00',
  } as any;
}

function devOf(totals: any, t: any): number {
  const d = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b) * 100;
  return Math.max(d(totals.kcal, t.kcal), d(totals.f, t.f), d(totals.c, t.c),
    Math.max(0, (t.p - totals.p) / Math.max(1, t.p) * 100));
}

const fmt = (x: any) => `${Math.round(x.kcal)}/${Math.round(x.p)}/${Math.round(x.f)}/${Math.round(x.c)}`;

const PROFILES: Array<[string, number, number]> = [
  ['70 cut/4', 70, 4],
  ['70 cut/5', 70, 5],
  ['100 mass/4', 100, 4],
  ['100 mass/5', 100, 5],
  ['110 mass/5', 110, 5],
  ['120 mass/5', 120, 5],
  ['130 mass/6', 130, 6],
  ['140 mass/6', 140, 6],
  ['160 mass/6', 160, 6],
];

describe('§8.95/§8.96: матрица 36 ячеек (9 профилей × трен/отдых × Б 1.8/2.4)', () => {
  it('ячеек за каноном: продуктовый ≤5, рецептурный ≤4; худшие ≤4% и ≤8%', { timeout: 900000 }, () => {
    const badProduct: string[] = [];
    const badRecipe: string[] = [];
    let worstP = 0, worstR = 0;
    for (const [label, w, meals] of PROFILES) {
      const mode: 'mass' | 'cut' = label.includes('cut') ? 'cut' : 'mass';
      for (const train of [true, false]) {
        for (const pPerKg of [1.8, 2.4]) {
          const base = profile(w, mode, meals, pPerKg);
          const input: MealPlanInput = { ...base, isTrainingDay: train, trainStartMin: train ? 18 * 60 : undefined } as any;
          const t = { kcal: input.goalKcal!, p: input.goalProteinG!, f: input.goalFatG!, c: input.goalCarbsG! };
          const day: any = buildDayPlan(input);
          const pt = sumDayTotals(day.meals as any);
          const res: any = assembleRecipeDay({
            meals: day.meals as PlanMealLike[], pool: getRecipes(), targets: t,
            excludedIds: new Set<string>(), maxPrepTimeMin: 120,
            usedNamesAcrossDays: new Set<string>(), goal: mode, athleteWeightKg: w,
          } as any);
          const rt = sumDayTotals(res.meals as any);
          const dp = devOf(pt, t), dr = devOf(rt, t);
          const tag = `${label}/${train ? 'трен' : 'отд'} P${pPerKg}`;
          if (dp > 3) { badProduct.push(`${tag} ${fmt(pt)} ${dp.toFixed(1)}% (цель ${fmt(t)})`); worstP = Math.max(worstP, dp); }
          if (dr > 3) { badRecipe.push(`${tag} ${fmt(rt)} ${dr.toFixed(1)}% (цель ${fmt(t)})`); worstR = Math.max(worstR, dr); }
        }
      }
    }
    expect(badProduct.length, `продуктовый контур за 3%:\n${badProduct.join('\n')}`).toBeLessThanOrEqual(5);
    expect(badRecipe.length, `рецептурный контур за 3%:\n${badRecipe.join('\n')}`).toBeLessThanOrEqual(4);
    expect(worstP, 'худшая продуктовая ячейка').toBeLessThanOrEqual(4);
    expect(worstR, 'худшая рецептурная ячейка').toBeLessThanOrEqual(8);
  });
});
