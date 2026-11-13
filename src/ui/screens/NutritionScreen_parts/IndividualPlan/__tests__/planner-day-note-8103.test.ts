import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

/** §8.91: канон дня — двусторонний по ккал/Ж/У + НЕДОБОР белка (белок — пол). */
const floorDev = (t: any, targets: any): number => {
  const d = (a: number, b: number) => (Math.abs(a - b) / Math.max(1, b)) * 100;
  const pUnder = Math.max(0, (targets.p || 0) - (t.p || 0)) / Math.max(1, targets.p || 1) * 100;
  return Math.max(d(t.kcal || 0, targets.kcal || 0), d(t.f || 0, targets.f || 0), d(t.c || 0, targets.c || 0), pUnder);
};

// ─── §8.103: нота «День сведён к цели» говорит ПРАВДУ о финале ─────────────────
//
// Дефект: нота считалась сразу после `closeRecipeDayToCanon`, а §§8.98 (перенос тарелки),
// §8.101 (овощ-носитель) и §8.102 (свап ядра) продолжали менять день. Ячейка
// `110 mass/5/трен P2.4` показывала «✓ День сведён к цели: 3%», хотя фактическое
// отклонение было 3.4% (жир 85 против 88).
//
// Теперь нота печатается по ФИНАЛЬНЫМ тоталам и обязана совпадать с `deviationPct`
// результата. Если закрыватель дошёл до канона, а раскладка увела день обратно —
// это отдельный видимый дефект («закрыватель дошёл до X%, но …»), а не тихое ✓.

function profile(w: number, mode: 'mass' | 'cut', meals: number, pPerKg: number, train: boolean): MealPlanInput {
  const kcal = Math.round(w * (mode === 'mass' ? 36 : 26));
  const p = Math.round(w * pPerKg);
  const f = Math.round((kcal * 0.2) / 9);
  const c = Math.round((kcal - 4 * p - 9 * f) / 4);
  return {
    weightKg: w,
    lbmKg: Math.round(w * 0.85),
    bodyFatPct: 15,
    sex: 'male',
    goalKcal: 4 * p + 9 * f + 4 * c,
    goalProteinG: p,
    goalFatG: f,
    goalCarbsG: c,
    mealsCount: meals,
    isTrainingDay: train,
    trainStartMin: train ? 18 * 60 : undefined,
    trainDurationMin: 75,
    excludedIds: new Set<string>(),
    allergenTags: new Set<string>(),
    budget: 'medium',
    dayOffset: 0,
    cyclePhase: 'none',
    variety: 'medium',
    quality: 'full',
    randomSalt: 0,
    goal: mode,
    wakeTime: '08:00',
    bedTime: '23:00',
  } as MealPlanInput;
}

const CASES: Array<[string, number, 'mass' | 'cut', number, number, boolean]> = [
  ['110 mass/5/трен P2.4 (было «✓ 3%» при факте 3.4%)', 110, 'mass', 5, 2.4, true],
  ['100 cut/4/трен P2.4', 100, 'cut', 4, 2.4, true],
  ['70 cut/5/отд P2.4', 70, 'cut', 5, 2.4, false],
];

for (const [label, w, mode, meals, pPerKg, train] of CASES) {
  describe(`§8.103: ${label}`, () => {
    it('нота о сведении совпадает с фактической девиацией', { timeout: 240000 }, () => {
      const input = profile(w, mode, meals, pPerKg, train);
      const targets = { kcal: input.goalKcal, p: input.goalProteinG, f: input.goalFatG, c: input.goalCarbsG };
      const day: any = buildDayPlan(input);
      const res: any = assembleRecipeDay({
        meals: day.meals as PlanMealLike[],
        pool: getRecipes(),
        targets,
        excludedIds: new Set<string>(),
        maxPrepTimeMin: 120,
        usedNamesAcrossDays: new Set<string>(),
        goal: mode,
        athleteWeightKg: w,
      } as any);

      const totals = sumDayTotals(res.meals as any);
      // 1. Честная девиация результата = девиация финальных тоталов.
      const honest = Math.round(floorDev(totals, targets) * 10) / 10;
      expect(res.deviationPct).toBeCloseTo(honest, 5);
      expect(res.withinTolerance).toBe(honest <= 3);

      // 2. Ровно одна нота о сведении и её число = этой девиации.
      const dayNotes = (res.notes as string[]).filter(n => /День (не )?сведён к цели/.test(n));
      expect(dayNotes.length, `ноты: ${dayNotes.join(' | ')}`).toBe(1);
      const num = dayNotes[0].match(/цели: (\d+(?:\.\d+)?)%/);
      expect(num, dayNotes[0]).toBeTruthy();
      expect(Number(num![1])).toBeCloseTo(honest, 5);

      // 3. Значок соответствует факту: ≤3% — ✓, иначе ⚠ (никаких «✓ 3%» при 3.4%).
      if (honest <= 3) expect(dayNotes[0].startsWith('✓')).toBe(true);
      else expect(dayNotes[0].startsWith('⚠')).toBe(true);
    });
  });
}
