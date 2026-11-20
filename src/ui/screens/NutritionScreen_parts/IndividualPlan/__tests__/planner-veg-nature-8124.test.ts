/**
 * planner-veg-nature-8124.test.ts — §8.124 «овощ — по природе, а не по флагу» + долг B18.
 *
 * Часть 1 (ось «овощ» в `scoreDayQuality`).
 * Гипотеза аудита была «микро-посыпка даёт балл оси». Замер её опроверг: на 600 днях
 * (10 профилей × 3–7 приёмов × тр/отд × авто/руч × variety) единственная позиция `veg` с
 * флагами — морковь 80 г (закрытие дефицита VitA), 30 дней из 600, и это НАСТОЯЩИЙ овощ.
 * Настоящий дефект оказался обратным: прежняя редакция §8.122 исключала её из овоща дня,
 * то есть день с 200 г овощей считался днём со 120 г и получал добор.
 * Правило: роль `veg` + плотность белка < 12 г/100 г; флаги микро-закрытия не влияют.
 * Позиция-белок в овощном слоте (§8.88, «рыба как овощ») по-прежнему не считается.
 *
 * Часть 2 (долг B18 «второй гарнир в малом виде»).
 * Свёртка §8.108 и счётчик двойников видели только семейства из `stapleFamilyOf`, а она
 * возвращает null для крупяных продуктов вне своих регэкспов. Замер 160 дней: на
 * `p500/3–5/отд` снек держал `30 г кукурузных хлопьев + 30 г риса` в обоих контурах —
 * два мелких гарнира на одной тарелке, которых метрика не видела. §8.124 вводит правило
 * «гарнир — это зерно» (`starchFamilyOfItem`): явное семейство ротации ИЛИ имя крупяного
 * продукта. Свёртка сводит второй носитель в существующий 1:1 по углеводам.
 */

import { describe, expect, it } from 'vitest';
import { buildDayPlan, starchDoubleStats, type MealPlanInput } from '../meal-plan-engine';
import { isRealVegItem, scoreDayQuality } from '../planner-quality-score';

const makeItem = (o: any) => ({
  id: 'x', name: 'x', role: 'veg', amount: 100, p: 0, f: 0, c: 0, kcal: 0, fiber: 0, ...o,
});

describe('§8.124 — овощ по природе продукта', () => {
  it('морковь с флагами микро-закрытия — овощ (80 г идут в ось)', () => {
    const carrot = makeItem({ id: 'carrot', amount: 80, p: 0.7, c: 6, kcal: 28, _microClosure: {}, _fixedGrams: 80 });
    expect(isRealVegItem(carrot)).toBe(true);
  });

  it('овощная зелень 5 г — тоже овощ по природе (граммы считаются честно)', () => {
    expect(isRealVegItem(makeItem({ id: 'parsley', amount: 5, p: 0.1, _microGap: true }))).toBe(true);
  });

  it('белок в овощном слоте (§8.88) овощем не считается', () => {
    expect(isRealVegItem(makeItem({ id: 'salmon', amount: 100, p: 20, f: 13 }))).toBe(false);
    expect(isRealVegItem(makeItem({ id: 'fish_white', amount: 100, p: 18 }))).toBe(false);
  });

  it('роль НЕ veg овощем не считается даже при низком белке', () => {
    expect(isRealVegItem(makeItem({ role: 'carb_slow', id: 'rice_white', amount: 100, p: 2.7 }))).toBe(false);
    expect(isRealVegItem(makeItem({ role: 'fruit', id: 'apple', amount: 100, p: 0.4 }))).toBe(false);
  });

  it('ось «овощ» считает морковь из микро-закрытия: 120 г + 80 г моркови = 200 г = 100 баллов', () => {
    const meals = [{
      type: 'lunch', items: [
        makeItem({ id: 'broccoli', amount: 120, p: 3.4, c: 8, kcal: 40, fiber: 3 }),
        makeItem({ id: 'carrot', amount: 80, p: 0.7, c: 6, kcal: 28, _microClosure: {}, _fixedGrams: 80 }),
      ],
    }, {
      type: 'dinner', items: [makeItem({ id: 'salmon', amount: 100, p: 20, f: 13, role: 'veg' })],
    }];
    const q = scoreDayQuality(meals as any[], { weightKg: 80 });
    expect(q.veg).toBe(100);
  });

  it('ось «овощ» не даёт балла за белок в овощном слоте', () => {
    const meals = [{
      type: 'lunch', items: [
        makeItem({ id: 'salmon', amount: 200, p: 40, f: 26, role: 'veg' }),
        makeItem({ id: 'spinach', amount: 100, p: 2.9, c: 3.6, kcal: 23, fiber: 2.2 }),
      ],
    }];
    const q = scoreDayQuality(meals as any[], { weightKg: 80 });
    expect(q.veg).toBe(50); // 100 г из 200 г
  });
});

const PROFILES = [
  { id: 'small60', w: 60, k: 1600, p: 150, f: 45 },
  { id: 'recomp80', w: 80, k: 2200, p: 200, f: 60 },
  { id: 'normal90', w: 90, k: 3000, p: 200, f: 80 },
  { id: 'p500', w: 110, k: 4600, p: 500, f: 120 },
];
const carbsFor = (p: any) => (p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4)));

const build = (p: any, mc: number, tr: boolean, manual: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: Math.round(p.w * 0.82), bodyFatPct: 18, sex: 'male',
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
} as unknown as MealPlanInput) as any;

describe('§8.124 (долг B18) — «гарнир — это зерно»: двух мелких носителей нет', () => {
  const cases: Array<[string, any, number, boolean, boolean]> = [
    ['small60/4/отд/руч', PROFILES[0], 4, false, true],
    ['recomp80/5/отд/руч', PROFILES[1], 5, false, true],
    ['normal90/4/тр/авт', PROFILES[2], 4, true, false],
    ['small60/5/тр/авт', PROFILES[0], 5, true, false],
    ['p500/3/отд/авт', PROFILES[3], 3, false, false],
    ['p500/3/отд/руч', PROFILES[3], 3, false, true],
  ];
  for (const [key, p, mc, tr, manual] of cases) {
    it(key, () => {
      const plan = build(p, mc, tr, manual);
      const st = starchDoubleStats(plan.meals || []);
      expect(st.small, `${key}: приёмов с малым вторым крахмалом`).toBe(0);
      expect(Number(plan.deviationPct)).toBeLessThanOrEqual(manual ? 2.01 : 3.01);
    });
  }

  // Замер 160 дней: на `p500/3–5/отд` снек держал `30 г кукурузных хлопьев + 30 г риса`
  // в ОБОИХ контурах — два мелких гарнира на одной тарелке. `stapleFamilyOf('corn_flakes')`
  // возвращает null, поэтому свёртка §8.108 их не видела. После §8.124 — один носитель.
  it('p500/3/отд: два мелких зерновых на тарелке не остаётся', () => {
    for (const manual of [false, true]) {
      const plan = build(PROFILES[3], 3, false, manual);
      for (const m of plan.meals || []) {
        const grains = ((m as any).items || []).filter((it: any) =>
          (it.role === 'carb_slow' || it.role === 'carb_fast')
          && /corn_flake|rice|cream_of_rice|grain_red_rice/.test(String(it.id)));
        expect(grains.length, `${manual ? 'руч' : 'авт'} ${m.type}: ${grains.map((x: any) => `${x.id}:${Math.round(Number(x.amount))}`).join(' + ')}`)
          .toBeLessThanOrEqual(1);
      }
    }
  });
});
