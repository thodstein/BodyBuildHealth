/**
 * usda-foods-integrity.test.ts — замок авто-генерируемого каталога USDA.
 *
 * `src/data/usda-foods.ts` генерируется вне репозитория (шапка
 * «Auto-generated from USDA SR28 RU database»), поэтому две вещи здесь ловятся
 * только тестом, а не кодом:
 *
 * 1. Полные дубли — записи, у которых все поля кроме `id` совпадают. Поиск продукта
 *    показывал две одинаковые строки (12 таких пар удалено 2026-11-24).
 * 2. Счётчик в шапке обязан совпадать с фактическим числом записей: он читается
 *    глазами и уже расходился с массивом.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { USDA_FOODS } from '../usda-foods';

const source = readFileSync(resolve(process.cwd(), 'src/data/usda-foods.ts'), 'utf8');

/** Канонический вид записи без `id`: порядок ключей (в т.ч. во вложенных объектах) не важен. */
function canon(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => k !== 'id')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canon(v)]),
    );
  }
  return value;
}

describe('каталог USDA: целостность данных', () => {
  it('счётчик в шапке равен числу записей', () => {
    const m = source.match(/(\d+)\s+food products in BodyBuildHealth FoodItem format/);
    expect(
      m,
      'шапка файла должна содержать строку «N food products in BodyBuildHealth FoodItem format»',
    ).not.toBeNull();
    expect(Number(m![1])).toBe(USDA_FOODS.length);
  });

  it('нет полных дублей: все поля, кроме id, совпадают', () => {
    const firstId = new Map<string, string>();
    const dups: string[] = [];
    for (const food of USDA_FOODS) {
      const key = JSON.stringify(canon(food));
      const seen = firstId.get(key);
      if (seen) dups.push(`${seen} = ${food.id}`);
      else firstId.set(key, food.id);
    }
    expect(dups).toEqual([]);
  });
});
