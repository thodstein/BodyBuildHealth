/**
 * planner-plan-write.test.ts — B3 и B8 (аудит 2026-10).
 *
 * B3: «Добавить план в дневник» при повторном нажатии/перегенерации дублировало
 *     записи, потому что позиции не помечались стабильным тегом.
 * B8: правки приёма из 3-дневного/недельного вида терялись — они уходили в `dayPlan`
 *     (копию видимого дня), а не в свой день плана.
 */
import { describe, it, expect } from 'vitest';
import {
  mergePlanDayIntoDiary,
  shouldMirrorToDayPlan,
  writeMealsToPlanDay,
  sumPlanDaysTotals,
} from '../planner-plan-write';

const day = (items: any[], label = 'Завтрак') => {
  const mealTotals = {
    kcal: items.reduce((s, i) => s + (i.kcal || 0), 0),
    p: items.reduce((s, i) => s + (i.p || 0), 0),
    f: items.reduce((s, i) => s + (i.f || 0), 0),
    c: items.reduce((s, i) => s + (i.c || 0), 0),
    fiber: items.reduce((s, i) => s + (i.fiber || 0), 0),
    leucine_mg: items.reduce((s, i) => s + (i.leucine_mg || 0), 0),
  };
  return {
    meals: [{ label, items, totals: { ...mealTotals } }],
    totals: { ...mealTotals },
  };
};

const oats = { id: 'oats_dry', name: 'Овсянка', amount: 60, kcal: 220, p: 7.5, f: 4.2, c: 37, fiber: 6 };
const chicken = { id: 'chicken_breast', name: 'Курица', amount: 150, kcal: 165, p: 34.5, f: 3, c: 0 };

describe('B3: перенос плана в дневник идемпотентен', () => {
  it('первый вызов добавляет позиции, второй — только пропускает', () => {
    const diary: Record<string, any> = {};
    const r1 = mergePlanDayIntoDiary(diary, day([oats, chicken]), '2026-10-29');
    expect(r1).toEqual({ added: 2, skipped: 0 });
    const r2 = mergePlanDayIntoDiary(diary, day([oats, chicken]), '2026-10-29');
    expect(r2).toEqual({ added: 0, skipped: 2 });
    // В дневнике ровно две записи, без дублей.
    expect(diary['2026-10-29'].meals['Завтрак']).toHaveLength(2);
  });

  it('позиции получают стабильный тег plan:дата:приём:продукт:граммы', () => {
    const diary: Record<string, any> = {};
    mergePlanDayIntoDiary(diary, day([oats]), '2026-10-29');
    expect(diary['2026-10-29'].meals['Завтрак'][0].planTag).toBe('plan:2026-10-29:Завтрак:oats_dry:60');
  });

  it('изменённая граммовка — это новая позиция, а не дубль старой', () => {
    const diary: Record<string, any> = {};
    mergePlanDayIntoDiary(diary, day([oats]), '2026-10-29');
    const r = mergePlanDayIntoDiary(diary, day([{ ...oats, amount: 80 }]), '2026-10-29');
    expect(r).toEqual({ added: 1, skipped: 0 });
    expect(diary['2026-10-29'].meals['Завтрак']).toHaveLength(2);
  });

  it('разные даты не конфликтуют', () => {
    const diary: Record<string, any> = {};
    mergePlanDayIntoDiary(diary, day([oats]), '2026-10-29');
    const r = mergePlanDayIntoDiary(diary, day([oats]), '2026-10-30');
    expect(r).toEqual({ added: 1, skipped: 0 });
  });

  it('пустой день ничего не пишет и не создаёт пустую дату', () => {
    const diary: Record<string, any> = {};
    expect(mergePlanDayIntoDiary(diary, { meals: [] }, '2026-10-29')).toEqual({ added: 0, skipped: 0 });
    expect(diary['2026-10-29']).toBeUndefined();
  });

  it('сохраняет уже введённые вручную записи того же приёма', () => {
    const diary: Record<string, any> = { '2026-10-29': { meals: { 'Завтрак': [{ name: 'Кофе', qty: '200 мл', kcal: 5 }] } } };
    mergePlanDayIntoDiary(diary, day([oats]), '2026-10-29');
    expect(diary['2026-10-29'].meals['Завтрак']).toHaveLength(2);
    expect(diary['2026-10-29'].meals['Завтрак'][0].name).toBe('Кофе');
  });
});

describe('B8: правки адресуются конкретному дню плана', () => {
  const plan = () => ({
    days: [day([oats]), day([chicken]), day([oats])],
    totals: { kcal: 0, p: 0, f: 0, c: 0 },
  });

  it('writeMealsToPlanDay пишет ровно в указанный день', () => {
    const src = plan();
    const next = writeMealsToPlanDay(src, 1, (meals) => {
      meals[0].items.push({ id: 'rice_white', name: 'Рис', amount: 100, kcal: 344, p: 7, f: 0.6, c: 78, fiber: 1.5 });
      return meals;
    });
    expect(next).not.toBeNull();
    // День 1 изменён, дни 0 и 2 — нет.
    expect(next!.days[1].meals[0].items).toHaveLength(2);
    expect(next!.days[0].meals[0].items).toHaveLength(1);
    expect(next!.days[2].meals[0].items).toHaveLength(1);
    // Исходный план не мутирован (React-состояние не портим).
    expect(src.days[1].meals[0].items).toHaveLength(1);
  });

  it('итоги дня и плана пересчитываются при записи', () => {
    const src = plan();
    const next = writeMealsToPlanDay(src, 0, (meals) => {
      const rice = { id: 'rice_white', name: 'Рис', amount: 100, kcal: 344, p: 7, f: 0.6, c: 78, fiber: 1.5 };
      meals[0].items.push(rice);
      // Реальные call-sites (updateMealTime/duplicateMeal) пересчитывают итоги приёма
      // сами — хелпер складывает уже готовые итоги приёмов.
      meals[0].totals = {
        ...meals[0].totals,
        kcal: meals[0].totals.kcal + rice.kcal,
        p: meals[0].totals.p + rice.p,
        f: meals[0].totals.f + rice.f,
        c: meals[0].totals.c + rice.c,
        fiber: meals[0].totals.fiber + rice.fiber,
      };
      return meals;
    })!;
    expect(next.days[0].totals.kcal).toBe(220 + 344);
    expect(next.totals.kcal).toBe(next.days.reduce((s: number, d: any) => s + d.totals.kcal, 0));
  });

  it('несуществующий день → null, план не создаётся «на пустом месте»', () => {
    expect(writeMealsToPlanDay(plan(), 5, (m) => m)).toBeNull();
    expect(writeMealsToPlanDay(null, 0, (m) => m)).toBeNull();
    expect(writeMealsToPlanDay({ days: [] }, 0, (m) => m)).toBeNull();
  });

  it('sumPlanDaysTotals складывает итоги всех дней', () => {
    const t = sumPlanDaysTotals([{ totals: { kcal: 100, p: 10, f: 5, c: 8 } }, { totals: { kcal: 200, p: 20, f: 7, c: 9 } }]);
    expect(t).toEqual({ kcal: 300, p: 30, f: 12, c: 17 });
  });

  it('зеркалим правку в dayPlan только для ОТКРЫТОГО дня', () => {
    // Открыт день 1 трёхдневного плана — правка дня 1 зеркалится.
    expect(shouldMirrorToDayPlan('three', 1, null, 1)).toBe(true);
    // Правка другого дня НЕ должна перетирать открытый день.
    expect(shouldMirrorToDayPlan('three', 0, null, 1)).toBe(false);
    // Ничего не открыто — зеркалить некуда.
    expect(shouldMirrorToDayPlan('three', 1, null, null)).toBe(false);
    // Неделя: открыт день 4 — зеркалим только его, и 3-дневный флаг не участвует.
    expect(shouldMirrorToDayPlan('week', 4, 4, 2)).toBe(true);
    expect(shouldMirrorToDayPlan('week', 2, 4, 2)).toBe(false);
    expect(shouldMirrorToDayPlan('week', 4, null, 4)).toBe(false);
  });
});
