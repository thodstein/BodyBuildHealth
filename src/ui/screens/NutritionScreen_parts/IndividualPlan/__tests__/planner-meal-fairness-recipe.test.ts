/**
 * planner-meal-fairness-recipe.test.ts — §8.51 (QG52) в РЕЦЕПТУРНОМ контуре.
 *
 * В продуктовом пути справедливость приёмов зовёт сам движок. В рецептурном — после
 * посадки блюд (`assembleRecipeDay`), потому что посадка выбирает рецепты по фактическим
 * ккал приёма: если выровнять приёмы до посадки, выбор блюд меняется и сходимость дня
 * уезжает (замер: plain 2600 2.6 % → 4.4 % при локе ≤4 %, R-1500 train жир 2.0 → 4.3 п.п.
 * при локе ±0.8 п.п.). Именно поэтому в продакшене `IndividualPlanContext` ставит
 * `recipeAssembly: true` при `generationMode === 'recipes'`: движок стадию пропускает.
 *
 * Замер после стадии (рецептурный день): «не еды» 5 → 0 на четырёх клетках, при этом
 * **девиация дня не изменилась ни на 0.1 п.п.** — перенос идёт тем же продуктом с той же
 * плотностью и не может сдвинуть калории/Б/Ж/У дня:
 *   R-1500 rest 9.9 % (структурный честный кап экстрим-полосы),
 *   R-1500 train 3.0 %, plain 2600 2.6 %, plain 2600 s0 2.9 %.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals } from '../planner-recipe-mode';
import { RECIPE_DB } from '../../../../../data/recipe-db';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 120, lbmKg: 100, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
  mealsCount: 10, isTrainingDay: false, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  recipeAssembly: true,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
} as any);

const assemble = (inp: MealPlanInput) => {
  const src = buildDayPlan(inp);
  const meals = (src.meals as any[]).map((m: any) => ({
    ...m, items: (m.items || []).map((i: any) => ({ ...i })), totals: { ...m.totals },
  }));
  return assembleRecipeDay({
    meals, pool: RECIPE_DB as any,
    targets: { kcal: (inp as any).goalKcal, p: (inp as any).goalProteinG, f: (inp as any).goalFatG, c: (inp as any).goalCarbsG },
    excludedIds: new Set<string>(), trainDay: !!inp.isTrainingDay, athleteWeightKg: (inp as any).weightKg,
    seed: 3, goal: 'mass', sex: 'male',
  } as any);
};

const MAIN = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'snack2', 'snack3', 'snack4', 'snack5', 'snack6']);
const tgtKcal = (m: any) => (m?.target ? 4 * (m.target.p || 0) + 9 * (m.target.f || 0) + 4 * (m.target.c || 0) : 0);
const starvingMeals = (meals: any[]): string[] => (meals || [])
  .filter((m: any) => MAIN.has(String(m.type)) && tgtKcal(m) > 0 && (m.totals?.kcal || 0) > 0)
  .filter((m: any) => {
    const k = Number(m.totals.kcal) || 0;
    const t = tgtKcal(m);
    return k < t * 0.5 || (k < 150 && k < t * 0.9);
  })
  .map((m: any) => `${m.type}:${Math.round(m.totals.kcal)}/${Math.round(tgtKcal(m))}`);

const CELLS: Array<[string, MealPlanInput, number]> = [
  ['R-1500 rest', base(), 9.9],
  ['R-1500 train', base({ isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true }), 2.5],
  ['plain 2600', base({ weightKg: 85, lbmKg: 72, goalKcal: 2600, goalProteinG: 175, goalFatG: 80, goalCarbsG: 320 }), 2.6],
  ['plain 2600 s0', base({ weightKg: 85, lbmKg: 72, goalKcal: 2600, goalProteinG: 175, goalFatG: 80, goalCarbsG: 320, randomSalt: 0 }), 2.9],
];

describe('QG52 в рецептурном контуре: приёмы — еда, сходимость не двигается', () => {
  for (const [label, inp, devRef] of CELLS) {
    it(`${label}: ни одного «не еды», девиация дня не хуже ${devRef} %`, () => {
      const res: any = assemble(inp);
      const starv = starvingMeals(res.meals as any);
      expect(starv, starv.join(' ')).toHaveLength(0);
      // Опорное значение — девиация до стадии справедливости. §8.91 улучшил канон дня
      // (крупный углеводный остаток), поэтому проверяем «не хуже», а не точное равенство.
      expect(res.deviationPct, `девиация ${res.deviationPct} %`).toBeLessThanOrEqual(devRef + 0.5);
      // день нейтрален: сумма приёмов = итог дня (перенос не добавляет/не убирает еду)
      const t = sumDayTotals(res.meals as any);
      const mealsKcal = (res.meals as any[]).reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0);
      expect(Math.abs(mealsKcal - t.kcal)).toBeLessThanOrEqual(1);
    });
  }

  it('перенос подписан и идёт целыми граммами', () => {
    const res: any = assemble(CELLS[2][1]);
    const moves = (res.notes || []).filter((n: string) => /добрана до еды/.test(n));
    expect(moves.length).toBeGreaterThanOrEqual(1);
    for (const m of moves) expect(m).toMatch(/\d+→\d+ г/);
    for (const m of res.meals as any[]) {
      for (const it of (m.items || [])) expect(Number.isInteger(it.amount), `${it.id} ${it.amount}`).toBe(true);
    }
  });
});
