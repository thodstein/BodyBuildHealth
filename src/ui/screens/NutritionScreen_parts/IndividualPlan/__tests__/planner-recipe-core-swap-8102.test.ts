import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import {
  applyRecipeCoreSwap,
  assembleRecipeDay,
  buildRecipeMealItems,
  flattenRecipeOption,
  sumDayTotals,
  sumMealTotals,
  type PlanMealLike,
} from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.102 (B15a): смена ядра рецепта в слоте ────────────────────────────────
//
// Долг B15a: три ячейки держались за 3% не из-за капризов закрывателя, а потому что
// **править нечего**. Замер `70 cut/5/трен P2.4`: 1819/157/39/210 при цели
// 1820/168/40/197 — свободных пунктов в основных приёмах нет, ВСЕ углеводы сидят
// в ядрах авторских рецептов («скир 165 + овсянка 49», «хлеб 34», «макароны 99 +
// нут 99», «ягоды 85»). Закрыватель честно отказывался:
//   • пол белка: добавка индейки поднимала ккал, углеводы оставались 6.6% →
//     «худшая ось не упала» → отказ;
//   • перебор углеводов: все носители — ядра → отказ.
//
// Рычаг — другой вариант рецепта в том же слоте (`recipeOptions`, они уже были
// просчитаны движком при посадке, значит это равноправный авторский рецепт).
// Авторские порции не режутся: новый рецепт берётся в своём `portionScale`.
//
// Оценка — ТОЛЬКО по финальному исходу (пробный свап + повторный закрыватель).
// Жадная оценка «до закрывателя» портила итог: `70 cut/5/отд P2.4` свап 7.6 → 5.4%,
// а закрыватель после него выводил жир в 5.0% против прежних 4.3%.
//
// Замер 56 ячеек: **вне канона 9 → 0**, поломок канона 0, лучше 17 ячеек,
// хуже 2 в пределах канона (70C5TP1.8 2.2 → 2.5%, 120M5RP2.4 1.0 → 1.3%),
// свапов 37. Три ячейки B15a:
//   70 cut/5/трен P2.4   6.6% → 1.2%
//   70 cut/5/отд P2.4    4.6% → 0.6%
//   140 mass/6/трен P1.8 3.6% → 1.2%

const item = (id: string, name: string, amount: number, role: string, m: { p: number; f: number; c: number; fiber?: number }) => ({
  id,
  name,
  amount,
  role,
  p: Math.round(((m.p * amount) / 100) * 10) / 10,
  f: Math.round(((m.f * amount) / 100) * 10) / 10,
  c: Math.round(((m.c * amount) / 100) * 10) / 10,
  kcal: Math.round(4 * ((m.p * amount) / 100) + 9 * ((m.f * amount) / 100) + 4 * ((m.c * amount) / 100)),
  fiber: Math.round((((m.fiber ?? 0) * amount) / 100) * 10) / 10,
}) as any;

const mealOf = (type: string, label: string, items: any[], extra?: any) => ({
  type,
  label,
  items,
  target: { p: 40, c: 70, f: 15 },
  totals: sumMealTotals(items as any),
  ...(extra || {}),
}) as any;

const axesOf = (t: any, targets: any) => {
  const d = (a: number, b: number) => (b > 0 ? (Math.abs(a - b) / b) * 100 : 0);
  return {
    k: d(t.kcal || 0, targets.kcal),
    f: d(t.f || 0, targets.f),
    c: d(t.c || 0, targets.c),
    pUnder: Math.max(0, (targets.p - (t.p || 0)) / Math.max(1, targets.p)) * 100,
  };
};
const worstOf = (a: any) => Math.max(a.k, a.f, a.c, a.pUnder);

/**
 * Реальный рецепт с белковым и углеводным пунктами — база для «другого варианта».
 * Вариант собираем из ТЕХ ЖЕ продуктов: белок ×2, жир ×1, углеводы ×0.5 при той же
 * объявленной калорийности. `decomposeRecipe` нормализует раскладку под `kcal`, поэтому
 * такой вариант — «то же блюдо, но плотнее по белку и легче по углеводам».
 */
function recipeBase() {
  const rows = getRecipes()
    .map(r => ({ r, items: buildRecipeMealItems(r) }))
    .filter(x => !!x.items && x.items!.length > 0) as Array<{ r: any; items: any[] }>;
  const withT = rows.map(x => ({ ...x, t: sumMealTotals(x.items as any) }));
  return withT.find(x =>
    x.t.kcal >= 350 && x.t.kcal <= 700
    && x.items.some((i: any) => /protein/.test(String(i.role || '')))
    && x.items.some((i: any) => /carb/.test(String(i.role || ''))));
}

function leanerVariant(base: { items: any[]; t: any; r: any }) {
  // Белковый пункт должен быть постным, иначе «больше белка» тащит жир и жировая ось
  // (стоявшая в каноне) честно отклоняет свап — это и есть третий тест ниже.
  const prot = base.items
    .filter((i: any) => /protein/.test(String(i.role || '')) && (i.f || 0) / (i.amount || 1) <= 0.035 && (i.p || 0) / (i.amount || 1) >= 0.14)
    .sort((a: any, b: any) => (b.p || 0) / (b.amount || 1) - (a.p || 0) / (a.amount || 1))[0];
  const carb = base.items.find((i: any) => /carb/.test(String(i.role || '')) && (i.c || 0) / (i.amount || 1) >= 0.15);
  if (!prot || !carb) return null;
  // Ищем коэффициент белка так, чтобы блюдо осталось той же калорийности (тогда жир не плывёт:
  // урезанные углеводы замещаются постным белком, а не жиром).
  for (let pk = 1.4; pk <= 4.0001; pk += 0.1) {
    for (const ck of [0.5, 0.6, 0.7]) {
      const ings = base.items.map((i: any) => {
        const k = i === prot ? pk : (i === carb ? ck : 1);
        return `${i.name} ${Math.max(1, Math.round((i.amount || 0) * k))} г`;
      });
      const flat = {
        name: 'Pro-вариант того же блюда',
        meal: base.r.meal,
        kcal: Math.round(base.t.kcal),
        protein: Math.round(base.t.p * 1.2),
        fat: base.t.f,
        carbs: Math.round(base.t.c * 0.8),
        prepTimeMin: 15,
        description: '',
        ingredients: ings,
        instructions: [],
        tags: [],
        difficulty: base.r.difficulty,
      } as any;
      const built = buildRecipeMealItems(flat);
      if (!built || built.length === 0) continue;
      const t = sumMealTotals(built as any);
      const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b);
      // Вариант годится, только если он реально «суше и белковее» при тех же ккал и жире.
      if (rel(t.kcal, base.t.kcal) <= 0.02
        && rel(t.f, base.t.f) <= 0.025
        && t.c <= base.t.c * 0.9
        && t.p >= base.t.p * 1.08) return flat;
    }
  }
  return null;
}

describe('§8.102: смена ядра рецепта в слоте', () => {
  it('день в каноне не трогается', () => {
    const meals = [
      mealOf('breakfast', 'Завтрак', [item('oats', 'Овсянка', 80, 'carb_slow', { p: 12, f: 6, c: 55 })]),
      mealOf('lunch', 'Обед', [item('chicken', 'Курица', 150, 'protein', { p: 31, f: 3.6, c: 0 })]),
    ] as any[];
    meals[0].recipeOptions = [{ name: 'Другой завтрак', kcal: 300, protein: 20, fat: 10, carbs: 30 }];
    meals[0].recipeApplied = 'Овсянка';
    const t0 = sumDayTotals(meals as any);
    const targets = { kcal: t0.kcal, p: t0.p, f: t0.f, c: t0.c };
    const before = meals[0].items.map((i: any) => `${i.id}:${i.amount}`).join(',');
    const notes = applyRecipeCoreSwap(meals, targets);
    expect(notes).toEqual([]);
    expect(meals[0].items.map((i: any) => `${i.id}:${i.amount}`).join(',')).toBe(before);
  });

  it('свап на более белковый и сухой вариант: худшая ось падает, день остаётся по ккал', () => {
    const base = recipeBase();
    expect(base, 'в каталоге должен найтись рецепт с белковым и углеводным пунктами').toBeTruthy();
    const flatA = flattenRecipeOption((base as any).r);
    const flatB = leanerVariant(base as any);
    expect(flatB, 'из рецепта должен собираться «суше и белковее» при тех же ккал/жире').toBeTruthy();
    // Вариант обязан раскладываться, иначе «свап» был бы пустым.
    const probeB = buildRecipeMealItems(flatB as any);
    expect(probeB && probeB.length).toBeTruthy();

    const meals = [
      mealOf('breakfast', 'Завтрак', [...(base as any).items], {
        recipeApplied: flatA.name,
        recipeAppliedData: flatA,
        recipeOptions: [flatA, flatB],
      }),
      mealOf('snack', 'Перекус', [item('cottage', 'Творог', 200, 'protein', { p: 18, f: 9, c: 3.4 })]),
      mealOf('dinner', 'Ужин', [item('cod', 'Треска', 180, 'protein', { p: 32, f: 1.2, c: 0 })]),
    ] as any[];
    const t0 = sumDayTotals(meals as any);
    // День недобирает белок и перебирает углеводы — ровно профиль B15a.
    const targets = {
      kcal: t0.kcal,
      p: Math.round(t0.p * 1.12),
      f: t0.f,
      c: Math.round(t0.c * 0.88),
    };
    const worst0 = worstOf(axesOf(t0, targets));
    const notes = applyRecipeCoreSwap(meals, targets);
    const t1 = sumDayTotals(meals as any);
    const worst1 = worstOf(axesOf(t1, targets));

    expect(notes.length).toBe(1);
    expect(notes[0]).toMatch(/рецепт «.+» → «.+»/);
    expect(meals[0].recipeApplied).toBe(flatB.name);
    expect(worst1).toBeLessThan(worst0);
    // Калорийная ось была в каноне — вариант с той же ккал её не ломает.
    expect(axesOf(t1, targets).k).toBeLessThanOrEqual(3);
  });

  it('вариант, ломающий канон по калориям, отклоняется', () => {
    const base = recipeBase();
    expect(base, 'нужен реальный рецепт-база').toBeTruthy();
    const flatA = flattenRecipeOption((base as any).r);
    // Тот же рецепт, объявленный на 1.6× калорий: `decomposeRecipe` масштабирует раскладку под
    // `kcal`, поэтому приём получает +60% калорий и жира — оси, стоявшие в каноне, обязаны
    // отклонить свап.
    const heavy = { ...flatA, name: 'Тяжёлый вариант того же блюда', kcal: Math.round((base as any).t.kcal * 1.6) } as any;
    const probe = buildRecipeMealItems(heavy);
    expect(probe && probe.length).toBeTruthy();
    expect(sumMealTotals(probe as any).kcal).toBeGreaterThan((base as any).t.kcal * 1.3);

    const meals = [
      mealOf('breakfast', 'Завтрак', [...(base as any).items], {
        recipeApplied: flatA.name,
        recipeAppliedData: flatA,
        recipeOptions: [flatA, heavy],
      }),
      mealOf('lunch', 'Обед', [item('chicken', 'Курица', 150, 'protein', { p: 31, f: 3.6, c: 0 })]),
    ] as any[];
    const t0 = sumDayTotals(meals as any);
    const targets = { kcal: t0.kcal, p: Math.round(t0.p * 1.4), f: t0.f, c: Math.round(t0.c * 0.85) };
    const before = meals[0].items.map((i: any) => `${i.id}:${i.amount}`).join(',');
    const notes = applyRecipeCoreSwap(meals, targets);
    // Ккал-ось была в каноне (0%) — вариант с +60% ккал её ломает, свап обязан откатиться.
    expect(notes).toEqual([]);
    expect(meals[0].recipeApplied).toBe(flatA.name);
    expect(meals[0].items.map((i: any) => `${i.id}:${i.amount}`).join(',')).toBe(before);
  });
});

// ─── Интеграция: три ячейки B15a ─────────────────────────────────────────────

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

function buildCell(w: number, mode: 'mass' | 'cut', meals: number, pPerKg: number, train: boolean) {
  const input = profile(w, mode, meals, pPerKg, train);
  const t = { kcal: input.goalKcal, p: input.goalProteinG, f: input.goalFatG, c: input.goalCarbsG };
  const day: any = buildDayPlan(input);
  const res: any = assembleRecipeDay({
    meals: day.meals as PlanMealLike[],
    pool: getRecipes(),
    targets: t,
    excludedIds: new Set<string>(),
    maxPrepTimeMin: 120,
    usedNamesAcrossDays: new Set<string>(),
    goal: mode,
    athleteWeightKg: w,
  } as any);
  return { res, totals: sumDayTotals(res.meals as any), t };
}

describe('§8.102: ячейки B15a сведены в канон 3%', () => {
  const cases: Array<[string, number, 'mass' | 'cut', number, number, boolean]> = [
    ['70 cut/5/трен P2.4 (было 6.6%)', 70, 'cut', 5, 2.4, true],
    ['70 cut/5/отд P2.4 (было 4.6%)', 70, 'cut', 5, 2.4, false],
    ['140 mass/6/трен P1.8 (было 3.6%)', 140, 'mass', 6, 1.8, true],
  ];
  for (const [label, w, mode, meals, pPerKg, train] of cases) {
    it(label, { timeout: 240000 }, () => {
      const { res, totals, t } = buildCell(w, mode, meals, pPerKg, train);
      expect(worstOf(axesOf(totals, t))).toBeLessThanOrEqual(3);
      const swaps = (res.notes as string[]).filter(n => /🔄/.test(n));
      // §8.107c: после «последней мили по углеводам» (честный срез излишка из
      // перекормленного приёма) день может сойтись в канон БЕЗ свапа ядра — тогда
      // «свап обязан случиться» не инвариант: он был следствием того, что день
      // выходил за 3%. Проверяем: либо свап был и нота честная (ниже), либо день
      // сошёлся честными граммами без подмены блюда. Механизм свапа при этом
      // по-прежнему заперт другими ячейками этой таблицы.
      if (swaps.length === 0) {
        expect(worstOf(axesOf(totals, t))).toBeLessThanOrEqual(3);
        return;
      }
      // Каждый свап объяснён и ссылается на реальный вариант из `recipeOptions` этого приёма.
      for (const n of swaps) {
        const mm = n.match(/«([^»]+)»: рецепт «([^»]+)» → «([^»]+)»/);
        expect(mm, n).toBeTruthy();
        const meal = (res.meals as any[]).find(m => String(m.label || m.type) === mm![1]);
        expect(meal, n).toBeTruthy();
        expect(meal.recipeApplied).toBe(mm![3]);
        expect((meal.recipeOptions || []).map((o: any) => o.name)).toContain(mm![3]);
      }
    });
  }
});
