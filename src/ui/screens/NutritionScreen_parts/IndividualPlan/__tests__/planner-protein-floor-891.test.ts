/**
 * §8.91 (решение владельца «а»): белок — ПОЛ, а не потолок.
 *
 * Симптом из приложения: живой день 70 кг 2524/112/56/393 в рецептурном контуре уходил
 * 2349/129/55/333 (У −15.3%, ккал −6.9%) — «последняя миля» добирала только 12–40 г У,
 * а приёмка добора была двусторонней по белку, поэтому перебор Б от ядер рецептов запирал
 * углеводный добор. В продуктовом контуре тот же день сходился (0.4%).
 *
 * Замки:
 * 1) продуктовый контур держит все 4 оси (чтобы правка рецептов не задела его);
 * 2) рецептурный контур: ккал/Ж/У ≤3%, белок не ниже цели (пол) — крупный остаток У
 *    добирается плотным носителем;
 * 3) перебор белка ВИДЕН: нота «белок — пол» + effectiveProteinTargetG;
 * 4) карточка дня не объявляет провал, если вне канона только белок-пол.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';
import { explainDayPlan } from '../planner-day-explain';

const TARGETS = { kcal: 2524, p: 112, f: 56, c: 393 };

const LIVE: MealPlanInput = {
  weightKg: 70, lbmKg: 59, bodyFatPct: 15, sex: 'male',
  goalKcal: TARGETS.kcal, goalProteinG: TARGETS.p, goalFatG: TARGETS.f, goalCarbsG: TARGETS.c,
  mealsCount: 5, isTrainingDay: false, trainStartMin: 18 * 60, trainDurationMin: 75,
  excludedIds: new Set<string>(), allergenTags: new Set<string>(),
  budget: 'medium' as const, dayOffset: 0, cyclePhase: 'none' as const,
  variety: 'medium' as const, quality: 'full' as const, randomSalt: 0,
  wakeTime: '08:00', bedTime: '23:00',
} as any;

const pct = (fact: number, goal: number) => Math.abs(fact - goal) / Math.max(1, goal) * 100;

describe('§8.91: белок — пол, день сводится по ккал/Ж/У', () => {
  it('продуктовый контур держит живой кейс по всем 4 осям', { timeout: 120000 }, () => {
    const day: any = buildDayPlan(LIVE);
    const t: any = day.totals;
    expect(pct(t.kcal, TARGETS.kcal), `ккал ${t.kcal}`).toBeLessThanOrEqual(3);
    expect(pct(t.p, TARGETS.p), `Б ${t.p}`).toBeLessThanOrEqual(3);
    expect(pct(t.f, TARGETS.f), `Ж ${t.f}`).toBeLessThanOrEqual(3);
    expect(pct(t.c, TARGETS.c), `У ${t.c}`).toBeLessThanOrEqual(3);
    expect(day.withinTolerance).toBe(true);
  });

  it('рецептурный контур: ккал/Ж/У ≤3%, белок не ниже цели (пол)', { timeout: 120000 }, () => {
    const day: any = buildDayPlan(LIVE);
    const res: any = assembleRecipeDay({
      meals: day.meals as PlanMealLike[], pool: getRecipes(), targets: TARGETS,
      excludedIds: new Set<string>(), maxPrepTimeMin: 120,
      usedNamesAcrossDays: new Set<string>(), goal: 'mass',
    } as any);
    const t = sumDayTotals(res.meals as any);
    // До §8.91 здесь было 2349/129/55/333 (15.4% по двустороннему канону, У −15.3%).
    expect(pct(t.kcal, TARGETS.kcal), `ккал ${t.kcal}`).toBeLessThanOrEqual(3);
    expect(pct(t.f, TARGETS.f), `Ж ${t.f}`).toBeLessThanOrEqual(3);
    expect(pct(t.c, TARGETS.c), `У ${t.c}`).toBeLessThanOrEqual(3);
    expect(t.p).toBeGreaterThanOrEqual(TARGETS.p - 1);
    expect(res.withinTolerance).toBe(true);
    expect(res.deviationPct).toBeLessThanOrEqual(3);
  });

  it('перебор белка ВИДЕН: нота «белок — пол» и эффективная цель', { timeout: 120000 }, () => {
    const day: any = buildDayPlan(LIVE);
    const res: any = assembleRecipeDay({
      meals: day.meals as PlanMealLike[], pool: getRecipes(), targets: TARGETS,
      excludedIds: new Set<string>(), maxPrepTimeMin: 120,
      usedNamesAcrossDays: new Set<string>(), goal: 'mass',
    } as any);
    const t = sumDayTotals(res.meals as any);
    if (t.p > TARGETS.p * 1.05) {
      const note = (res.notes as string[]).find(n => /белок — пол/.test(n));
      expect(note, (res.notes as string[]).join(' | ')).toBeTruthy();
      expect(note).toMatch(new RegExp(`${TARGETS.p} г`));
      expect(res.effectiveProteinTargetG).toBeGreaterThan(TARGETS.p);
      expect(res.deviationToEffectivePct).toBeLessThanOrEqual(3);
    }
  });

  it('добор крупного остатка У — целыми граммами и реальным носителем', { timeout: 120000 }, () => {
    const day: any = buildDayPlan(LIVE);
    const res: any = assembleRecipeDay({
      meals: day.meals as PlanMealLike[], pool: getRecipes(), targets: TARGETS,
      excludedIds: new Set<string>(), maxPrepTimeMin: 120,
      usedNamesAcrossDays: new Set<string>(), goal: 'mass',
    } as any);
    const grab: any[] = (res.meals as any[]).flatMap((m: any) => m.items || []);
    for (const it of grab) expect(Number.isInteger(it.amount), `${it.id} ${it.amount}`).toBe(true);
    const addNote = (res.notes as string[]).find(n => /Крупный остаток углеводов дня/.test(n));
    if (addNote) expect(addNote).toMatch(/(Рис|Булгур|Картоф)\D+ \d+ г/);
  });

  it('карточка: вне канона только белок-пол → день сошёлся, ось Б помечена «пол»', () => {
    const ex = explainDayPlan({
      totals: { kcal: 2575, p: 134, f: 56, c: 383 } as any, notes: [],
    } as any, TARGETS as any);
    expect(ex.within).toBe(true);
    const pAxis = ex.axes.find(a => a.key === 'p')!;
    expect(pAxis.floor).toBe(true);
    expect(pAxis.diff).toBeGreaterThan(0);
    expect(ex.axes.filter(a => a.floor).map(a => a.key)).toEqual(['p']);
  });
});
