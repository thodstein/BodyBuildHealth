/**
 * fiber-foods.test.ts — сухая клетчатка в поиске дневника, но не в автоплане.
 *
 * Каталог живёт вне FOOD_DB по той же причине, что и бытовая гастрономия
 * (см. src/data/ru-deli-foods.test.ts): автоплан строит пулы 1-в-1 из FOOD_DB
 * и сеет выбор по индексу пула, поэтому любая новая позиция в FOOD_DB сдвигает
 * seeded-пики и валит planner-замки. Поиск дневника каталог видит.
 *
 * Числа — USDA FoodData Central, fdcId стоит комментарием рядом с каждой
 * записью: псиллиум 75 г клетчатки на 100 г (FDC 1965203), пшеничные отруби
 * 42.8 г на 100 г (FDC 169722).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FOOD_DB } from '../../core/nutrition-database';
import { FIBER_FOODS } from '../../data/fiber-foods';
import { searchLocalFoods } from '../food-search.engine';

const names = (query: string, limit = 10) =>
  searchLocalFoods(FIBER_FOODS as never[], query, limit).map((m) => m.item.name);

const source = readFileSync(join(process.cwd(), 'src/data/fiber-foods.ts'), 'utf8');

describe('FIBER_FOODS: каталог вне FOOD_DB', () => {
  it('id уникальны и не пересекаются с FOOD_DB (пулы автоплана не сдвигаются)', () => {
    const ids = FIBER_FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dbIds = new Set(FOOD_DB.map((f) => String(f.id)));
    expect(ids.filter((id) => dbIds.has(id))).toEqual([]);
  });

  it('нет дублей по названию с FOOD_DB (один продукт — один источник правды)', () => {
    const dbNames = new Set(FOOD_DB.map((f) => f.name.trim().toLowerCase()));
    const dupes = FIBER_FOODS.filter((f) => dbNames.has(f.name.trim().toLowerCase())).map((f) => f.name);
    expect(dupes).toEqual([]);
  });

  it('у всех позиций есть клетчатка (иначе это не каталог клетчатки)', () => {
    const empty = FIBER_FOODS.filter((f) => !(Number(f.fiber) > 0)).map((f) => f.id);
    expect(empty).toEqual([]);
  });

  it('у каждой позиции есть реальный fdcId в комментарии рядом с записью', () => {
    for (const f of FIBER_FOODS) {
      const at = source.indexOf(`id: '${f.id}'`);
      expect(at, f.id).toBeGreaterThan(-1);
      // Комментарий с источником стоит непосредственно перед объектом.
      const window = source.slice(Math.max(0, at - 400), at);
      expect(/FDC \d{5,7}/.test(window), `${f.id}: нет fdcId в комментарии`).toBe(true);
    }
  });

  it('типовая порция в разумных пределах 2..20 г (порошок/отруби, а не тарелка)', () => {
    const off = FIBER_FOODS.filter((f) => !(Number(f.defaultPortion) >= 2 && Number(f.defaultPortion) <= 20)).map(
      (f) => `${f.id}: ${String(f.defaultPortion)}`,
    );
    expect(off).toEqual([]);
  });

  it('клетчатка на 100 г — по FDC: псиллиум 75, отруби 42.8', () => {
    expect(FIBER_FOODS.find((f) => f.id === 'psyllium_husk_powder')?.fiber).toBe(75);
    expect(FIBER_FOODS.find((f) => f.id === 'wheat_bran_dry')?.fiber).toBe(42.8);
  });
});

describe('FIBER_FOODS: бытовые запросы находят продукт', () => {
  it('«клетчатка» → обе позиции', () => {
    const found = names('клетчатка');
    expect(found).toContain('Псиллиум (шелуха, порошок)');
    expect(found).toContain('Пшеничные отруби (сухая клетчатка)');
  });

  it('«псиллиум» → порошок шелухи', () => {
    expect(names('псиллиум')).toContain('Псиллиум (шелуха, порошок)');
  });

  it('«отруби» → пшеничные отруби', () => {
    expect(names('отруби')).toContain('Пшеничные отруби (сухая клетчатка)');
  });

  it('«порошок» → псиллиум', () => {
    expect(names('порошок')).toContain('Псиллиум (шелуха, порошок)');
  });

  it('«сухая клетчатка» → отруби', () => {
    expect(names('сухая клетчатка')).toContain('Пшеничные отруби (сухая клетчатка)');
  });
});
