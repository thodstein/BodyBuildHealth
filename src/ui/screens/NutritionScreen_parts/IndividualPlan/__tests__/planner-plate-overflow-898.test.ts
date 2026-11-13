import { describe, it, expect } from 'vitest';
import { applyPlateOverflowRelief, buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.98 (B17): «вёдра» больших атлетов — перенос носителя между приёмами ───
//
// Долг B17 (§8.97): на 100–160 кг при 4–6 приёмах тарелки выходят 850–1150 г при норме
// `650 × ws`. Пример замера (100 кг mass/4/отд P1.8): обед = полента 250 + батат 300 +
// булгур 63 + рис 100 (713 г крахмала) → тарелка 988 г. Кап тут не работает: день обязан
// сойтись к 3%, значит углеводы обязаны где-то лежать.
//
// Решение — не кап, а ПЕРЕНОС: та же плотность того же продукта уезжает в приём с комнатой,
// поэтому калории/Б/Ж/У дня сохраняются бит-в-бит (канон 3% не может пострадать по
// построению). Ограничения: переносится только гибкий крахмалистый носитель (не ядро
// рецепта `ingredientIds`, не `_fixedGrams`, не фрукт/овощ — B16); peri-окна не трогаем;
// в приём с ядром рецепта чужой продукт не подселяется; качество дня не падает.
//
// Замер широкой матрицы (56 комбинаций) до/после §8.98:
//   максимальная тарелка 1155 → 1044 г; 100 кг mass/4/отд 988 → 898 г;
//   ячеек хуже канона 9 → 9 (ни одна не ухудшилась и не улучшилась — перенос нейтрален).

const it_ = (id: string, name: string, amount: number, role: string, carbs: number) => ({
  id, name, amount, role, p: 2, f: 1, c: carbs, kcal: Math.round(4 * 2 + 9 + 4 * carbs), fiber: 1,
});
const mealOf = (type: string, label: string, items: any[], capKcal = 800) => ({
  type, label, items, target: { p: 40, c: capKcal / 4 / 2, f: 15 },
  totals: {
    kcal: items.reduce((s, i) => s + i.kcal, 0),
    p: items.reduce((s, i) => s + i.p, 0),
    f: items.reduce((s, i) => s + i.f, 0),
    c: items.reduce((s, i) => s + i.c, 0),
  },
}) as any;
const solidOf = (m: any) => (m.items || [])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

describe('§8.98: applyPlateOverflowRelief — перенос, а не срез', () => {
  const day = () => [
    mealOf('lunch', 'Обед', [
      it_('polenta', 'Полента', 250, 'carb_slow', 45),
      it_('sweet_potato', 'Батат', 300, 'carb_slow', 54),
      it_('bulgur', 'Булгур', 63, 'carb_slow', 15),
      it_('rice_white', 'Рис белый', 100, 'carb_slow', 25),
      it_('turkey_breast', 'Индейка', 150, 'protein', 0),
    ]),
    mealOf('snack', 'Перекус', [it_('sweet_potato', 'Батат', 150, 'carb_slow', 27), it_('whey', 'Изолят', 25, 'fast_protein', 1)]),
    mealOf('dinner', 'Ужин', [it_('cod', 'Треска', 170, 'protein', 0), it_('chickpea', 'Нут', 172, 'carb_slow', 31)]),
  ];

  it('переносит носитель: обед легче, перекус тяжелее, суммы дня те же', () => {
    const meals = day();
    const totals: any = {};
    const before = sumDayTotals(meals as any);
    const notes: string[] = [];
    const changed = applyPlateOverflowRelief(meals as any, totals, 100, notes);
    const after = sumDayTotals(meals as any);
    expect(changed).toBe(true);
    // День тот же в пределах округления порции (плотность продукта сохраняется): дрейф —
    // только округление до 0.1 г на позицию, на реальных днях <0.1 п.п. девиации.
    expect(Math.abs(after.kcal - before.kcal)).toBeLessThanOrEqual(5);
    expect(Math.abs(after.p - before.p)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.f - before.f)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.c - before.c)).toBeLessThanOrEqual(0.5);
    // Раскладка изменилась: тяжёлый приём облегчён.
    expect(solidOf(meals[0])).toBeLessThan(988);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]).toMatch(/облегчён/);
  });

  it('донор с ядром рецепта не отдаёт ядро (ingredientIds неприкосновенны)', () => {
    const meals = [
      mealOf('lunch', 'Обед', [it_('polenta', 'Полента', 600, 'carb_slow', 108)]),
      mealOf('snack', 'Перекус', [it_('whey', 'Изолят', 25, 'fast_protein', 1)], 400),
    ];
    (meals[0] as any).ingredientIds = ['polenta'];
    const notes: string[] = [];
    applyPlateOverflowRelief(meals as any, {} as any, 120, notes);
    expect((meals[0].items as any[])[0].amount).toBe(600);
  });

  it('фрукты/овощи не переносятся (B16), peri-окно не трогается', () => {
    const meals = [
      mealOf('lunch', 'Обед', [
        { id: 'veg_cucumber', name: 'Огурец', amount: 400, role: 'veg', p: 1, f: 0, c: 8, kcal: 60 },
        { id: 'veg_tomato', name: 'Помидор', amount: 400, role: 'veg', p: 1, f: 0, c: 12, kcal: 80 },
      ]),
      mealOf('preworkout', 'Предтрен', [], 300),
    ];
    const notes: string[] = [];
    const changed = applyPlateOverflowRelief(meals as any, {} as any, 80, notes);
    expect(changed).toBe(false);
    expect((meals[0].items as any[])[0].amount).toBe(400);
  });

  it('перенос в приём с ядром рецепта запрещён (только рост одноимённого продукта)', () => {
    const meals = [
      mealOf('lunch', 'Обед', [it_('polenta', 'Полента', 600, 'carb_slow', 108)]),
      mealOf('snack', 'Перекус', [it_('whey', 'Изолят', 25, 'fast_protein', 1)], 300),
    ];
    (meals[1] as any).ingredientIds = ['whey'];
    const notes: string[] = [];
    const changed = applyPlateOverflowRelief(meals as any, {} as any, 80, notes);
    expect(changed).toBe(false);
    expect(meals[1].items.length).toBe(1);
  });

  it('приём с комнатой не трогается (нечего разгружать)', () => {
    const meals = [
      mealOf('lunch', 'Обед', [it_('polenta', 'Полента', 200, 'carb_slow', 36)]),
      mealOf('snack', 'Перекус', [it_('whey', 'Изолят', 25, 'fast_protein', 1)]),
    ];
    const notes: string[] = [];
    expect(applyPlateOverflowRelief(meals as any, {} as any, 100, notes)).toBe(false);
  });
});

// ── Интеграция: ячейка из замера (988 г в одном приёме) ──────────────────────

function profile100(): MealPlanInput {
  const w = 100, kcal = 3600, p = 180, f = 80;
  const c = Math.round((kcal - 4 * p - 9 * f) / 4);
  return {
    weightKg: w, lbmKg: 85, bodyFatPct: 15, sex: 'male',
    goalKcal: 4 * p + 9 * f + 4 * c, goalProteinG: p, goalFatG: f, goalCarbsG: c,
    mealsCount: 4, isTrainingDay: false, trainDurationMin: 75,
    excludedIds: new Set<string>(), allergenTags: new Set<string>(),
    budget: 'medium', dayOffset: 0, cyclePhase: 'none',
    variety: 'medium', quality: 'full', randomSalt: 0, goal: 'mass',
    wakeTime: '08:00', bedTime: '23:00',
  } as any;
}

describe('§8.98: интеграция — 100 кг mass/4/отд P1.8', () => {
  const input = profile100();
  const t = { kcal: input.goalKcal!, p: input.goalProteinG!, f: input.goalFatG!, c: input.goalCarbsG! };
  const day: any = buildDayPlan(input);
  const res: any = assembleRecipeDay({
    meals: day.meals as PlanMealLike[], pool: getRecipes(), targets: t,
    excludedIds: new Set<string>(), maxPrepTimeMin: 120,
    usedNamesAcrossDays: new Set<string>(), goal: 'mass', athleteWeightKg: 100,
  } as any);
  const maxPlate = Math.max(...(res.meals as any[]).map(m => solidOf(m)));

  it('самый тяжёлый приём ≤970 г (было 988 — обед из четырёх носителей)', () => {
    expect(Math.round(maxPlate)).toBeLessThanOrEqual(970);
  });

  it('день остаётся в каноне 3% (перенос нейтрален по построению)', () => {
    const tt = sumDayTotals(res.meals as any);
    const d = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b) * 100;
    const dev = Math.max(d(tt.kcal, t.kcal), d(tt.f, t.f), d(tt.c, t.c), Math.max(0, (t.p - tt.p) / t.p * 100));
    expect(dev, `${Math.round(tt.kcal)}/${Math.round(tt.p)}/${Math.round(tt.f)}/${Math.round(tt.c)}`).toBeLessThanOrEqual(3);
  });

  it('перенос виден в логе дня (не «тихая» правка)', () => {
    const notes = (res.notes || []).filter((n: string) => /облегчён/.test(String(n)));
    expect(notes.length).toBeGreaterThan(0);
  });
});
