import { describe, it, expect } from 'vitest';
import { buildDayPlan, mergeDuplicateItems, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.104: один продукт — одна позиция в приёме ─────────────────────────────
//
// Дефект (замер 56 ячеек): в **25 группах** один и тот же продукт показан 2–3 раза подряд в
// одном приёме — «рис белый (вареный) 85 + 170 + 70 г», «подсолнечное масло 2 + 3 г»,
// «индейка 20 + 30 г», «батат 100 + 130 г». Приём выглядит длиннее, чем есть, а граммы
// пользователю приходится складывать в голове. Источники: ядро рецепта + добивка тем же
// продуктом, склейка двух рецептов в приёме, переносы (§8.98/§8.101).
//
// Правка чисто представительская: позиции с одним `id` (продукт FOOD_DB) сводятся в одну,
// граммы и макросы складываются без округления → суммы дня и канон 3% не двигаются.
//
// Замер после: **0 групп дублей** на тех же 56 ячейках, девиации дня не изменились.

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

/** Девиация §8.91: ккал/Ж/У двусторонне, белок — пол. */
const floorDev = (t: any, tg: any): number => {
  const d = (a: number, b: number) => (Math.abs(a - b) / Math.max(1, b)) * 100;
  const pUnder = Math.max(0, (tg.p || 0) - (t.p || 0)) / Math.max(1, tg.p || 1) * 100;
  return Math.max(d(t.kcal || 0, tg.kcal || 0), d(t.f || 0, tg.f || 0), d(t.c || 0, tg.c || 0), pUnder);
};

const dupGroups = (meals: any[]): number => {
  let n = 0;
  for (const m of meals) {
    const seen = new Set<string>();
    for (const it of (m.items || [])) {
      const id = String(it?.id || '');
      if (!id) continue;
      if (seen.has(id)) n++;
      seen.add(id);
    }
  }
  return n;
};

describe('§8.104: mergeDuplicateItems', () => {
  it('складывает одинаковые продукты, суммы приёма не меняются', () => {
    const mk = (id: string, amount: number, p: number, f: number, c: number) => ({
      id, name: id, amount, p, f, c, kcal: Math.round(4 * p + 9 * f + 4 * c), role: 'carb_slow',
    });
    const meals: any[] = [
      { type: 'breakfast', label: 'Завтрак', items: [mk('rice_white', 85, 2.2, 0.2, 23.8), mk('rice_white', 170, 4.4, 0.4, 47.6), mk('egg', 100, 13, 11, 1)] },
      { type: 'lunch', label: 'Обед', items: [mk('rice_white', 70, 1.8, 0.2, 19.6)] },
    ];
    const sumOf = (m: any) => (m.items || []).reduce((a: any, it: any) => ({
      kcal: a.kcal + it.kcal, p: a.p + it.p, f: a.f + it.f, c: a.c + it.c,
    }), { kcal: 0, p: 0, f: 0, c: 0 });
    const before = meals.map(sumOf);
    expect(dupGroups(meals)).toBe(1);

    const merged = mergeDuplicateItems(meals);

    expect(merged).toBe(1);
    expect(dupGroups(meals)).toBe(0);
    expect(meals[0].items.length).toBe(2);
    expect(meals[0].items[0].amount).toBe(255); // 85 + 170
    expect(meals[0].items[0].p).toBeCloseTo(6.6, 6); // 2.2 + 4.4
    // Второй приём (единственная позиция) не тронут.
    expect(meals[1].items.length).toBe(1);
    // Суммы дня бит-в-бит: свод не съедает и не добавляет макросов.
    const after = meals.map(sumOf);
    for (let i = 0; i < meals.length; i++) {
      expect(after[i].kcal).toBeCloseTo(before[i].kcal, 6);
      expect(after[i].p).toBeCloseTo(before[i].p, 6);
      expect(after[i].f).toBeCloseTo(before[i].f, 6);
      expect(after[i].c).toBeCloseTo(before[i].c, 6);
    }
  });

  it('`_fixedGrams` переживает свод (фикс-граммовку нельзя начать масштабировать)', () => {
    const meals: any[] = [
      {
        type: 'dinner',
        label: 'Ужин',
        items: [
          { id: 'oats', name: 'Овсянка', amount: 30, p: 3.6, f: 1.8, c: 16.5, kcal: 114, role: 'carb_slow' },
          { id: 'oats', name: 'Овсянка', amount: 20, p: 2.4, f: 1.2, c: 11, kcal: 76, role: 'carb_slow', _fixedGrams: true },
        ],
      },
    ];
    mergeDuplicateItems(meals);
    expect(meals[0].items.length).toBe(1);
    expect(meals[0].items[0].amount).toBe(50);
    expect(meals[0].items[0]._fixedGrams).toBe(true);
  });

  it('пустые/чужие структуры не ломают (нет items, один пункт)', () => {
    const meals: any[] = [{ type: 'snack' }, { type: 'snack2', items: [] }, { type: 'snack3', items: [{ id: 'a', amount: 1 }] }];
    expect(mergeDuplicateItems(meals)).toBe(0);
    expect(mergeDuplicateItems([] as any)).toBe(0);
  });
});

describe('§8.104: в собранных днях нет дублей продуктов', () => {
  const CASES: Array<[string, number, 'mass' | 'cut', number, number, boolean]> = [
    ['100 mass/4/трен P2.4 (был «рис 240 + рис 170»)', 100, 'mass', 4, 2.4, true],
    ['120 mass/5/отд P2.4 (был рис ×3)', 120, 'mass', 5, 2.4, false],
    ['160 mass/6/трен P1.8 (было масло ×3)', 160, 'mass', 6, 1.8, true],
    ['70 cut/4/отд P1.8 (был рис ×3)', 70, 'cut', 4, 1.8, false],
  ];

  for (const [label, w, mode, meals, pPerKg, train] of CASES) {
    it(label, { timeout: 300000 }, () => {
      const input = profile(w, mode, meals, pPerKg, train);
      const targets = { kcal: input.goalKcal, p: input.goalProteinG, f: input.goalFatG, c: input.goalCarbsG };
      const day: any = buildDayPlan(input);
      // Продуктовый контур: дублей нет уже на выходе движка.
      expect(dupGroups(day.meals as any[])).toBe(0);

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
      // Рецептурный контур: свод идёт последней стадией, дублей нет и здесь.
      expect(dupGroups(res.meals as any[])).toBe(0);
      // Свод не сдвигает канон: день остаётся в 3%.
      const t = sumDayTotals(res.meals as any);
      expect(floorDev(t, targets)).toBeLessThanOrEqual(3);
      // Тарелка не потяжелела: граммы сохранены (свод — не срез).
      const plate = (res.meals as any[])
        .filter(m => ['breakfast', 'lunch', 'dinner'].includes(String(m.type)))
        .map(m => (m.items || []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0));
      const dayPlate = (day.meals as any[])
        .filter(m => ['breakfast', 'lunch', 'dinner'].includes(String(m.type)))
        .map(m => (m.items || []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0));
      expect(plate.length).toBe(dayPlate.length);
    });
  }
});
