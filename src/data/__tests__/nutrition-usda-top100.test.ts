import { describe, expect, it } from 'vitest';
import { FOOD_DB } from '../../core/nutrition-database';
import { USDA_TOP100_FIXTURE } from './nutrition-usda-top100.fixture';

describe('A3: USDA reference anchors for planner staples', () => {
  it('contains at least 30 high-frequency food anchors', () => {
    expect(Object.keys(USDA_TOP100_FIXTURE).length).toBeGreaterThanOrEqual(30);
  });

  it('matches every available anchor within its USDA range', () => {
    const missing: string[] = [];
    const outliers: string[] = [];
    for (const [id, ref] of Object.entries(USDA_TOP100_FIXTURE)) {
      const food = FOOD_DB.find(item => item.id === id);
      if (!food) { missing.push(id); continue; }
      const values: Array<[string, number, [number, number]]> = [
        ['kcal', food.kcal, ref.kcal], ['protein', food.protein, ref.protein],
        ['fat', food.fat, ref.fat], ['carbs', food.carbs, ref.carbs],
      ];
      for (const [field, value, range] of values) {
        if (value < range[0] || value > range[1]) outliers.push(`${id}.${field}=${value} not in ${range.join('-')}`);
      }
    }
    expect(missing, `missing FOOD_DB anchors: ${missing.join(', ')}`).toEqual([]);
    expect(outliers, outliers.join('\n')).toEqual([]);
  });

  it('requires a documented kcal range for every anchored product', () => {
    const missingRanges = Object.entries(USDA_TOP100_FIXTURE)
      .filter(([, ref]) => ref.kcal[1] <= ref.kcal[0])
      .map(([id]) => id);
    expect(missingRanges).toEqual([]);
  });
});
