/**
 * food-search.engine.test.ts — замки локального поиска «Добавить еду».
 *
 * Тестируем на реальном FOOD_DB: пользователь ищет бытовыми словами
 * («ветчина», «мясо», «овсянка») и должен получать осмысленный список,
 * а не пустоту, и без мусора от fuzzy на коротких словах.
 */
import { describe, expect, it } from 'vitest';
import { FOOD_DB } from '../../core/nutrition-database';
import { normalizeFoodQuery, searchLocalFoods } from '../food-search.engine';

const names = (query: string, limit?: number) => searchLocalFoods(FOOD_DB, query, limit).map((m) => m.item.name);

const hasNameStartingWith = (list: string[], prefix: string) =>
  list.some((name) => name.toLowerCase().startsWith(prefix.toLowerCase()));

const hasName = (list: string[], needle: string) =>
  list.some((name) => name.toLowerCase().includes(needle.toLowerCase()));

describe('normalizeFoodQuery', () => {
  it('нижний регистр, ё→е, знаки и лишние пробелы схлопнуты', () => {
    expect(normalizeFoodQuery('  Ёж,   сыр!  ')).toBe('еж сыр');
    expect(normalizeFoodQuery('Свиной  окорок (ветчина)')).toBe('свиной окорок ветчина');
  });
});

describe('searchLocalFoods: бытовые слова', () => {
  it('«овсянка» находит и варёную овсянку, и сухие хлопья', () => {
    const list = names('овсянка');
    expect(hasNameStartingWith(list, 'Овсянка')).toBe(true);
    expect(hasNameStartingWith(list, 'Овсяные хлопья')).toBe(true);
    expect(hasName(list, 'Овсяные хлопья (сухие)')).toBe(true);
  });

  it('«ветчина» находит свиной окорок в FOOD_DB (варёная ветчина — в RU_DELI_FOODS)', () => {
    const list = names('ветчина');
    expect(hasName(list, 'Свиной окорок (ветчина сырая)')).toBe(true);
    // Готовая «Ветчина варёная» сознательно не в FOOD_DB: поиск дневника берёт её
    // из src/data/ru-deli-foods.ts (покрыто ru-deli-foods.test.ts), а автоплан —
    // только FOOD_DB, чтобы не сдвигать seeded-пулы §8.112/§8.128.
    expect(hasName(list, 'Ветчина варёная')).toBe(false);
  });

  it('«мясо» возвращает мясные позиции, а не пустоту', () => {
    const list = names('мясо', 100);
    const meat = list.filter((name) => /говядин|свин|курин|индейк/i.test(name));
    expect(meat.length).toBeGreaterThanOrEqual(3);
    expect(list.some((name) => /говядин/i.test(name))).toBe(true);
    expect(list.some((name) => /курин/i.test(name))).toBe(true);
  });

  it('«говядина» не подменяется курицей и свининой', () => {
    const list = names('говядина', 100);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((name) => /говядин|говяж/i.test(name))).toBe(true);
    // Отсекаем только «чистые» отрубы других видов; смешанные блюда (пельмени свинина+говядина)
    // действительно содержат говядину и остаются в выдаче.
    expect(list.filter((name) => /^(свин|курин|индейк|баранин)/i.test(name))).toEqual([]);
  });

  it('«свинина» не возвращает говядину', () => {
    const list = names('свинина', 100);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((name) => /свин/i.test(name))).toBe(true);
    expect(list.filter((name) => /^(говядин|говяж|курин)/i.test(name))).toEqual([]);
  });

  it('«сосиски» не выдаёт всю колбасу (обобщение несимметрично)', () => {
    const list = names('сосиски', 100);
    expect(list.length).toBeGreaterThan(0);
    expect(list.filter((name) => /колбас/i.test(name))).toEqual([]);
  });

  it('«курин» находит куриные позиции по префиксу слова', () => {
    const matches = searchLocalFoods(FOOD_DB, 'курин');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].item.name.toLowerCase()).toContain('курин');
    expect(matches[0].score).toBeLessThanOrEqual(2);
  });
});

describe('searchLocalFoods: опечатки и мусор', () => {
  it('«овсяннка» находит овсянку как fuzzy', () => {
    const matches = searchLocalFoods(FOOD_DB, 'овсяннка');
    const hit = matches.find((m) => m.item.name.toLowerCase().startsWith('овсянка'));
    expect(hit).toBeDefined();
    expect(hit?.reason).toBe('fuzzy');
  });

  it('«ыыы» не находит ничего (короткие слова без fuzzy)', () => {
    expect(names('ыыы')).toEqual([]);
  });

  it('запрос короче 2 символов и пустой ввод дают пустой список', () => {
    expect(names('')).toEqual([]);
    expect(names('  ')).toEqual([]);
    expect(names('я')).toEqual([]);
  });
});

describe('searchLocalFoods: порядок и лимит', () => {
  it('«хлеб» ставит сам хлеб выше хлебцев', () => {
    const list = names('хлеб', 100);
    const breadIndex = list.findIndex((name) => name.toLowerCase().startsWith('хлеб '));
    const crispIndex = list.findIndex((name) => name.toLowerCase() === 'хлебцы рисовые');
    expect(breadIndex).toBeGreaterThanOrEqual(0);
    expect(crispIndex).toBeGreaterThanOrEqual(0);
    expect(breadIndex).toBeLessThan(crispIndex);
  });

  it('limit соблюдается', () => {
    expect(names('мясо', 3)).toHaveLength(3);
    expect(searchLocalFoods(FOOD_DB, 'мясо', 2)).toHaveLength(2);
    expect(searchLocalFoods(FOOD_DB, 'мясо').length).toBeLessThanOrEqual(20);
  });

  it('детерминирован и не мутирует входной массив', () => {
    const sample = FOOD_DB.slice(0, 40);
    const before = sample.map((item) => item.id);
    const first = searchLocalFoods(sample, 'мясо').map((m) => m.item.id);
    const second = searchLocalFoods(sample, 'мясо').map((m) => m.item.id);
    expect(second).toEqual(first);
    expect(sample.map((item) => item.id)).toEqual(before);
  });

  it('ранжирование: exact > prefix > tokens > synonym > fuzzy', () => {
    const items = [
      { id: 'a', name: 'Овсяные хлопья' },
      { id: 'b', name: 'Овсянка' },
      { id: 'c', name: 'Овсянка, хлопья' },
      { id: 'd', name: 'Геркулес' },
    ];
    const matches = searchLocalFoods(items, 'овсянка');
    const order = matches.map((m) => m.item.id);
    expect(order[0]).toBe('b');
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
    expect(matches.find((m) => m.item.id === 'd')?.reason).toBe('synonym');
  });
});
