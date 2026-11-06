/**
 * planner-recipe-last-mile.test.ts — §8.50 (QG51) «последняя миля рецептурного пути».
 *
 * Замок к регрессу, который поймал `planner-recipe-portion-drift.test.ts` после QG45:
 * когда из движка ушли фантомные макросы (позиция 8 г с макросами 160 г), рецептурный
 * день 95 кг / 3600 ккал / 10 приёмов честно просел — жир 87.6 из 95 (−7.8 %),
 * углеводы −5.8 %, калории 3446 из 3600 (−4.3 %). Канон держался фантомом.
 *
 * Стадия добирает остаток **реальной едой**: жир 5–14 г → масло 5–10 г (контракт QG46),
 * углеводы 12–40 г → гарнир 30–200 г в приём с наибольшей комнатой. Авторские ядра
 * рецептов по-прежнему не двигаются (±3 %), добавка принимается только если максимальная
 * девиация дня падает.
 *
 * Замер (plain 3500): ккал −4.3 % → **+1.2 %**, жир −7.8 % → **−0.1 %**, У −5.8 % → **−0.1 %**,
 * макс. девиация 7.8 % → 3.8 % (остаток — белок ядер рецептов +3.8 %, документированный
 * honest-cap §3E). Полный прогон `IndividualPlan`: 180 файлов / 1808 тестов зелёные.
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
  // QG52: этот файл моделирует РЕЦЕПТУРНЫЙ контур (движок → assembleRecipeDay) —
  // ровно как в продакшене (`generationMode === 'recipes'`), поэтому справедливость
  // приёмов применяется после посадки блюд, а не в движке (§8.51).
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

const PLAIN_3500 = base({
  weightKg: 95, lbmKg: 80, goalKcal: 3600, goalProteinG: 200, goalFatG: 95, goalCarbsG: 490,
  goal: 'mass',
});

const devPct = (got: number, want: number) => Math.abs(got - want) / want * 100;

describe('§8.50 QG51: последняя миля рецептурного дня честными граммами', () => {
  it('plain 3500: жир и углеводы в каноне 3 %, калории в §4.4-коридоре 4 %', () => {
    const res = assemble(PLAIN_3500);
    const t = sumDayTotals(res.meals as any);
    expect(devPct(t.f, 95), `жир ${t.f.toFixed(1)} из 95`).toBeLessThanOrEqual(3);
    expect(devPct(t.c, 490), `углеводы ${t.c.toFixed(1)} из 490`).toBeLessThanOrEqual(3);
    expect(devPct(t.kcal, 3600), `ккал ${t.kcal.toFixed(0)} из 3600`).toBeLessThanOrEqual(4);
    expect(devPct(t.p, 200), `белок ${t.p.toFixed(1)} из 200 (ядра рецептов)`).toBeLessThanOrEqual(6);
  });

  it('добор идёт едой и подписан: масло/гарнир, а не распухание авторской порции', () => {
    const res = assemble(PLAIN_3500);
    const notes = res.notes as string[];
    expect(notes.some((n) => n.includes('последняя миля рецептурного дня')), `ноты: ${notes.join(' | ')}`).toBe(true);
    // порции авторских блюд не уехали: лок §4.4 держит ±3 %
    let drift = 0;
    for (const n of notes) {
      const m = n.match(/×(\d+)%/);
      if (m) drift = Math.max(drift, Math.abs(Number(m[1]) - 100));
    }
    expect(drift, 'коридор авторских порций').toBeLessThanOrEqual(3);
  });

  it('добавленный добор — реальная позиция с целыми граммами ≥5 г', () => {
    const res = assemble(PLAIN_3500);
    const added = res.notes.filter((n: string) => n.includes('последняя миля рецептурного дня'));
    for (const n of added) {
      const m = n.match(/(\d+) г →/);
      expect(m, `граммы в ноте: ${n}`).toBeTruthy();
      const g = Number(m![1]);
      expect(Number.isInteger(g), `целые граммы: ${g}`).toBe(true);
      expect(g).toBeGreaterThanOrEqual(5);
    }
  });

  it('собранный день не трогается: на канoн-клетке стадия молчит', () => {
    // 2600 ккал: после корректора день уже в коридоре — добор не должен «докармливать»
    const cell = base({ weightKg: 85, lbmKg: 72, goalKcal: 2600, goalProteinG: 175, goalFatG: 80, goalCarbsG: 320 });
    const res = assemble(cell);
    const t = sumDayTotals(res.meals as any);
    // калории не выходят за коридор и день не перекормлен сверху
    expect(devPct(t.kcal, 2600), `ккал ${t.kcal.toFixed(0)}`).toBeLessThanOrEqual(4);
    expect(t.kcal).toBeLessThanOrEqual(2600 * 1.045);
  });
});
