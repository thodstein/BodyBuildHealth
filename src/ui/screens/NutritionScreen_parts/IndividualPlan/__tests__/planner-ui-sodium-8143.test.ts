/**
 * planner-ui-sodium-8143.test.ts — §8.143 п. 10: UI-пересборка приёмов не теряет натрий.
 *
 * Дефект: UI-модули пересобирали тоталы приёмов через `sumMealTotals`, который НЕ знает
 * натрия. Известный `totals.na` приёма исчезал после правок (быстрые контролы недели,
 * замена/снятие рецепта, импорт плана, замена продукта). Плюс снимок плана
 * (`IndividualPlanContext`, DayPlanV2 → legacy) писал `na: m?.totals?.na || 0` — при
 * отсутствии поля это ложный ноль, хотя позиции натрий несут.
 *
 * Замки держат: (1) функциональный свидетель импорта плана, (2) день-сумма,
 * (3) source-shape — чтобы `totals: sumMealTotals(` и `|| 0` не вернулись.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { getMicroFromFood } from '../planner-micro-reader';
import { mealSodiumMg } from '../planner-meal-sodium';
import { _normalizeImportedPlan } from '../IndividualPlanResults';

const read = (name: string) => readFileSync(join(__dirname, '..', name), 'utf8');

/** Продукт FOOD_DB с реальным натрием — плотность Na берётся из базы, не из теста. */
const sodiumFood = FOOD_DB.find((f) => (Number(getMicroFromFood(f as any, 'Na')) || 0) > 50);

const mkItem = (amount: number) => ({
  id: sodiumFood!.id,
  name: sodiumFood!.name,
  amount,
  kcal: Math.round((sodiumFood!.kcal || 0) * (amount / 100)),
  p: Math.round((sodiumFood!.protein || 0) * (amount / 100) * 10) / 10,
  f: Math.round((sodiumFood!.fat || 0) * (amount / 100) * 10) / 10,
  c: Math.round(((sodiumFood as any).carbs || 0) * (amount / 100) * 10) / 10,
  fiber: 0,
});

describe('§8.143 п. 10: import плана сохраняет натрий приёма', () => {
  it('есть продукт FOOD_DB с натрием (иначе тест бессмыслен)', () => {
    expect(sodiumFood).toBeTruthy();
  });

  it('_normalizeImportedPlan: totals.na приёма = натрий по позициям (не undefined)', () => {
    const item = mkItem(200);
    // totals.na здесь известен; на старом коде `sumMealTotals` его терял → undefined.
    const plan = {
      meals: [
        {
          label: 'Обед',
          items: [item],
          totals: { kcal: item.kcal, p: item.p, f: item.f, c: item.c, fiber: 0, na: 777 },
        },
      ],
      totals: { kcal: item.kcal, p: item.p, f: item.f, c: item.c, fiber: 0, na: 777 },
    };
    const n = _normalizeImportedPlan(plan as any);
    const na = n.meals[0].totals.na;
    expect(typeof na).toBe('number');
    expect(na).toBeGreaterThan(0);
    expect(Math.abs(Number(na) - mealSodiumMg(n.meals[0]))).toBeLessThanOrEqual(1);
  });
});

describe('§8.143 п. 10: sumDayTotals дня держит натрий', () => {
  const baseMeals = () => {
    const a = mkItem(100);
    const b = mkItem(150);
    return [
      { label: 'Завтрак', items: [a], totals: { kcal: a.kcal, p: a.p, f: a.f, c: a.c, fiber: 0, na: 400 } },
      { label: 'Ужин', items: [b], totals: { kcal: b.kcal, p: b.p, f: b.f, c: b.c, fiber: 0, na: 650 } },
    ];
  };

  it('план с na у приёмов → n.totals.na = сумма (±1)', () => {
    const n = _normalizeImportedPlan({ meals: baseMeals() } as any);
    expect(typeof n.totals.na).toBe('number');
    // каждый приём после нормализации несёт натрий по позициям; день = их сумма
    expect(typeof n.meals[0].totals.na).toBe('number');
    expect(typeof n.meals[1].totals.na).toBe('number');
    const sum = Number(n.meals[0].totals.na) + Number(n.meals[1].totals.na);
    expect(Math.abs(Number(n.totals.na) - sum)).toBeLessThanOrEqual(1);
  });

  // §10.6 (ревью): гейт «поле было» отменён — натрий пересчитывается из позиций, поэтому
  // импорт старого плана без `totals.na` больше не теряет соль навсегда.
  it('план без na у приёмов, но позиции знают натрий → na восстановлен', () => {
    const meals = baseMeals().map((m) => {
      const totals = { ...(m.totals as any) };
      delete totals.na;
      return { ...m, totals };
    });
    const n = _normalizeImportedPlan({ meals } as any);
    expect(typeof n.meals[0].totals.na).toBe('number');
    expect(Number(n.meals[0].totals.na)).toBeGreaterThan(0);
    expect(Math.abs(Number(n.totals.na) - (n.meals[0].totals.na + n.meals[1].totals.na))).toBeLessThanOrEqual(1);
  });

  it('план без na и без известных позиций → поля na нет (не ложный ноль)', () => {
    const unknown = (amount: number) => ({ id: 'unknown_food_xyz', amount, kcal: 100, p: 1, f: 1, c: 1 });
    const meals = [
      { label: 'Завтрак', items: [unknown(100)], totals: { kcal: 100, p: 1, f: 1, c: 1, fiber: 0 } },
      { label: 'Ужин', items: [unknown(150)], totals: { kcal: 150, p: 1, f: 1, c: 1, fiber: 0 } },
    ];
    const n = _normalizeImportedPlan({ meals } as any);
    expect('na' in n.meals[0].totals).toBe(false);
    expect('na' in n.totals).toBe(false);
  });
});

describe('§8.143 п. 10: source-shape замки (регресс к sumMealTotals/|| 0)', () => {
  // Замок 1: ни один UI-модуль снова не собирает тоталы приёма через sumMealTotals
  // (хелпер не знает натрия → totals.na исчезает после правок).
  it('нет `totals: sumMealTotals(` в трёх UI-модулях', () => {
    for (const f of ['IndividualPlanContext.tsx', 'MealQuickControls.tsx', 'IndividualPlanResults.tsx']) {
      expect(read(f)).not.toMatch(/totals:\s*sumMealTotals\(/);
    }
  });

  // Замок 2: снимок плана больше не пишет ложный ноль молча — натрий приёма считается
  // по позициям через mealSodiumMg.
  it('IndividualPlanContext: нет `m?.totals?.na || 0`, есть mealSodiumMg(', () => {
    const src = read('IndividualPlanContext.tsx');
    expect(src).not.toMatch(/m\?\.totals\?\.na \|\| 0/);
    expect(src).toMatch(/mealSodiumMg\(/);
  });
});

// §8.143 п. 10 (ревью): самые частые UI-пути — правка граммов, drag&drop, «Автокоррекция»,
// ужатие перекусов, быстрые контролы приёма — раньше собирали тоталы своей формулой без
// натрия. Каждая такая пересборка стирала `totals.na`; теперь `na` пересчитывается из
// текущих позиций и пишется при сумме > 0 (§10.6, гейт «поле было» снят).
describe('§8.143 п. 10 (ревью): частые UI-пересборки держат натрий', () => {
  it('calcItemTotals / calcMealTotals / calcDaysTotals считают na', () => {
    const src = read('IndividualPlanContext.tsx');
    const at = (name: string) => {
      const i = src.indexOf(`const ${name} =`);
      expect(i, `${name} должен существовать`).toBeGreaterThan(-1);
      return src.slice(i, i + 1000);
    };
    expect(at('calcItemTotals')).toMatch(/itemSodiumMg\(i\)/);
    expect(at('calcMealTotals')).toMatch(/na: naSum/);
    expect(at('calcDaysTotals')).toMatch(/na: naSum/);
  });

  it('«Автокоррекция» (applyTo) переносит na приёмов и дня', () => {
    const src = read('IndividualPlanContext.tsx');
    const i = src.indexOf('const applyTo = (plan: any)');
    expect(i, 'applyTo должен существовать').toBeGreaterThan(-1);
    const body = src.slice(i, i + 1600);
    expect(body).toMatch(/next\.totals\.na = m\.totals\.na/);
  });

  // §10.6 (ревью): `sumMultiTotals` пересобирал итоги недели/трёхдневки без натрия —
  // дубль приёма, смена времени и смена варианта рецепта гасили `na` плана, хотя
  // видимый день его сохранял (один день жил в двух состояниях).
  it('sumMultiTotals держит na дней', () => {
    const src = read('IndividualPlanContext.tsx');
    const i = src.indexOf('const sumMultiTotals =');
    expect(i, 'sumMultiTotals должен существовать').toBeGreaterThan(-1);
    const body = src.slice(i, i + 900);
    expect(body).toContain('t.na = naSum');
    // §10.7 (ревью-3, S1): суммирует не своя копия фильтра, а общий `sumKnownNa`.
    expect(body).toContain('sumKnownNa(days, (d: any) => d?.totals)');
  });

  it('MealQuickControls: тоталы через хелперы, своей сборки нет', () => {
    const src = read('MealQuickControls.tsx');
    expect(src).not.toMatch(/const totals = \{ kcal:/);
    expect(src).toMatch(/totalsAfterGramChange\(\{ items, totals: m\.totals \}\)/);
  });
});

// §8.143 п. 10.7 (ревью-2): две дыры того же класса — сгенерированный план не имел натрия
// ни на уровне дня, ни в 3/7-дневных агрегатах (и после первой правки дня недельный итог
// становился «частичной суммой известных дней»), а замена продукта наследовала кэш `na`
// ПРЕЖНЕГО продукта (у 950/1354 продуктов плотности в `micros.Na` нет — §10.4).
describe('§8.143 п. 10.7 (ревью-2): сгенерированный план и замена продукта', () => {
  it('buildOneDay: день несёт известный na (обе ветки totals)', () => {
    const src = read('IndividualPlanContext.tsx');
    // Якорь — уникальный идентификатор, а не отступ/перевод строки (ревью-3, S3: реформат
    // блока не должен красить замок при целой правке).
    const i = src.indexOf('totals: _hasFinalTotals');
    expect(i, 'возврат buildOneDay должен существовать').toBeGreaterThan(-1);
    const body = src.slice(i, i + 1800);
    expect(body).toContain("typeof _finalDayTotals.na === 'number' && _finalDayTotals.na > 0");
    expect(body).toContain('{ na: _finalDayTotals.na }');
    expect(body).toContain("typeof (v2.totals as any).na === 'number'");
    expect(body).toContain('{ na: (v2.totals as any).na }');
  });

  it('3/7-дневные агрегаты несут na дней (гейт > 0)', () => {
    const src = read('IndividualPlanContext.tsx');
    expect(src).toContain('sumNaOf([d1, d2, d3], (d: any) => d?.totals)');
    expect(src).toContain('sumNaOf(weekDays, (d: any) => d?.totals)');
    // Оба агрегата пишут поле одним гейтом; «>= 2», чтобы будущий месячный агрегат не красил.
    expect((src.match(/if \(_na > 0\) t\.na = _na;/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('replaceFoodItem: кэш na считается от нового продукта, не наследуется', () => {
    const src = read('IndividualPlanContext.tsx');
    expect(src).toContain(
      'const _replNa = itemSodiumMg({ id: newFood.id, amount: grams, na: (newFood as any).na } as any);',
    );
    expect(src).toContain('if (_replNa > 0) (replacement as any).na = _replNa;');
    expect(src).toContain('else delete (replacement as any).na;');
  });

  it('MealComposer: сумма плана через sumPlanDaysTotals, своей сборки не осталось', () => {
    const src = read('MealComposer.tsx');
    expect(src).toMatch(/const allTotals = sumPlanDaysTotals\(days\);/);
    expect(src).not.toMatch(/const allTotals = \{ kcal: days\.reduce/);
  });

  // §8.143 п. 10.7 (ревью-3, S2): замена из подсказки проблем писала `na: 0` безусловно —
  // «известный ноль» запрещал фолбэк на тотал приёма. Правило теперь общее с `replaceFoodItem`.
  it('IndividualPlanResults: замена не пишет ложный na: 0', () => {
    const src = read('IndividualPlanResults.tsx');
    expect(src).not.toContain('na: itemSodiumMg({ id: targetFood.id');
    expect(src).toContain('if (_naNext <= 0) delete _nextItem.na;');
  });

  it('сумма натрия дня/плана идёт через общий sumKnownNa (копий правила не осталось)', () => {
    const ctx = read('IndividualPlanContext.tsx');
    expect(ctx).toContain('const sumNaOf = (list: any[], pick: (x: any) => any) => sumKnownNa(list, pick);');
    // Ревью-3, S1: у `sumMultiTotals` и `applyTo` были свои копии фильтра известных —
    // поломка в копии не краснила ни один тест; теперь оба на хелпере.
    expect(ctx).toContain('const naSum = sumKnownNa(days, (d: any) => d?.totals);');
    expect(ctx).toContain('const naSum = sumKnownNa(meals, (m: any) => m?.totals);');
    expect(ctx).not.toContain(".filter((d: any) => typeof d?.totals?.na === 'number')");
    const results = read('IndividualPlanResults.tsx');
    expect(results).toContain('const naSum = sumKnownNa(days, (d: any) => d?.totals);');
    expect(results).not.toContain(".filter((d: any) => typeof d?.totals?.na === 'number')");
  });
});
