/**
 * planner-restrictions-hygiene.test.ts — P1/P2-фиксы дрейфа id и мёртвых ограничений (Этап 5).
 *
 *  1. min_processed исключает реальные fast_food-продукты (был список из 16 фантомных id).
 *  2. high-oxalate токены матчат реальные id (almond/cashew/hazelnut, а не nuts_almonds).
 *  3. source-guard: ни один id в MIN_PROCESSED_IDS/HEALTH-пути не является фантомом безвредно.
 */
import { describe, it, expect } from 'vitest';
import { resolveDietRestrictionIds } from '../planner-restrictions';
import { filterByIntolerance } from '../planner-preferences';
import { FOOD_DB } from '../../../../../core/nutrition-database';

describe('P1: min_processed реально исключает мусор', () => {
  it('fast_food-продукты исключены, чистая еда — нет', () => {
    const ids = resolveDietRestrictionIds(FOOD_DB, ['min_processed']);
    expect(ids.has('kfc_wings')).toBe(true);
    expect(ids.has('mcd_big_mac')).toBe(true);
    expect(ids.has('bk_whopper')).toBe(true);
    expect(ids.has('vt_fries')).toBe(true);
    expect(ids.has('salmon')).toBe(false);
    expect(ids.has('broccoli')).toBe(false);
    // Все исключённые id обязаны существовать в FOOD_DB (ноль фантомов).
    const all = new Set(FOOD_DB.map(f => f.id));
    for (const id of ids) expect(all.has(id)).toBe(true);
  });
});

describe('P2: high-oxalate матчит реальные id', () => {
  const food = (id: string) => FOOD_DB.find(f => f.id === id) || ({ id, name: id } as any);
  it('миндаль/кешью исключаются при lowOxalate', () => {
    expect(filterByIntolerance(food('almonds'), { lowOxalate: true } as any)).toBe(false);
    expect(filterByIntolerance(food('cashew'), { lowOxalate: true } as any)).toBe(false);
  });
  it('курица/рис не исключаются', () => {
    expect(filterByIntolerance(food('chicken_breast'), { lowOxalate: true } as any)).toBe(true);
    expect(filterByIntolerance(food('rice_white'), { lowOxalate: true } as any)).toBe(true);
  });
});
