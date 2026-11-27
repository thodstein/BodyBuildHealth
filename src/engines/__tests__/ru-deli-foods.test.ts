/**
 * ru-deli-foods.test.ts — бытовая гастрономия в поиске дневника, но не в автоплане.
 *
 * Зачем отдельный каталог (факт, замеренный 2026-11-27): автоплан строит пулы 1-в-1 из
 * FOOD_DB и сеет выбор по индексу пула. Даже ОДНА новая позиция в FOOD_DB (проверено клоном
 * pork_loin с корректными КБЖУ) ломает замок planner-portion-hygiene-8112 («второй гарнир в
 * малом виде» на 45/3/R/maint), а девять — ещё и канон 3 % (§8.112/§8.128/peri-sync).
 * Поэтому записи живут в RU_DELI_FOODS: поиск дневника их видит, генератор — нет.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FOOD_DB } from '../../core/nutrition-database';
import { RU_DELI_FOODS } from '../../data/ru-deli-foods';
import { searchLocalFoods } from '../food-search.engine';

const names = (query: string, limit = 8) =>
  searchLocalFoods(RU_DELI_FOODS as never[], query, limit).map((m) => m.item.name);

const source = readFileSync(join(process.cwd(), 'src/data/ru-deli-foods.ts'), 'utf8');

describe('RU_DELI_FOODS: каталог вне FOOD_DB', () => {
  it('id уникальны и не пересекаются с FOOD_DB (пулы автоплана не сдвигаются)', () => {
    const ids = RU_DELI_FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dbIds = new Set(FOOD_DB.map((f) => String(f.id)));
    expect(ids.filter((id) => dbIds.has(id))).toEqual([]);
  });

  it('нет дублей по названию с FOOD_DB (один продукт — один источник правды)', () => {
    const dbNames = new Set(FOOD_DB.map((f) => f.name.trim().toLowerCase()));
    const dupes = RU_DELI_FOODS.filter((f) => dbNames.has(f.name.trim().toLowerCase())).map((f) => f.name);
    expect(dupes).toEqual([]);
  });

  it('КБЖУ согласованы с Атвотэром (расхождение ≤ 8 %) — числа не выдуманы', () => {
    const off = RU_DELI_FOODS.map((f) => {
      const atwater = 4 * (f.protein || 0) + 9 * (f.fat || 0) + 4 * (f.carbs || 0);
      const pct = f.kcal > 0 ? (Math.abs(atwater - f.kcal) / f.kcal) * 100 : 100;
      return { id: f.id, pct: Number(pct.toFixed(2)) };
    }).filter((x) => x.pct > 8);
    expect(off).toEqual([]);
  });

  it('у каждой позиции есть реальный fdcId в комментарии рядом с записью', () => {
    for (const f of RU_DELI_FOODS) {
      const at = source.indexOf(`id: '${f.id}'`);
      expect(at, f.id).toBeGreaterThan(-1);
      // Комментарий с источником стоит непосредственно перед объектом.
      const window = source.slice(Math.max(0, at - 400), at);
      expect(/FDC \d{5,7}/.test(window), `${f.id}: нет fdcId в комментарии`).toBe(true);
    }
  });
});

describe('RU_DELI_FOODS: бытовые запросы находят продукт', () => {
  it('«ветчина» → варёная ветчина', () => {
    expect(names('ветчина')).toContain('Ветчина варёная');
  });

  it('«сардельки» → сардельки', () => {
    expect(names('сардельки')).toContain('Сардельки');
  });

  it('«лопатка» → запечённая свинина (лопатка)', () => {
    expect(names('лопатка')).toContain('Свинина запечённая (лопатка)');
  });

  it('«колбаса» находит полукопчёную', () => {
    const found = names('колбаса', 8);
    expect(found).toContain('Колбаса полукопчёная');
  });
});
