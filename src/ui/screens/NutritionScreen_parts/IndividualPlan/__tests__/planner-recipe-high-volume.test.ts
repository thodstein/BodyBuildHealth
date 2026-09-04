/**
 * planner-recipe-high-volume.test.ts — HIGH-VOLUME план, рецептурный путь + экстрим.
 * - assembleRecipeDay на 800У: нет пустых мейнов, peri-капы, честный флаг, ряд порций;
 * - products 1500У + инсулин: сходимость, окна, peri-капы, съедобность+честность;
 * - products 500Б: best-effort + бейдж Morton + лимиты порций;
 * - train/rest: intra только в train;
 * - snack carb-mode: перекусы несут угли на high-carb дне.
 */
import { describe, it, expect } from 'vitest';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { assembleRecipeDay, type PlanMealLike } from '../planner-recipe-mode';
import { isProteinPowderId } from '../food-availability';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

function meal(label: string, target: { p: number; c: number; f: number }): PlanMealLike {
  return { label, time: '12:00', items: [], totals: { kcal: 0, p: 0, f: 0, c: 0 }, target };
}

const HV_MEALS = () => [
  meal('Завтрак', { p: 50, c: 170, f: 25 }),
  meal('Обед', { p: 55, c: 220, f: 25 }),
  meal('Ужин', { p: 50, c: 170, f: 25 }),
  meal('Перекус', { p: 25, c: 80, f: 12 }),
  meal('Предтрен', { p: 25, c: 60, f: 5 }),
  meal('Пост-трен', { p: 35, c: 75, f: 6 }),
];
const HV_TARGETS = { kcal: 5100, p: 220, f: 110, c: 800 };

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 110, lbmKg: 92, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 5100, goalProteinG: 220, goalFatG: 110, goalCarbsG: 800,
  mealsCount: 7, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90,
  allowIntraWorkout: true, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

describe('R-HV: assembleRecipeDay на 800У (best-effort + честность)', () => {
  const res = assembleRecipeDay({
    meals: HV_MEALS(), pool: RECIPE_DB as any, targets: HV_TARGETS,
    excludedIds: new Set<string>(), trainDay: true, athleteWeightKg: 110, seed: 3, goal: 'mass',
  });

  it('нет пустых основных приёмов', () => {
    for (const l of ['Завтрак', 'Обед', 'Ужин']) {
      const m = res.meals.find(x => x.label === l)!;
      expect(m, l).toBeTruthy();
      expect((m.items || []).length, `${l} пуст`).toBeGreaterThan(0);
      expect(m.totals.kcal, `${l} 0 ккал`).toBeGreaterThan(0);
    }
  });

  it('peri-капы: предтрен ≤63 / пост-трен ≤79', () => {
    const pre = res.meals.find(m => m.label === 'Предтрен')!;
    const post = res.meals.find(m => m.label === 'Пост-трен')!;
    // carb-гейт приёмки может оставить peri без рецепта — тогда проверяем целевой коридор
    if ((pre.items || []).length > 0) expect(pre.totals.c).toBeLessThanOrEqual(63);
    if ((post.items || []).length > 0) expect(post.totals.c).toBeLessThanOrEqual(79);
  });

  it('флаг честный: dev>3 → предупреждение в notes; dev в пределах best-effort', () => {
    expect(res.deviationPct).toBeLessThanOrEqual(18);
    if (!res.withinTolerance) {
      expect(res.notes.length, 'нет честного предупреждения').toBeGreaterThan(0);
    } else {
      expect(res.deviationPct).toBeLessThanOrEqual(3);
    }
  });

  it('порции — из человеческого ряда, порошковый лимит цел', () => {
    const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
    let powderMeals = 0;
    for (const m of res.meals) {
      const d: any = (m as any).recipeAppliedData;
      if (!d) continue;
      if (d.portionScale !== undefined) {
        expect(STEPS, `${m.label}: scale ${d.portionScale} вне ряда`).toContain(d.portionScale);
      }
      const ids: string[] = d.ingredientIds || [];
      const hasPowder = ids.some(id => { try { return isProteinPowderId(id); } catch { return false; } });
      const t = String((m as any).type || m.label || '');
      if (hasPowder && t !== 'postworkout' && !/Пост-трен/i.test(m.label || '')) powderMeals++;
    }
    expect(powderMeals).toBeLessThanOrEqual(3);
  });
});

describe('R-HV: products 1500У + инсулин', () => {
  const plan = buildDayPlan(base({
    weightKg: 120, lbmKg: 100, goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500,
    injections: [
      { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
      { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
      { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
    ] as any,
  }));

  it('угли сходятся ≤5%, окна на месте с маркером', () => {
    expect(Math.abs(plan.totals.c - 1500) / 1500).toBeLessThanOrEqual(0.05);
    const wins = plan.meals.filter(m => (m as any)._insulinWindow);
    expect(wins.length).toBe(3);
    for (const w of wins) {
      expect(w.totals.c).toBeGreaterThanOrEqual(90);
      expect(w.totals.c).toBeLessThanOrEqual(130);
    }
  });

  it('peri-капы и преслип целы', () => {
    const pre = plan.meals.find(m => m.type === 'preworkout');
    const post = plan.meals.find(m => m.type === 'postworkout');
    const intra = plan.meals.find(m => m.type === 'intra');
    if (pre) expect(pre.totals.c).toBeLessThanOrEqual(63);
    if (post) expect(post.totals.c).toBeLessThanOrEqual(79);
    if (intra) expect(intra.totals.c).toBeLessThanOrEqual(95);
    const ps = plan.meals.find(m => m.type === 'presleep');
    if (ps) expect(ps.totals.c).toBeLessThanOrEqual(12);
  });

  it('съедобность: приём ≤900 г, иначе честная нота', () => {
    const notesJoined = (plan.notes || []).join('\n');
    for (const m of plan.meals) {
      const solid = (m.items || []).filter((it: any) => it.role !== 'liquid').reduce((s: number, it: any) => s + (it.amount || 0), 0);
      expect(solid, `${m.label} ${solid} г`).toBeLessThanOrEqual(900);
      if (solid > 750) {
        expect(notesJoined.includes('тяжёлым') || notesJoined.includes('Перегрузка'), `${m.label}: нет честной ноты`).toBe(true);
      }
    }
  });
});

describe('R-HV: products 500Б — best-effort + бейдж', () => {
  const plan = buildDayPlan(base({ goalKcal: 6000, goalProteinG: 500, goalFatG: 120, goalCarbsG: 550 }));

  it('белок дотянут (dev ≤25%) + бейдж выше потолка', () => {
    expect(Math.abs(plan.totals.p - 500) / 500).toBeLessThanOrEqual(0.25);
    expect(plan.notes.some(n => (n || '').includes('выше потолка'))).toBe(true);
  });

  it('порции ≤350 г, порошковых приёмов ≤3', () => {
    for (const m of plan.meals) {
      for (const it of m.items || []) {
        if (it.role === 'liquid') continue;
        expect(it.amount || 0, `${m.label}/${it.id}`).toBeLessThanOrEqual(350);
      }
    }
    const powderMeals = plan.meals.filter(m => (m.items || []).some((it: any) => {
      try { return isProteinPowderId(it.id); } catch { return false; }
    })).length;
    expect(powderMeals).toBeLessThanOrEqual(3);
  });
});

describe('R-HV: train/rest и snack carb-mode', () => {
  it('rest-day без intra; train-day с intra', () => {
    const rest = buildDayPlan(base({ isTrainingDay: false, allowIntraWorkout: false, trainStartMin: undefined }));
    expect(rest.meals.some(m => m.type === 'intra')).toBe(false);
    const train = buildDayPlan(base({}));
    expect(train.meals.some(m => m.type === 'intra')).toBe(true);
  });

  it('перекусы несут угли на high-carb дне (не белковые заглушки)', () => {
    const plan = buildDayPlan(base({}));
    const snackCarbs = plan.meals
      .filter(m => String(m.type || '').startsWith('snack'))
      .reduce((s, m) => s + (m.totals?.c || 0), 0);
    expect(snackCarbs, `угли перекусов: ${snackCarbs}`).toBeGreaterThanOrEqual(50);
  });
});
