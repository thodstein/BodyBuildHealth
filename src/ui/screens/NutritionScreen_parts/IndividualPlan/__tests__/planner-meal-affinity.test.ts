import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { afAllows, afFilterPool } from '../planner-meal-affinity';

// E1 (PRO-план §3): матрица «продукт × слот».
// Инварианты: завтрак-стейплы (овсянка/хлопья) — не в обед/ужине; субпродукты/
// бобовые — не в перекусе; неизвестное — разрешено (обратная совместимость).

const base = (over: Partial<MealPlanInput>): MealPlanInput => ({
  weightKg: 85, lbmKg: 70, bodyFatPct: 15, sex: 'male',
  goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max',
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00', quality: 'full',
  ...over,
} as MealPlanInput);

describe('E1: afAllows (матрица слотов)', () => {
  it('завтрак-стейплы запрещены в обед/ужине', () => {
    for (const id of ['oats_dry', 'oats', 'corn_flakes', 'muesli', 'granola', 'pancakes', 'oat_bran']) {
      expect(afAllows(id, 'lunch'), `${id} lunch`).toBe(false);
      expect(afAllows(id, 'dinner'), `${id} dinner`).toBe(false);
    }
  });
  it('завтрак-стейплы разрешены на завтрак; рис/картофель/паста — в обед/ужин', () => {
    expect(afAllows('oats_dry', 'breakfast')).toBe(true);
    for (const id of ['rice_white', 'potato_boiled', 'pasta', 'buckwheat']) {
      expect(afAllows(id, 'lunch'), id).toBe(true);
      expect(afAllows(id, 'dinner'), id).toBe(true);
    }
  });
  it('субпродукты/бобовые запрещены в перекусе', () => {
    for (const id of ['beef_liver', 'legume_navy_bean', 'lentils', 'chickpeas']) {
      expect(afAllows(id, 'snack'), id).toBe(false);
    }
  });
  it('неизвестный продукт — разрешён (обратная совместимость)', () => {
    expect(afAllows('some_new_food', 'lunch')).toBe(true);
    expect(afAllows(null, 'dinner')).toBe(true);
    expect(afAllows('', 'snack')).toBe(true);
  });
  it('afFilterPool: fallback на исходный пул, если фильтр всё выбил', () => {
    const pool = [{ id: 'oats_dry' }, { id: 'oat_bran' }];
    expect(afFilterPool(pool, 'lunch')).toEqual(pool); // всё выбито → исходный
    const mixed = [{ id: 'oats_dry' }, { id: 'rice_white' }];
    expect(afFilterPool(mixed, 'lunch').map(f => f.id)).toEqual(['rice_white']);
  });
});

describe('E1: продуктовый день — слотам соответствует', () => {
  it('обед/ужин без завтрак-стейплов; завтрак их может иметь', () => {
    for (let salt = 1; salt <= 4; salt++) {
      const p = buildDayPlan(base({ randomSalt: salt }));
      for (const m of p.meals) {
        if (m.type !== 'lunch' && m.type !== 'dinner') continue;
        for (const it of m.items) {
          if (it.role !== 'carb_slow' && it.role !== 'carb_fast') continue;
          expect(afAllows(it.id, m.type === 'lunch' ? 'lunch' : 'dinner'), `salt ${salt}: ${m.type} содержит завтрак-стейпл ${it.id}`).toBe(true);
        }
      }
    }
  });
  it('перекусы без субпродуктов и бобовых', () => {
    const p = buildDayPlan(base({ dayOffset: 2 }));
    for (const m of p.meals) {
      if (m.type !== 'snack' && m.type !== 'snack2' && m.type !== 'snack3' && m.type !== 'snack4') continue;
      for (const it of m.items) {
        expect(afAllows(it.id, 'snack'), `${m.type}: ${it.id} off-slot`).toBe(true);
      }
    }
  });
});
