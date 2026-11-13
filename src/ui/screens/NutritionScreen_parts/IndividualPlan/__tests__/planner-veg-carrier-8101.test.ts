import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import {
  applyPortionHygiene,
  applyVegCarrierHygiene,
  assembleRecipeDay,
  sumDayTotals,
  sumMealTotals,
  type PlanMealLike,
} from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.101 (B16): «овощ-носитель» vs «овощ-гарнир» ───────────────────────────
//
// Долг B16: когда в приёме нет места под крахмал, углеводы набираются ОВОЩАМИ.
// Замер 56 ячеек (до правки):
//   `100 cut/5/отд P1.8` обед — капуста 243 + помидор 243 + огурец 243 = 729 г,
//     из них 32 г У при 58 г У приёма (55%), тарелка 969 г;
//   `70 cut/5/отд P1.8` ужин — брокколи 300 + лук 100 = 400 г, 30 из 42 г У (71%);
//   `70 cut/4/трен P2.4` ужин — брокколи 309 + лук 52 = 361 г, 26 из 28 г У (93%).
//
// Бланкетный кап (400 г) уже пробовали — день уезжал 3.1% → 7.4%, потому что овощ был
// НОСИТЕЛЕМ и замены не было (долг §8.97b). Здесь перенос, а не срез: углеводы овоща
// уезжают в крахмалистый носитель ТОГО ЖЕ приёма, овощ остаётся гарниром (250 г × ws),
// тарелка легчает. Ядра рецептов не трогаются.
//
// Замер 56 ячеек после правки (включая §8.101b — кап приправы):
//   максимальный овощной приём 729 → 480 г; приёмов с ≥500 г овощей 1 → 0;
//   девиация дня: 2 ячейки лучше (70C5RP1.8 2.5 → 1.7, 100C5RP1.8 3.2 → 2.8),
//   1 хуже в пределах канона (120M5TP1.8 2.0 → 2.8 — цена капа томатной пасты),
//   0 поломок канона (ячеек вне 3%: 10 → 9).

const item = (id: string, name: string, amount: number, role: string, macros: { p: number; f: number; c: number; fiber?: number }) => {
  const fiber = macros.fiber ?? Math.round((macros.c / 100) * 2 * 10) / 10;
  return {
    id,
    name,
    amount,
    role,
    p: Math.round(((macros.p * amount) / 100) * 10) / 10,
    f: Math.round(((macros.f * amount) / 100) * 10) / 10,
    c: Math.round(((macros.c * amount) / 100) * 10) / 10,
    kcal: Math.round(4 * ((macros.p * amount) / 100) + 9 * ((macros.f * amount) / 100) + 4 * ((macros.c * amount) / 100)),
    fiber: Math.round((((macros.fiber ?? macros.c / 4) * amount) / 100) * 10) / 10,
  } as any;
};

const veg = (id: string, name: string, amount: number, c100 = 5, fiber100 = 2.5) =>
  item(id, name, amount, 'veg', { p: 1.2, f: 0.1, c: c100, fiber: fiber100 });

const mealOf = (type: string, label: string, items: any[]) => ({
  type,
  label,
  items,
  target: { p: 40, c: 70, f: 15 },
  totals: sumMealTotals(items as any),
}) as any;

const devOf = (totals: any, t: { kcal: number; p: number; f: number; c: number }): number => {
  const d = (a: number, b: number) => (b > 0 ? (Math.abs(a - b) / b) * 100 : 0);
  return Math.max(
    d(totals.kcal || 0, t.kcal),
    d(totals.f || 0, t.f),
    d(totals.c || 0, t.c),
    Math.max(0, ((t.p - (totals.p || 0)) / Math.max(1, t.p)) * 100),
  );
};

const vegGrams = (m: any) => (m.items || [])
  .filter((i: any) => String(i.role || '') === 'veg')
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

// День масштаба реальной ячейки (100 кг cut): ~2300 ккал, жир ~75 г, У ~240 г, клетчатка ~40 г.
// Мелкий синтетический день искажал приёмку: сдвиг на 2 г У при 110 г У дня — это 2%,
// а при 240 г — 0.8%, и перенос отклонялся не по существу, а из-за масштаба.
const vegHeavyDay = () => [
  mealOf('breakfast', 'Завтрак', [
    item('oats', 'Овсянка', 150, 'carb_slow', { p: 12, f: 6, c: 55, fiber: 12 }),
  ]),
  mealOf('lunch', 'Обед', [
    veg('cabbage', 'Капуста белокочанная', 243),
    veg('tomato', 'Помидор', 243, 4, 1.6),
    veg('cucumber', 'Огурец', 243, 2.5, 1),
    item('chicken', 'Курица', 200, 'protein', { p: 31, f: 3.6, c: 0, fiber: 0 }),
  ]),
  mealOf('snack', 'Перекус', [
    item('cottage', 'Творог', 300, 'protein', { p: 18, f: 9, c: 3.4, fiber: 0 }),
    item('beans', 'Фасоль', 200, 'carb_slow', { p: 8, f: 0.5, c: 20, fiber: 9 }),
  ]),
  mealOf('dinner', 'Ужин', [
    item('cod', 'Треска', 250, 'protein', { p: 32, f: 1.2, c: 0, fiber: 0 }),
    item('rice_white', 'Рис белый', 200, 'carb_slow', { p: 2.7, f: 0.7, c: 25, fiber: 0.4 }),
    item('almond', 'Миндаль', 50, 'fat', { p: 21, f: 50, c: 21, fiber: 12 }),
  ]),
];

describe('§8.101: applyVegCarrierHygiene — овощ-носитель становится гарниром', () => {
  it('729 г овощей в приёме → гарнир + крахмал, тарелка легчает, день ≈ тот же', () => {
    const meals = vegHeavyDay() as any[];
    const before = sumDayTotals(meals);
    // Цель дня с запасом по белку, как на реальных днях: планировщик перебирает белок
    // на 10–17% (210 против 180), и этот запас — законный буфер переноса.
    const t = { kcal: before.kcal, p: Math.round(before.p * 0.9), f: before.f, c: before.c };
    const notes = applyVegCarrierHygiene(meals, t, { weightKg: 100 });

    // 100 кг → норм гарнира 250 × 1.25 = 310 г (±доля на пункт, каждый ≥60 г)
    expect(vegGrams(meals[1])).toBeLessThanOrEqual(350);
    expect(vegGrams(meals[1])).toBeGreaterThanOrEqual(250);
    // Углеводы не потеряны: в приёме появился крахмалистый носитель.
    const carbs = meals[1].items.filter((i: any) => i.role === 'carb_slow');
    expect(carbs.length).toBeGreaterThan(0);
    // День не поехал: перенос ккал-нейтрален (допуск на округление порций).
    const after = sumDayTotals(meals);
    expect(Math.abs(after.kcal - before.kcal)).toBeLessThanOrEqual(before.kcal * 0.02);
    expect(devOf(after, t)).toBeLessThanOrEqual(3);
    expect(notes.length).toBe(1);
    expect(notes[0]).toMatch(/овощи 729 → \d+ г/);
  });

  it('ядро рецепта (ingredientIds) не трогается', () => {
    const meals = vegHeavyDay() as any[];
    // Все овощи обеда — ядро авторского рецепта: ни среза, ни переноса.
    meals[1].ingredientIds = ['cabbage', 'tomato', 'cucumber'];
    const before = sumDayTotals(meals);
    const notes = applyVegCarrierHygiene(meals, { kcal: before.kcal, p: before.p, f: before.f, c: before.c }, { weightKg: 100 });
    expect(notes.length).toBe(0);
    expect(vegGrams(meals[1])).toBe(729);
  });

  it('клетчаточный пол: перенос, роняющий клетчатку дня ниже 25 г, отклоняется', () => {
    const meals = vegHeavyDay() as any[];
    // Все источники клетчатки, кроме овощей, обнулены; овощи почти без клетчатки.
    // После переноса день остался бы с ~2 г клетчатки — такой размен запрещён.
    for (const m of meals) for (const it of m.items) it.fiber = 0;
    for (const it of meals[1].items) if (it.role === 'veg') it.fiber = Math.round((0.5 * it.amount) / 100 * 10) / 10;
    for (const m of meals) m.totals = sumMealTotals(m.items);
    const before = sumDayTotals(meals);
    const notes = applyVegCarrierHygiene(meals, { kcal: before.kcal, p: before.p, f: before.f, c: before.c }, { weightKg: 100 });
    expect(notes.length).toBe(0);
    expect(vegGrams(meals[1])).toBe(729);
  });

  it('салат не трогаем: овощи дают <40% углеводов приёма', () => {
    const meals = [
      mealOf('breakfast', 'Завтрак', [item('oats', 'Овсянка', 100, 'carb_slow', { p: 13, f: 7, c: 60, fiber: 10 })]),
      mealOf('lunch', 'Обед', [
        veg('cabbage', 'Капуста', 100), veg('tomato', 'Помидор', 100, 4, 1.6), veg('cucumber', 'Огурец', 100, 2.5, 1),
        item('rice_white', 'Рис белый', 250, 'carb_slow', { p: 2.7, f: 0.7, c: 25, fiber: 0.4 }),
        item('chicken', 'Курица', 150, 'protein', { p: 31, f: 3.6, c: 0, fiber: 0 }),
      ]),
    ] as any[];
    const before = sumDayTotals(meals);
    const notes = applyVegCarrierHygiene(meals, { kcal: before.kcal, p: before.p, f: before.f, c: before.c }, { weightKg: 100 });
    expect(notes.length).toBe(0);
    expect(vegGrams(meals[1])).toBe(300);
  });

  it('peri-окно не трогаем', () => {
    const meals = [
      mealOf('preworkout', 'Предтрен', [veg('tomato', 'Помидор', 400, 4, 1.6), item('whey', 'Изолят', 30, 'fast_protein', { p: 80, f: 1, c: 3, fiber: 0 })]),
    ] as any[];
    const before = sumDayTotals(meals);
    const notes = applyVegCarrierHygiene(meals, { kcal: before.kcal, p: before.p, f: before.f, c: before.c }, { weightKg: 80 });
    expect(notes.length).toBe(0);
    expect(vegGrams(meals[0])).toBe(400);
  });
});

// ─── Интеграция на реальных днях ───────────────────────────────────────────────

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
  return { meals: res.meals as any[], totals: sumDayTotals(res.meals as any), t };
}

describe('§8.101: овощные вёдра на реальных днях', () => {
  it('100 cut/5/отд P1.8: обед из 729 г овощей сведён к гарниру, день в каноне', { timeout: 180000 }, () => {
    const { meals, totals, t } = buildCell(100, 'cut', 5, 1.8, false);
    const maxVeg = Math.max(...meals.map(vegGrams));
    expect(maxVeg).toBeLessThan(500);
    expect(vegGrams(meals[1])).toBeLessThanOrEqual(420);
    expect(devOf(totals, t)).toBeLessThanOrEqual(3);
  });

  it('120 mass/5/трен P1.8: томатная паста — приправа, а не овощ', { timeout: 180000 }, () => {
    const { meals, totals, t } = buildCell(120, 'mass', 5, 1.8, true);
    const paste = meals
      .flatMap((m: any) => m.items || [])
      .filter((i: any) => /томатная паста|томат-паста|кетчуп/i.test(String(i.name || '')));
    for (const p of paste) expect(Number(p.amount) || 0).toBeLessThanOrEqual(50);
    expect(devOf(totals, t)).toBeLessThanOrEqual(3);
  });

  it('матрица 8 ячеек: ни одного приёма с ≥500 г овощей', { timeout: 600000 }, () => {
    const cells: Array<[number, 'mass' | 'cut', number, number, boolean]> = [
      [100, 'mass', 4, 1.8, false],
      [100, 'cut', 5, 1.8, false],
      [110, 'cut', 5, 2.4, true],
      [120, 'mass', 5, 1.8, true],
      [130, 'mass', 6, 1.8, true],
      [140, 'mass', 6, 2.4, false],
      [160, 'mass', 6, 1.8, false],
      [70, 'cut', 4, 2.4, true],
    ];
    const bad: string[] = [];
    for (const [w, mode, n, pPerKg, train] of cells) {
      const { meals } = buildCell(w, mode, n, pPerKg, train);
      meals.forEach((m: any, idx: number) => {
        const g = vegGrams(m);
        if (g >= 500) bad.push(`${w} ${mode}/${n} ${train ? 'трен' : 'отд'} P${pPerKg} «${m.label || m.type}#${idx}»: ${Math.round(g)} г`);
      });
    }
    expect(bad).toEqual([]);
  });
});

describe('§8.101b: applyPortionHygiene — кап концентрированных приправ', () => {
  it('томатная паста режется до 50 г, помидор (овощ) — нет', () => {
    const meals = [
      mealOf('dinner', 'Ужин', [
        veg('tomato', 'Помидор', 155, 4, 1.6),
        { ...veg('tomato_paste', 'Томатная паста', 155, 19, 4), kcal: 130 } as any,
        veg('onion', 'Лук', 155, 10, 1.7),
      ]),
    ] as any[];
    const notes = applyPortionHygiene(meals, { weightKg: 120 });
    const paste = meals[0].items.find((i: any) => i.id === 'tomato_paste');
    expect(Number(paste.amount)).toBe(50);
    expect(vegGrams(meals[0])).toBe(155 + 50 + 155);
    expect(notes.some((n: string) => /приправа/.test(n))).toBe(true);
  });
});
