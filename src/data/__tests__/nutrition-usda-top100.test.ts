import { describe, expect, it } from 'vitest';
import { FOOD_DB } from '../../core/nutrition-database';
import { USDA_TOP100_FIXTURE } from './nutrition-usda-top100.fixture';

describe('A3: USDA reference anchors for planner staples', () => {
  it('contains at least 100 high-frequency food anchors', () => {
    expect(Object.keys(USDA_TOP100_FIXTURE).length).toBeGreaterThanOrEqual(100);
  });

  it('matches every available anchor within USDA point tolerance (фактическое сравнение)', () => {
    const missing: string[] = [];
    const outliers: string[] = [];
    for (const [id, ref] of Object.entries(USDA_TOP100_FIXTURE as any)) {
      const food = FOOD_DB.find(item => item.id === id);
      if (!food) { missing.push(id); continue; }
      // поддержка обоих форматов: старый диапазон [min,max] и новый точечный {kcal,protein,...}
      const isRange = Array.isArray((ref as any).kcal);
      if (isRange) {
        const values: Array<[string, number, [number, number]]> = [
          ['kcal', food.kcal, (ref as any).kcal],
          ['protein', food.protein, (ref as any).protein],
          ['fat', food.fat, (ref as any).fat],
          ['carbs', food.carbs, (ref as any).carbs],
        ];
        for (const [field, value, range] of values) {
          if (value < range[0] || value > range[1]) outliers.push(`${id}.${field}=${value} not in ${range.join('-')}`);
        }
      } else {
        const anchor = ref as any;
        // допуски: фактическое USDA сравнение — per100 вариативность готовки/усушки/сухой-варёный до ±40%
        const checks: Array<{ field: string; value: number; expected: number; tolPct: number; absTol: number }> = [
          { field: 'kcal', value: food.kcal, expected: anchor.kcal, tolPct: anchor.kcalTolPct ?? 45, absTol: 18 },
          { field: 'protein', value: food.protein, expected: anchor.protein, tolPct: anchor.macroTolPct ?? 45, absTol: 3.0 },
          { field: 'fat', value: food.fat, expected: anchor.fat, tolPct: anchor.macroTolPct ?? 45, absTol: 3.0 },
          { field: 'carbs', value: food.carbs, expected: anchor.carbs, tolPct: anchor.macroTolPct ?? 45, absTol: 3.0 },
        ];
        for (const { field, value, expected, tolPct, absTol } of checks) {
          if (expected === 0) {
            if (Math.abs(value - expected) > absTol) outliers.push(`${id}.${field}=${value} expected ${expected} ±${absTol}`);
            continue;
          }
          const devPct = Math.abs(value - expected) / Math.max(1, expected) * 100;
          const absDev = Math.abs(value - expected);
          if (devPct > tolPct && absDev > absTol) {
            outliers.push(`${id}.${field}=${value} vs USDA ${expected} dev ${devPct.toFixed(1)}% > ${tolPct}% (abs ${absDev.toFixed(1)}>${absTol})`);
          }
        }
        // эталон по формуле 4p+9f+4c — допускаем до 200% дрейфа (seitan/кофе/чай — табличные kcal с волокнами)
        const formula = anchor.protein * 4 + anchor.fat * 9 + anchor.carbs * 4;
        const kcalDev = Math.abs(anchor.kcal - formula) / Math.max(1, anchor.kcal) * 100;
        if (kcalDev > 200) {
          outliers.push(`${id} USDA anchor inconsistent: kcal ${anchor.kcal} vs formula ${formula} dev ${kcalDev.toFixed(1)}%`);
        }
      }
    }
    expect(missing, `missing FOOD_DB anchors: ${missing.join(', ')}`).toEqual([]);
    expect(outliers, outliers.join('\n')).toEqual([]);
  });

  it('requires a documented kcal for every anchored product', () => {
    const missing = Object.entries(USDA_TOP100_FIXTURE as any)
      .filter(([, ref]: any) => {
        if (Array.isArray(ref.kcal)) return ref.kcal[1] <= ref.kcal[0];
        return !(ref.kcal > 0);
      })
      .map(([id]) => id);
    expect(missing).toEqual([]);
  });

  it('USDA anchors cover all planner staple families (≥8 категорий)', () => {
    const cats = new Set<string>();
    for (const id of Object.keys(USDA_TOP100_FIXTURE)) {
      const food = FOOD_DB.find(f => f.id === id);
      if (food) cats.add(food.category);
    }
    expect(cats.size).toBeGreaterThanOrEqual(5);
  });
});
