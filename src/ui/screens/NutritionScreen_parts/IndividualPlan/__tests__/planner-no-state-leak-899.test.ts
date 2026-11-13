import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.99 (B13): независимость дня от порядка вызовов ───────────────────────
//
// Долг B13 гласил: модульный контекст подбора (`_pickCtx`) протекает между вызовами —
// «в одном тест-файле после recipe-вызовов продуктовые дни строятся в чужом контексте
// (70 cut/4 показывал 12.8% вместо 2.1%)», из-за чего матрицу канона держали отдельным
// файлом, а порог дотяжки P5b нельзя было поднять выше 92%.
//
// Замер 2026-11: утечки больше НЕТ — `buildDayPlan` сбрасывает контекст в `finally`
// (P0-4/A6). Проверка: один и тот же продуктовый день даёт одинаковые суммы до/после
// рецептурного дня 120 кг и после продуктового дня 160 кг; два рецептурных прогона
// одной ячейки совпадают бит-в-бит.
//
// Этот тест — замок: если контекст снова начнёт протекать, суммы разойдутся.
//
// Что НЕ удалось на этом основании (замерено, §8.99): порог дотяжки P5b 92% → 97%
// вытягивает продуктовую матрицу 5/36 → 1/36 ячеек за каноном, но ломает 8 инвариантов
// качества (орехи 66 г > 55, орехи 5 г < 15 г, Ca < 70%, доля жира из орехов 65–66%) —
// ломают не сами кандидаты дотяжки, а стадии, реагирующие на более «углеводный» день.
// По правилу владельца порог НЕ продавлен: остался 92%, инварианты целы.

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
const totalsOf = (meals: any[]) => {
  const t = sumDayTotals(meals as any);
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), f: Math.round(t.f), c: Math.round(t.c) };
};
function recipeDay(input: MealPlanInput) {
  return assembleRecipeDay({
    meals: buildDayPlan(input).meals as PlanMealLike[],
    pool: getRecipes(),
    targets: { kcal: input.goalKcal!, p: input.goalProteinG!, f: input.goalFatG!, c: input.goalCarbsG! },
    excludedIds: new Set<string>(), maxPrepTimeMin: 120,
    usedNamesAcrossDays: new Set<string>(), goal: input.goal as any,
    athleteWeightKg: input.weightKg,
  } as any);
}

describe('§8.99 (B13): день не зависит от порядка вызовов', () => {
  it('продуктовый день 70 cut/4/отд одинаков до и после чужих дней', { timeout: 900000 }, () => {
    const cell = () => profile(70, 'cut', 4, 1.8, false);
    const first = totalsOf(buildDayPlan(cell()).meals as any[]);

    // чужой рецептурный день 120 кг затирает контекст подбора, если он протекает
    recipeDay(profile(120, 'mass', 5, 2.4, true));
    const afterRecipe = totalsOf(buildDayPlan(cell()).meals as any[]);

    // чужой продуктовый день 160 кг
    buildDayPlan(profile(160, 'mass', 6, 2.4, false));
    const afterHeavy = totalsOf(buildDayPlan(cell()).meals as any[]);

    expect(afterRecipe).toEqual(first);
    expect(afterHeavy).toEqual(first);
  });

  it('рецептурный день 70 cut/4/отд повторяется бит-в-бит', { timeout: 900000 }, () => {
    const cell = () => profile(70, 'cut', 4, 1.8, false);
    const r1 = totalsOf(recipeDay(cell()).meals as any[]);
    const r2 = totalsOf(recipeDay(cell()).meals as any[]);
    expect(r2).toEqual(r1);
  });
});
