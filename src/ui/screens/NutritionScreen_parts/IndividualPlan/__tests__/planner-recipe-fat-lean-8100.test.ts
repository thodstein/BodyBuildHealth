import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.100 (B15): отбор рецептов по жировой плотности на cut-днях ────────────
//
// Дефект (доказан замером): в cut-ячейках жир сидит ВНУТРИ ядер рецептов (сыр/сметана/
// семечки), а ядра резать нельзя (§3E). При этом приём собран из рецепта ЦЕЛИКОМ —
// `coreIdsOf` возвращает все его пункты, редактируемых сайдов нет, поэтому
// `closeRecipeDayToCanon` возвращает пустой список правок и день замирает:
//   70 кг cut/4/трен P1.8 → 1813/126/43/230 при цели 1820/126/40/239 (жир +7.8%).
//
// Правка: в `rankCands` на днях с тесным жировым бюджетом (`targets.f / weightKg ≤ 0.7`)
// к дистанции кандидата добавляется мягкий штраф за долю калорий из жира выше доли приёма
// (граница ±0.06…0.12 к типичной дистанции 0.05–0.3). Это ПЕРЕСТАНОВКА близких вариантов:
// посадка по ккал/Б/У не меняется, меняется выбор рецепта.
//
// Замер (36 ячеек, свежий модуль на файл): ячеек за каноном 4 → 3, худшая 7.8% → 6.5%,
// ни одна ячейка не ухудшилась; 70 cut/4/трен P1.8 — 7.8% → 2.7%.
//
// ОТКЛОНЕНО по правилу «не продавливать»: белковый аналог отбора (для целей ≥2.2 г/кг) —
// на 120 кг cut/5/трен он давал 3401/317/68/380 (12.7%): ядра уходили в «обезжиренные»
// углеводные блюда, а закрыватель их не отыгрывает (ядра неприкосновенны).

function profile(w: number, mode: 'mass' | 'cut', meals: number, pPerKg: number, train: boolean): MealPlanInput {
  const kcal = Math.round(w * (mode === 'mass' ? 36 : 26));
  const p = Math.round(w * pPerKg);
  const f = Math.round((kcal * 0.2) / 9);
  const c = Math.round((kcal - 4 * p - 9 * f) / 4);
  return {
    weightKg: w, lbmKg: Math.round(w * 0.85), bodyFatPct: 15, sex: 'male',
    goalKcal: 4 * p + 9 * f + 4 * c, goalProteinG: p, goalFatG: f, goalCarbsG: c,
    mealsCount: meals, isTrainingDay: train, trainStartMin: train ? 18 * 60 : undefined,
    trainDurationMin: 75, excludedIds: new Set<string>(), allergenTags: new Set<string>(),
    budget: 'medium', dayOffset: 0, cyclePhase: 'none',
    variety: 'medium', quality: 'full', randomSalt: 0, goal: mode,
    wakeTime: '08:00', bedTime: '23:00',
  } as any;
}

function recipeDay(w: number, mode: 'mass' | 'cut', meals: number, pPerKg: number, train: boolean) {
  const input = profile(w, mode, meals, pPerKg, train);
  const t = { kcal: input.goalKcal!, p: input.goalProteinG!, f: input.goalFatG!, c: input.goalCarbsG! };
  const day: any = buildDayPlan(input);
  const res: any = assembleRecipeDay({
    meals: day.meals as PlanMealLike[], pool: getRecipes(), targets: t,
    excludedIds: new Set<string>(), maxPrepTimeMin: 120,
    usedNamesAcrossDays: new Set<string>(), goal: mode, athleteWeightKg: w,
  } as any);
  const tt = sumDayTotals(res.meals as any);
  const d = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b) * 100;
  const dev = Math.max(
    d(tt.kcal, t.kcal), d(tt.f, t.f), d(tt.c, t.c),
    Math.max(0, (t.p - tt.p) / Math.max(1, t.p) * 100),
  );
  return { dev, fatRel: ((tt.f - t.f) / Math.max(1, t.f)) * 100, totals: tt, targets: t };
}

const fmt = (t: any) => `${Math.round(t.kcal)}/${Math.round(t.p)}/${Math.round(t.f)}/${Math.round(t.c)}`;

describe('§8.100 (B15): отбор рецептов по жировой плотности', () => {
  it('70 кг cut/4/трен P1.8 — в каноне 3% (было 7.8% по жиру)', { timeout: 900000 }, () => {
    const r = recipeDay(70, 'cut', 4, 1.8, true);
    expect(r.dev, fmt(r.totals)).toBeLessThanOrEqual(3);
    // Жир больше не «уезжает» относительно цели дня.
    expect(Math.abs(r.fatRel), fmt(r.totals)).toBeLessThanOrEqual(3);
  });

  it('120 кг cut/5/трен не тянет ядра в «обезжиренные» углеводы (отклонённый вариант)', { timeout: 900000 }, () => {
    const r = recipeDay(120, 'cut', 5, 2.4, true);
    expect(r.dev, fmt(r.totals)).toBeLessThanOrEqual(3.2);
    // Замок против возврата белкового отбора: он давал 12.7% при 3401/317/68/380.
    expect(Math.abs(r.dev - 12.7), fmt(r.totals)).toBeGreaterThan(1);
  });

  it('mass-день не задет (жир не тесный: 112/140 = 0.8 > 0.7)', { timeout: 900000 }, () => {
    const r = recipeDay(140, 'mass', 6, 1.8, true);
    expect(r.dev, fmt(r.totals)).toBeLessThanOrEqual(3.6);
  });
});
