import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { itemSodiumMg, mealSodiumMg, naAfterResize, sumKnownNa } from '../planner-meal-sodium';
import { mergeSameIdItems, sumDayTotals, totalsAfterGramChange } from '../planner-recipe-mode';
import { correctDayToTargets } from '../day-target-corrector';
import { FOOD_DB } from '../../../../../core/nutrition-database';

/**
 * §8.143 п. 10 — единый читатель натрия и тоталы дня.
 *
 * Дефект, который держит замок (замер: `buildDayPlan`, 54 дня × 321 приём — расхождений
 * не нашлось, потому что `refreshItemSodium` стоит в конвейере; но читатель врал везде,
 * где граммы правили ПОСЛЕ него — ручные правки в UI, пересборки приёмов в контексте):
 *
 *  1) `itemSodiumMg` отдавал приоритет КЭШУ `item.na`. Кэш ставится один раз в `makeItem`,
 *     а `amount` дальше правят десятки проходов (баланс между приёмами, подрезка тарелки,
 *     добивки). Замер на «порцию ужали вдвое»: соль оставалась от прежней тарелки.
 *     Теперь количество берётся из ТЕКУЩЕГО `amount` (FOOD_DB — плотность, `na` — кэш);
 *     кэш остаётся фолбэком только там, где плотности в FOOD_DB нет (составные блюда,
 *     коктейли, ручные позиции).
 *  2) `sumDayTotals` пересобирал день без `na`: любая UI-пересборка дня стирала соль
 *     приёмов. Правило то же, что у `totalsAfterGramChange`: поле есть, только если оно
 *     известно хотя бы у одного приёма и сумма > 0; «не знаем» — поля нет, а не ноль.
 */

// Сыр чечил: Na 500 мг/100 г (FOOD_DB, micros.Na) — высокая плотность, ложный кэш виден сразу.
const CHEESE = 'cheese_chechil';
const CHEESE_NA_PER_100 = 500;

describe('§8.143 п. 10: itemSodiumMg — количество из текущего amount', () => {
  it('кэш от прежней порции не перебивает FOOD_DB × текущие граммы', () => {
    // 40 г сыра, а в кэше соль от 100-граммового куска.
    const stale = { id: CHEESE, amount: 40, na: CHEESE_NA_PER_100 };
    expect(itemSodiumMg(stale), 'FOOD_DB × 40 г = 200 мг, а не кэш 500').toBe(
      Math.round((CHEESE_NA_PER_100 * 40) / 100),
    );
  });

  it('составное блюдо без плотности в FOOD_DB читается из кэша', () => {
    expect(itemSodiumMg({ id: 'cocktail_house_blend', amount: 300, na: 120 })).toBe(120);
  });

  it('неизвестный id и без кэша — ноль (не выдуманное число)', () => {
    expect(itemSodiumMg({ id: 'unknown_food_xyz', amount: 100 })).toBe(0);
    expect(itemSodiumMg(undefined)).toBe(0);
  });

  it('нулевые/незаданные граммы: плотность ничего не даёт, валидный кэш остаётся источником', () => {
    // §10.6 (ревью): прежний код при amount = 0 возвращал 0 до фолбэка и терял соль
    // старой позиции без граммовки. Плотность × 0 — это 0 мг, но кэш `na` посчитан
    // на момент сборки и остаётся известным значением.
    expect(itemSodiumMg({ id: CHEESE, amount: 0, na: CHEESE_NA_PER_100 })).toBe(CHEESE_NA_PER_100);
    expect(itemSodiumMg({ id: CHEESE, na: CHEESE_NA_PER_100 })).toBe(CHEESE_NA_PER_100);
  });

  it('naAfterResize по-прежнему считает от FOOD_DB × новая граммовка', () => {
    expect(naAfterResize({ id: CHEESE, amount: 40, na: CHEESE_NA_PER_100 }, 20)).toBe(100);
  });
});

describe('§8.143 п. 10: mealSodiumMg — приём по позициям', () => {
  it('сумма позиций, округление до мг', () => {
    const meal = {
      items: [
        { id: CHEESE, amount: 20 },
        { id: 'cocktail_house_blend', amount: 200, na: 60 },
      ],
    };
    expect(mealSodiumMg(meal)).toBe(100 + 60);
  });

  it('пустой приём — фолбэк на totalsNa', () => {
    expect(mealSodiumMg({ items: [], totalsNa: 350 })).toBe(350);
  });

  // §10.6 (ревью): реальные вызовы передают приём как есть — тотал в `meal.totals.na`,
  // а не в плоском `totalsNa`. Прежний код этот путь не читал (фолбэк был мёртвым).
  it('реальная форма приёма: фолбэк на m.totals.na', () => {
    expect(
      mealSodiumMg({
        items: [{ id: 'unknown_food_xyz', amount: 100 }],
        totals: { na: 350 },
      }),
    ).toBe(350);
    expect(mealSodiumMg({ items: [], totals: { na: 120 } })).toBe(120);
  });

  // §8.143 п. 10 (ревью): позиции есть, но ни одна не дала известного значения
  // (нет плотности в базе, нет кэша) — известный тотал приёма честнее нуля.
  it('позиции без плотности и кэша — фолбэк на известный тотал, а не 0', () => {
    expect(
      mealSodiumMg({
        items: [
          { id: 'unknown_food_xyz', amount: 100 },
          { id: 'unknown_food_abc', amount: 50 },
        ],
        totalsNa: 350,
      }),
    ).toBe(350);
    expect(mealSodiumMg({ items: [{ id: 'unknown_food_xyz', amount: 100 }], totalsNa: 0 })).toBe(0);
  });
});

describe('§8.143 п. 10: sumDayTotals держит натрий дня', () => {
  it('день с известным натрием приёмов: na = сумма', () => {
    const meals = [
      { items: [], totals: { kcal: 500, p: 40, f: 10, c: 50, fiber: 5, na: 320 } },
      { items: [], totals: { kcal: 700, p: 50, f: 20, c: 70, fiber: 6, na: 480 } },
    ] as any[];
    expect(sumDayTotals(meals).na).toBe(800);
  });

  it('день без натрия в приёмах: поля нет (честное «не знаем»)', () => {
    const meals = [{ items: [], totals: { kcal: 500, p: 40, f: 10, c: 50, fiber: 5 } }] as any[];
    expect('na' in sumDayTotals(meals)).toBe(false);
  });

  it('натрий известен, но нулевой: поля нет, а не ноль-обещание', () => {
    const meals = [{ items: [], totals: { kcal: 500, p: 40, f: 10, c: 50, na: 0 } }] as any[];
    expect('na' in sumDayTotals(meals)).toBe(false);
  });
});

describe('§8.143 п. 10: totalsAfterGramChange — натрий из текущих позиций', () => {
  it('поле было и позиции известны → натрий из позиций', () => {
    const t = totalsAfterGramChange({
      items: [{ name: 'Чечил', id: CHEESE, amount: 40, kcal: 116, p: 8, f: 9.2, c: 0.8 }],
      totals: { kcal: 0, p: 0, f: 0, c: 0, na: 999 },
    } as any);
    expect(t.na, 'натрий = FOOD_DB × финальные граммы, а не прежнее 999').toBe(200);
  });

  // §10.6 (ревью): прежний гейт «поле было» навсегда терял соль у планов, импортированных
  // без `totals.na` (старые экспорты): позиции знали натрий, но каждая пересборка
  // отказывалась его записать. Сумма берётся из позиций, поэтому чужое число не переносится.
  it('поля не было, но позиции известны → натрий восстанавливается', () => {
    const t = totalsAfterGramChange({
      items: [{ name: 'Чечил', id: CHEESE, amount: 40, kcal: 116, p: 8, f: 9.2, c: 0.8 }],
      totals: { kcal: 0, p: 0, f: 0, c: 0 },
    } as any);
    expect(t.na).toBe(200);
  });

  it('поля не было и позиции неизвестны → поля нет (не ложный ноль)', () => {
    const t = totalsAfterGramChange({
      items: [{ name: 'Неизвестно', id: 'unknown_food_xyz', amount: 100, kcal: 40, p: 1, f: 1, c: 1 }],
      totals: { kcal: 40, p: 1, f: 1, c: 1 },
    } as any);
    expect('na' in t).toBe(false);
  });
});

// §8.143 п. 10 (ревью): `scaleItem` в рецептурном движке масштабирует макросы, но кэш `na`
// оставался от прежней порции — для составных блюд (где кэш — единственный источник соли)
// это возвращало ложную соль. Замок source-shape: правка снимает масштабирование → красный.
describe('§8.143 п. 10: scaleItem масштабирует кэш натрия', () => {
  it('в теле scaleItem есть naAfterResize(it, newAmount)', () => {
    const src = readFileSync(join(__dirname, '..', 'planner-recipe-mode.ts'), 'utf8');
    const start = src.indexOf('function scaleItem(');
    expect(start, 'scaleItem должен существовать').toBeGreaterThan(-1);
    const body = src.slice(start, start + 1600);
    expect(body).toMatch(/naAfterResize\(it, newAmount\)/);
  });
});

// §8.143 п. 10.7 (ревью-2, P3-3): свидетель для корректора дня — приём входит с натрием
// в ПОЗИЦИЯХ, а в `totals` поля нет (так выглядят старые планы/экспорты). Прежний гейт
// `hadNa` в `recalcMealTotals` оставлял день без натрия навсегда; теперь финальный проход
// `correctDayToTargets` пересчитывает его из позиций. Мутация «вернуть hadNa» → красный.
describe('§8.143 п. 10.7: корректор дня пишет na из позиций, даже если поля не было', () => {
  it('correctDayToTargets: totals без na + позиции с натрием → na равен сумме позиций', () => {
    const cheese = FOOD_DB.find((f) => f.id === CHEESE)!;
    expect(cheese, 'нужен продукт FOOD_DB с натрием').toBeTruthy();
    const mkMeal = (label: string, type: string) => {
      const p = Math.round((cheese.protein || 0) * 0.4 * 10) / 10;
      const f = Math.round((cheese.fat || 0) * 0.4 * 10) / 10;
      const c = Math.round((cheese.carbs || 0) * 0.4 * 10) / 10;
      return {
        label,
        type,
        items: [{ id: CHEESE, name: 'Чечил', amount: 40, kcal: Math.round(4 * p + 9 * f + 4 * c), p, f, c, fiber: 0 }],
        totals: { kcal: Math.round(4 * p + 9 * f + 4 * c), p, f, c, fiber: 0 },
      } as any;
    };
    const meals = [mkMeal('Завтрак', 'breakfast'), mkMeal('Обед', 'lunch')];
    const sum = (k: string) => meals.reduce((s: number, m: any) => s + (m.totals[k] || 0), 0);
    const res = correctDayToTargets(
      meals as any,
      {
        kcal: sum('kcal'),
        p: sum('p'),
        f: sum('f'),
        c: sum('c'),
      } as any,
    );
    const known = (res.meals as any[]).filter((m: any) => (m.items || []).some((i: any) => itemSodiumMg(i) > 0));
    expect(known.length, 'ни один приём с натрием в позициях не остался').toBeGreaterThan(0);
    for (const m of known) {
      expect(typeof m.totals?.na, `${m.label}: na должен появиться`).toBe('number');
      const expected = Math.round((m.items || []).reduce((s: number, i: any) => s + itemSodiumMg(i), 0));
      expect(
        Math.abs((m.totals.na || 0) - expected),
        `${m.label}: na ${m.totals?.na} vs сумма ${expected}`,
      ).toBeLessThanOrEqual(1);
    }
  });
});

// §8.143 п. 10.7 (ревью-3, S1): агрегаты дня/плана держат одно правило через ОДИН хелпер.
// Прежний замок проверял только текст вызова, поэтому сломанная логика суммирования
// (`sumNaOf`) не краснила ни один тест.
describe('§8.143 п. 10.7: sumKnownNa — единое правило агрегатов', () => {
  it('складывает только известные; отсутствие поля не мешает и не даёт ложный ноль', () => {
    const days = [{ totals: { na: 100 } }, { totals: {} }, { totals: { na: 250 } }];
    expect(sumKnownNa(days, (d) => d.totals)).toBe(350);
    expect(
      sumKnownNa([{ totals: {} }], (d) => d.totals),
      'неизвестно → 0, а не поле',
    ).toBe(0);
    expect(
      sumKnownNa<any>(null, (d) => d),
      'пустой список → 0',
    ).toBe(0);
    expect(sumKnownNa([{ totals: { na: 0.4 } }, { totals: { na: 0.4 } }], (d) => d.totals)).toBe(1);
  });
});

// §8.143 п. 10.7 (ревью-3, S1): слияние дублей внутри приёма — единственный путь, где кэш
// `na` второго экземпляра мог тихо исчезнуть (id вне FOOD_DB читается только из кэша).
describe('§8.143 п. 10.7: mergeSameIdItems суммирует кэш натрия', () => {
  const composite = (na?: number) =>
    ({
      id: 'zzz_composite_plate',
      name: 'Составное блюдо',
      amount: 100,
      kcal: 40,
      p: 4,
      f: 2,
      c: 3,
      ...(na != null ? { na } : {}),
    }) as any;

  it('две позиции с кэшем → одна позиция, na = сумма', () => {
    const meals: any[] = [{ items: [composite(20), composite(20)] }];
    mergeSameIdItems(meals as any);
    expect(meals[0].items).toHaveLength(1);
    expect(meals[0].items[0].amount).toBe(200);
    expect(meals[0].items[0].na, 'кэш второй позиции не теряется').toBe(40);
  });

  it('без кэшей поле не появляется (не ложный ноль)', () => {
    const meals: any[] = [{ items: [composite(), composite()] }];
    mergeSameIdItems(meals as any);
    expect('na' in meals[0].items[0]).toBe(false);
  });
});
