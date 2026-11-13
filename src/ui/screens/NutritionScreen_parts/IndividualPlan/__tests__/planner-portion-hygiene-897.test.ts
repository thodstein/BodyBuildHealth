import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { applyPortionHygiene, assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { recipeComponentClass, scaleComponentAmount } from '../recipe-engine';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.97: порционная гигиена — «вёдра» не должны появляться ─────────────────
//
// Жалоба владельца: «ЛЕГКИЙ ДОБОР — ЭТО НЕ 170 УГЛЕВОДОВ» и «НА 120 КГ УЖАС».
// Замер до правки (рецептурный контур, 120 кг mass/5/трен P2.4):
//   «Завтрак» 1365 г при физической норме тарелки 975 г:
//   пшено 276 + тыква 244 + МОЛОКО 535 + творог 195 + МЁД 115 (94 г У из мёда).
// Другие ячейки: белок яичный 326–328 г (11 белков) на 70 кг cut, кефир 361 г,
// овощи 243 г × 3 = 729 г в одном приёме, второй плотный носитель (рис 250 + картофель 300).
//
// Что сделано:
//  1) `applyPortionHygiene` перед закрывателем §8.96 — жёсткие порционные потолки на
//     напитки (≤300 г), сладости (≤60 г), белок-наполнитель (≤2.5 г/кг, но не ниже 200 г).
//     Ядра рецептов (ingredientIds) не трогаются. Овощи сознательно не капятся (долг B16).
//  2) `recipe-engine`: у ингредиентов появился класс «drink» — молоко/кефир/сок в рецепте
//     масштабируются с коленом (×2) и физическим потолком 400 г, а не ×3.
//  3) закрыватель растит углеводы только в КРАХМАЛИСТЫЙ носитель (не мёд/сироп, не молоко),
//     предпочитая приёмы с комнатой тарелки; прогресс — мягкий кап 650×ws×1.25 (§8.97b:
//     жёсткий кап ломал канон — 100 кг mass/4/отд P1.8 уходил в У −7.6%).
//  4) последняя миля уважает тот же мягкий кап тарелки.
//
// Замер ПОСЛЕ: максимальная тарелка 1365 → 1155 г (в 120 кг mass/5/трен — 1075 г),
// молока 535 → 300 г, мёда 115 → 60 г, белка яичного 326 → 200 г.
// Канон дня не пострадал: в широкой матрице (56 комбинаций) ни одна ячейка не ухудшилась,
// замки planner-day-canon-894/896/matrix зелёные. Долг B16: овощи 243×3 = 729 г в одном
// приёме остаются — там они носитель углеводов, бланкетный срез уводил день из канона.

const milk = (amount: number) => ({
  id: 'milk', name: 'Молоко 2.5%', amount, role: 'slow_protein',
  p: Math.round(amount * 0.029 * 10) / 10, f: Math.round(amount * 0.025 * 10) / 10,
  c: Math.round(amount * 0.047 * 10) / 10, kcal: Math.round(amount * 0.52),
});
const honey = (amount: number) => ({
  id: 'honey', name: 'Мёд натуральный', amount, role: 'carb_slow',
  p: 0, f: 0, c: Math.round(amount * 0.8 * 10) / 10, kcal: Math.round(amount * 3.2),
});
const veg = (amount: number) => ({
  id: 'veg_cucumber', name: 'Огурец', amount, role: 'veg',
  p: 1, f: 0, c: Math.round(amount * 0.03 * 10) / 10, kcal: Math.round(amount * 0.15),
});
const eggWhite = (amount: number) => ({
  id: 'egg_white', name: 'Белок яичный', amount, role: 'protein',
  p: Math.round(amount * 0.11 * 10) / 10, f: 0, c: 0, kcal: Math.round(amount * 0.45),
});

const meal = (items: any[]) => ({
  label: 'Завтрак', type: 'breakfast', items,
  totals: { kcal: items.reduce((s, i) => s + i.kcal, 0), p: items.reduce((s, i) => s + i.p, 0), f: 0, c: items.reduce((s, i) => s + i.c, 0) },
}) as any;

describe('§8.97: applyPortionHygiene — напитки/сладости/белок/овощи не «вёдра»', () => {
  it('молоко 535 г → 300 г; мёд 115 г → 60 г; макросы пересчитаны', () => {
    const m = meal([milk(535), honey(115)]);
    applyPortionHygiene([m]);
    const milkIt = (m.items as any[]).find(i => i.id === 'milk');
    const honeyIt = (m.items as any[]).find(i => i.id === 'honey');
    expect(milkIt.amount).toBe(300);
    expect(honeyIt.amount).toBe(60);
    // Углеводы мёда после среза: 48 г вместо 92 — «стакан мёда» невозможен.
    expect(honeyIt.c).toBeLessThanOrEqual(48.5);
    expect(m.totals.c).toBeLessThanOrEqual(63);
  });

  it('овощи НЕ капятся (B16): 243 × 3 = 729 г остаются — там это носитель У, срез ломал канон', () => {
    const m = meal([veg(243), { ...veg(243), id: 'veg_tomato', name: 'Помидор' }, { ...veg(243), id: 'veg_pepper', name: 'Перец' }]);
    expect(applyPortionHygiene([m])).toEqual([]);
    const sum = (m.items as any[]).reduce((s, i) => s + i.amount, 0);
    expect(sum).toBe(729);
  });

  it('белок яичный: 200 г на 70 кг, 350 г на 140 кг (не режем белок-пол тяжёлых)', () => {
    const light = meal([eggWhite(326)]);
    applyPortionHygiene([light], { weightKg: 70 });
    expect((light.items as any[])[0].amount).toBe(200);

    const heavy = meal([eggWhite(326)]);
    applyPortionHygiene([heavy], { weightKg: 140 });
    expect((heavy.items as any[])[0].amount).toBe(326); // 350 > 326 — не тронуто
  });

  it('ядра рецептов не трогаются (ingredientIds)', () => {
    const core = meal([milk(500)]);
    (core as any).ingredientIds = ['milk'];
    applyPortionHygiene([core]);
    expect((core.items as any[])[0].amount).toBe(500);
  });

  it('нормальные порции не меняются (стакан молока 250, ложка мёда 20)', () => {
    const m = meal([milk(250), honey(20)]);
    const before = JSON.stringify(m.items);
    expect(applyPortionHygiene([m])).toEqual([]);
    expect(JSON.stringify(m.items)).toBe(before);
  });
});

describe('§8.97: класс «drink» в масштабировании рецепта', () => {
  it('молоко — напиток, не база: ×3 не даёт 750 г', () => {
    expect(recipeComponentClass('milk')).toBe('drink');
    expect(scaleComponentAmount('milk', 250, 3)).toBeLessThanOrEqual(400);
  });

  it('крупа масштабируется полностью (проверка, что колено не общее)', () => {
    expect(recipeComponentClass('buckwheat')).toBe('base');
    expect(scaleComponentAmount('buckwheat', 100, 2)).toBe(200);
  });
});

// ── Интеграция: ячейка, которая была «УЖАС НА 120 КГ» ─────────────────────────

function profile120(w: number, mode: 'mass' | 'cut', meals: number, train: boolean, pPerKg: number): MealPlanInput {
  const kcal = Math.round(w * (mode === 'mass' ? 36 : 26));
  const p = Math.round(w * pPerKg);
  const f = Math.round((kcal * 0.2) / 9);
  const c = Math.round((kcal - 4 * p - 9 * f) / 4);
  return {
    weightKg: w, lbmKg: Math.round(w * 0.85), bodyFatPct: 15, sex: 'male',
    goalKcal: 4 * p + 9 * f + 4 * c, goalProteinG: p, goalFatG: f, goalCarbsG: c,
    mealsCount: meals, isTrainingDay: train, trainStartMin: train ? 18 * 60 : undefined,
    trainDurationMin: 75, excludedIds: new Set<string>(), allergenTags: new Set<string>(),
    budget: 'medium', dayOffset: 0, cyclePhase: 'none',
    variety: 'medium', quality: 'full', randomSalt: 0, goal: mode,
    wakeTime: '08:00', bedTime: '23:00',
  } as any;
}

const solidG = (m: any): number => (m.items || [])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

describe('§8.97: интеграция — 120 кг mass/5/трен P2.4 без «вёдер»', () => {
  const input = profile120(120, 'mass', 5, true, 2.4);
  const day: any = buildDayPlan(input);
  const t = { kcal: input.goalKcal!, p: input.goalProteinG!, f: input.goalFatG!, c: input.goalCarbsG! };
  const res: any = assembleRecipeDay({
    meals: day.meals as PlanMealLike[], pool: getRecipes(), targets: t,
    excludedIds: new Set<string>(), maxPrepTimeMin: 120,
    usedNamesAcrossDays: new Set<string>(), goal: 'mass', athleteWeightKg: 120,
  } as any);
  const allItems = res.meals.flatMap((m: any) => (m.items || []) as any[]);
  const cap = Math.round(650 * 1.5 * 1.25); // мягкий кап §8.97b: 650 × ws(1.5) × 1.25

  it('день остаётся в каноне 3% (порционная гигиена не ломает §8.96)', () => {
    const tt = sumDayTotals(res.meals as any);
    const d = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b) * 100;
    const dev = Math.max(d(tt.kcal, t.kcal), d(tt.f, t.f), d(tt.c, t.c), Math.max(0, (t.p - tt.p) / t.p * 100));
    expect(dev, `${Math.round(tt.kcal)}/${Math.round(tt.p)}/${Math.round(tt.f)}/${Math.round(tt.c)}`).toBeLessThanOrEqual(3);
  });

  it('ни один приём не тяжелее мягкого капа тарелки (было 1365 г)', () => {
    for (const m of res.meals as any[]) {
      expect(solidG(m), `«${m.label}»`).toBeLessThanOrEqual(cap);
    }
  });

  it('молока ≤300 г, мёда ≤60 г, напиток не гарнир', () => {
    for (const it of allItems) {
      const key = `${it.id} ${it.name}`;
      if (/молок|кефир|milk|kefir/i.test(key)) expect(it.amount, key).toBeLessThanOrEqual(300);
      if (/мёд|мед|honey/i.test(key)) expect(it.amount, key).toBeLessThanOrEqual(60);
    }
  });

  it('в одном приёме не больше одного плотного носителя ≥250 г', () => {
    for (const m of res.meals as any[]) {
      const dense = (m.items || []).filter((i: any) => String(i.role || '') === 'carb_slow' && (i.amount || 0) >= 250);
      expect(dense.length, `«${m.label}»`).toBeLessThanOrEqual(1);
    }
  });
});
