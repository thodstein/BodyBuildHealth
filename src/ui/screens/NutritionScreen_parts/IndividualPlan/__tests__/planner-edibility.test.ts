/**
 * planner-edibility.test.ts — съедобность тарелки на экстремальных днях.
 *
 * Проверяет фактически: добивки не раздувают приём в гору —
 * ни булгур/батат по 400–500 г, ни дубли одного id, ни 800 г+ тарелки.
 * Плотные носители (рисовый крем/джем/цефир/сухая лапша) несут угли малым объёмом.
 */
import { describe, it, expect } from 'vitest';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { assembleRecipeDay } from '../planner-recipe-mode';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

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

const solidOf = (m: any): number =>
  (m.items || []).filter((i: any) => i.role !== 'liquid').reduce((s: number, i: any) => s + (i.amount || 0), 0);

const LOW_DENSITY = new Set(['sweet_potato', 'bulgur', 'potato_boiled', 'potato_baked']);
const DENSE = new Set(['cream_of_rice', 'jam', 'dates', 'pryaniki', 'zefir', 'rice_noodles', 'pasta_soba_raw', 'rice_white', 'rice_basmati', 'pasta_durum']);

function noDups(meals: any[], tag: string) {
  for (const m of meals) {
    const ids = (m.items || []).map((i: any) => i.id);
    expect(new Set(ids).size, `${tag}/${m.label}: дубли ${ids.join(',')}`).toBe(ids.length);
  }
}

describe('E-PLATE: products-1500У + инсулин — без гор батата', () => {
  const plan = buildDayPlan(base({
    weightKg: 120, lbmKg: 100, goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500,
    injections: [
      { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
      { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
      { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
    ] as any,
  }));

  it('тарелки ≤750 г твёрдого', () => {
    for (const m of plan.meals) {
      expect(solidOf(m), `${m.label} ${solidOf(m)} г`).toBeLessThanOrEqual(750);
    }
  });

  it('низкоплотные носители — не горы: каждый пункт ≤300 г, сумма батат+булгур ≤300 г', () => {
    let bulk = 0;
    for (const m of plan.meals) {
      for (const it of m.items || []) {
        if (LOW_DENSITY.has(it.id)) {
          expect(it.amount || 0, `${m.label}/${it.id}`).toBeLessThanOrEqual(300);
          if (it.id === 'sweet_potato' || it.id === 'bulgur') bulk += it.amount || 0;
        }
      }
    }
    expect(bulk, `батат+булгур за день: ${bulk} г`).toBeLessThanOrEqual(300);
  });

  it('плотные носители несут угли (крем/джем/цефир/сухая лапша есть в дне)', () => {
    const ids = new Set(plan.meals.flatMap(m => (m.items || []).map((i: any) => i.id)));
    expect([...DENSE].some(id => ids.has(id)), 'нет плотных носителей').toBe(true);
  });

  it('без дублей id в приёме', () => { noDups(plan.meals, '1500U'); });
});

describe('E-PLATE: products-500Б — белок распределён, тарелки целы', () => {
  const plan = buildDayPlan(base({ goalKcal: 6000, goalProteinG: 500, goalFatG: 120, goalCarbsG: 550 }));

  it('тарелки ≤750 г твёрдого, без дублей', () => {
    for (const m of plan.meals) {
      expect(solidOf(m), `${m.label} ${solidOf(m)} г`).toBeLessThanOrEqual(750);
    }
    noDups(plan.meals, '500P');
  });
});

describe('E-PLATE: products-800У — обычные горы отсутствуют', () => {
  const plan = buildDayPlan(base({}));

  it('тарелки ≤700 г, низкоплотный пункт ≤300 г, без дублей', () => {
    for (const m of plan.meals) {
      expect(solidOf(m), `${m.label} ${solidOf(m)} г`).toBeLessThanOrEqual(700);
      for (const it of m.items || []) {
        if (LOW_DENSITY.has(it.id)) expect(it.amount || 0, `${m.label}/${it.id}`).toBeLessThanOrEqual(300);
      }
    }
    noDups(plan.meals, '800U');
  });
});

describe('E-PLATE: recipe-1500У — сайды не раздувают авторские рецепты', () => {
  const src = buildDayPlan(base({
    weightKg: 120, lbmKg: 100, goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500,
    injections: [
      { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
      { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
      { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
    ] as any,
  }));
  const res = assembleRecipeDay({
    meals: (src.meals as any[]).map((m: any) => ({ ...m, items: (m.items || []).map((i: any) => ({ ...i })), totals: { ...m.totals } })) as any,
    pool: RECIPE_DB as any, targets: { kcal: 8600, p: 280, f: 120, c: 1500 },
    excludedIds: new Set<string>(), trainDay: true, athleteWeightKg: 120, seed: 3, goal: 'mass',
  });

  it('тарелки ≤950 г (рецептурные горы — авторские, не добивка), без дублей', () => {
    for (const m of res.meals) {
      expect(solidOf(m), `${m.label} ${solidOf(m)} г`).toBeLessThanOrEqual(950);
    }
    noDups(res.meals, 'recipe-1500U');
  });
});
