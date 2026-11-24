/**
 * planner-recipe-corrector-canon.test.ts — §8.135: канон пути в корректоре и в вердиктах
 * ручного рецептурного дня.
 *
 * Замок к регрессу: ручной рецептурный день на 2.3 % до правки молча считался зелёным
 * (`withinTolerance: true`, ни одной ноты) — его судили общим каноном 3 %, под который он не
 * собирался, а корректор вообще не запускался (`needCorr0 = rb.deviationPct > 3`) и день в
 * полосе 2.0–3.0 % оставался несведённым без попытки лечения. После правки порог предупреждения,
 * триггер и остановка корректора берутся из канона ПУТИ: ручной день либо сходится в ≤2 %
 * (`(≤2%)`), либо честно краснеет (`(>2%)`) — противоречивых вердиктов в ленте нет.
 * (Историю сверял по `git show HEAD:` — там `<= 3` / `(>3%)` в :2310, :3992, :4821, :4857, :4863.)
 *
 * Замер (85 кг / 3600 ккал / 200/95/490 / 10 приёмов, ручной, seed 3):
 *  - canonPct 2 (канон движка) → 3627/200.8/95.5/489.9 (0.75 %),
 *    «✓ Корректор дневных целей: 7.4% → 1.3% (≤2%)», «✓ День сведён к цели: 0.8%»;
 *  - canonPct 3 (общий) → 3628/198.3/97.2/488.9 (2.32 %),
 *    «✓ Корректор дневных целей: 7.4% → 2% (≤3%)», «✓ День сведён к цели: 2.3%»,
 *    предупреждения «(>2%)» НЕТ.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals } from '../planner-recipe-mode';
import { RECIPE_DB } from '../../../../../data/recipe-db';

const base = (over: any = {}): MealPlanInput =>
  ({
    weightKg: 120,
    lbmKg: 100,
    bodyFatPct: 16,
    sex: 'male' as const,
    goalKcal: 8900,
    goalProteinG: 500,
    goalFatG: 100,
    goalCarbsG: 1500,
    mealsCount: 10,
    isTrainingDay: false,
    budget: 'max' as const,
    dayOffset: 0,
    cyclePhase: 'course' as const,
    variety: 'max' as const,
    eveningLowCarb: false,
    quality: 'full' as const,
    randomSalt: 3,
    carbCapGPerKg: 0,
    recipeAssembly: true,
    wakeTime: '07:00',
    bedTime: '23:00',
    dinnerTime: '19:00',
    ...over,
  }) as any;

/** День движка + рецептурная сборка; `canonPct` — канон пути (без него — канон самого дня). */
const assemble = (inp: MealPlanInput, canonPct?: number) => {
  const src = buildDayPlan(inp);
  const meals = (src.meals as any[]).map((m: any) => ({
    ...m,
    items: (m.items || []).map((i: any) => ({ ...i })),
    totals: { ...m.totals },
  }));
  const canon = canonPct != null ? canonPct : Number((src as any).canonPct);
  return assembleRecipeDay({
    meals,
    pool: RECIPE_DB as any,
    targets: {
      kcal: (inp as any).goalKcal,
      p: (inp as any).goalProteinG,
      f: (inp as any).goalFatG,
      c: (inp as any).goalCarbsG,
    },
    excludedIds: new Set<string>(),
    trainDay: !!inp.isTrainingDay,
    athleteWeightKg: (inp as any).weightKg,
    seed: 3,
    goal: 'mass',
    sex: 'male',
    ...(Number.isFinite(canon) ? { canonPct: canon } : {}),
  } as any);
};

const devPct = (got: number, want: number) => (Math.abs(got - want) / want) * 100;
const floorDev = (t: any, tg: { kcal: number; p: number; f: number; c: number }) =>
  Math.max(devPct(t.kcal, tg.kcal), devPct(t.f, tg.f), devPct(t.c, tg.c), (Math.max(0, tg.p - t.p) / tg.p) * 100);

const TARGETS_3600 = { kcal: 3600, p: 200, f: 95, c: 490 };

const MANUAL_3600_85_10 = base({
  weightKg: 85,
  lbmKg: 70,
  goalKcal: 3600,
  goalProteinG: 200,
  goalFatG: 95,
  goalCarbsG: 490,
  mealsCount: 10,
  kbjuMode: 'manual',
  manualTargetsLocked: true,
});

describe('§8.135: корректор и вердикты по канону пути', () => {
  it('ручной день сводится до ≤2 % и не печатает противоречивых вердиктов', () => {
    const v2 = buildDayPlan(MANUAL_3600_85_10);
    expect(v2.canonPct).toBe(2);
    const res = assemble(MANUAL_3600_85_10, v2.canonPct);
    const t = sumDayTotals(res.meals as any);
    const d = floorDev(t, TARGETS_3600);
    const notes = res.notes as string[];
    const corr = notes.filter((n) => n.includes('✓ Корректор дневных целей'));
    // Замер: 3627/200.8/95.5/489.9 = 0.75 % ≤ 2 %, флаг зелёный.
    expect(d, `3627/200.8/95.5/489.9 = ${d.toFixed(2)}%`).toBeLessThanOrEqual(2);
    expect(res.withinTolerance).toBe(true);
    // Строка корректора называет канон ручного пути и финальную девиацию ≤2 %.
    expect(corr, `ноты: ${notes.join(' | ')}`).toHaveLength(1);
    expect(corr[0]).toContain('(≤2%)');
    const post = Number((corr[0].match(/→ ([\d.]+)%/) || [])[1]);
    expect(Number.isFinite(post), `строка корректора: ${corr[0]}`).toBe(true);
    expect(post, `корректор дошёл до ${post}%`).toBeLessThanOrEqual(2);
    // §8.135: (≤3%) рядом с (>2%) — это и был регресс; на ручном дне обоих нет.
    const hasLe3 = notes.some((n) => n.includes('(≤3%)'));
    const hasGt2 = notes.some((n) => n.includes('(>2%)'));
    expect(hasLe3 && hasGt2, `противоречие в нотах: ${notes.join(' | ')}`).toBe(false);
    // Корректор дошёл до ≤2 % → «не сведён» запрещён, «сведён» назван.
    expect(notes.filter((n) => n.includes('⚠ День не сведён к цели'))).toHaveLength(0);
    expect(notes.filter((n) => n.includes('✓ День сведён к цели'))).toHaveLength(1);
  });

  it('полоса 2.0–3.0 % под общим каноном 3 %: «(≤3%)» без «(>2%)»', () => {
    // Тот же день под общим каноном держится на 2.32 % — в полосе 2–3 %. Смысл замка:
    // строка корректора называет ТОТ канон, которым день судился (`_canonPct`), и при каноне
    // 3 % не появляется предупреждения `(>2%)`/`(>3%)`. До правки корректор останавливался на
    // жёстких 3 % и ручной день в этой полосе вообще не доходил до него — ноты `(≤3%)` не было.
    const res = assemble(MANUAL_3600_85_10, 3);
    const t = sumDayTotals(res.meals as any);
    const d = floorDev(t, TARGETS_3600);
    const notes = res.notes as string[];
    expect(d, `девиация ${d.toFixed(2)}%`).toBeGreaterThan(2);
    expect(d, `девиация ${d.toFixed(2)}%`).toBeLessThanOrEqual(3);
    expect(
      notes.some((n) => n.includes('(≤3%)')),
      `ноты: ${notes.join(' | ')}`,
    ).toBe(true);
    expect(notes.filter((n) => n.includes('(>2%)'))).toHaveLength(0);
    expect(notes.filter((n) => n.includes('(>3%)'))).toHaveLength(0);
    // День сведён в общий канон и не объявлен «не сведён».
    expect(notes.filter((n) => n.includes('✓ День сведён к цели'))).toHaveLength(1);
    expect(notes.filter((n) => n.includes('⚠ День не сведён к цели'))).toHaveLength(0);
  });
});
