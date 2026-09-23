/**
 * product-usefulness-v1.test.ts — профильные тесты V1-движка «Полезность продуктов».
 *
 * Гэп: движок живой (ProductUsefulnessPlanner в планировщике питания), но собственных
 * тестов не имел — оба «usefulness»-файла тестировали V2/соседние движки. Здесь —
 * инварианты шкал, детерминизм, контекст (goal/timing/pharma), стоимость и утилиты.
 */
import { describe, it, expect } from 'vitest';
import {
  calcProductUsefulness, scoreAllProducts, compareProducts, GOAL_MAP_RU,
  type UsefulnessOptions,
} from '../product-usefulness.engine';
import { FOOD_DB } from '../../core/nutrition-database';

const opts = (o: Partial<UsefulnessOptions> = {}): UsefulnessOptions => ({
  goal: 'mass', weightKg: 80, enableA: true, enableB: true, enableC: false, hourOverride: 12, ...o,
});

describe('calcProductUsefulness: границы шкал и детерминизм', () => {
  it('total 0..100, breakdown/context в границах', () => {
    for (const f of FOOD_DB.slice(0, 60)) {
      const s = calcProductUsefulness(f, opts());
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
      expect(s.breakdown.proteinDensity).toBeLessThanOrEqual(30);
      expect(s.breakdown.microDensity).toBeLessThanOrEqual(30);
      expect(s.breakdown.fiberQuality).toBeLessThanOrEqual(20);
      expect(s.breakdown.aminoScore).toBeLessThanOrEqual(25);
      expect(s.contextBonus.goalMatch).toBeLessThanOrEqual(15);
    }
  });

  it('плотность белка: белковый продукт > углеводу', () => {
    const chicken = FOOD_DB.find(f => (f.protein || 0) >= 25 && (f.kcal || 0) <= 200);
    const carb = FOOD_DB.find(f => (f.carbs || 0) >= 70 && (f.protein || 0) <= 8);
    if (chicken && carb) {
      expect(calcProductUsefulness(chicken, opts()).breakdown.proteinDensity)
        .toBeGreaterThan(calcProductUsefulness(carb, opts()).breakdown.proteinDensity);
    }
  });

  it('tierScore: max > basic', () => {
    const maxF = FOOD_DB.find(f => f.tier === 'max');
    const baseF = FOOD_DB.find(f => f.tier === 'basic');
    if (maxF && baseF) {
      expect(calcProductUsefulness(maxF, opts()).breakdown.tierScore)
        .toBeGreaterThan(calcProductUsefulness(baseF, opts()).breakdown.tierScore);
    }
  });

  it('goalMatch: совпадение bestFor = 15, чужой непустой список = 0, пустой = 5', () => {
    const bulk = FOOD_DB.find(f => (f.bestFor || []).includes('bulk') && !(f.bestFor || []).includes('cut'));
    if (bulk) {
      expect(calcProductUsefulness(bulk, opts({ goal: 'mass' })).contextBonus.goalMatch).toBe(15);
      expect(calcProductUsefulness(bulk, opts({ goal: 'cut' })).contextBonus.goalMatch).toBe(0);
    }
    const noBest = FOOD_DB.find(f => !(f.bestFor || []).length);
    if (noBest) expect(calcProductUsefulness(noBest, opts()).contextBonus.goalMatch).toBe(5);
  });

  it('timing: hourOverride решает (after_train-еда ловится в 12:00, не ловится в 3:00)', () => {
    const t = FOOD_DB.find(f => f.timing === 'after_train');
    if (t) {
      expect(calcProductUsefulness(t, opts({ hourOverride: 12 })).contextBonus.timingMatch).toBe(5);
      expect(calcProductUsefulness(t, opts({ hourOverride: 3 })).contextBonus.timingMatch).toBe(0);
    }
  });

  it('pharma: AAS-синергия даёт +, конфликт — −', () => {
    const syn = FOOD_DB.find(f => /омега-3|магний|цинк|витамин D/i.test(f.pharmaNote || ''));
    const conf = FOOD_DB.find(f => /эстроген|пролактин|кортизол|ароматаза|высокое железо/i.test(f.pharmaNote || ''));
    if (syn) expect(calcProductUsefulness(syn, opts({ hasAAS: true })).contextBonus.pharmaMatch).toBeGreaterThan(0);
    if (conf) expect(calcProductUsefulness(conf, opts({ hasAAS: true })).contextBonus.pharmaMatch).toBeLessThan(0);
  });

  it('costEfficiency: enableC + цена → расчёт; без цены и без estimate → null', () => {
    const f = FOOD_DB.find(x => x.id === 'chicken_breast');
    if (f) {
      const withCost = calcProductUsefulness(f, opts({ enableC: true, pricePerKg: 400 }));
      expect(withCost.costEfficiency).not.toBeNull();
      expect(withCost.costEfficiency!.proteinCostRub).toBe(Math.round(400 / ((f.protein || 0) * 10)));
    }
    const unknown = FOOD_DB.find(x => x.protein && x.protein > 0 && !x.id.startsWith('chicken_breast'));
    if (unknown) {
      const noEstimate = calcProductUsefulness(
        { ...unknown, id: 'zz_unknown_food_xyz', name: 'zz' } as any,
        opts({ enableC: true }),
      );
      expect(noEstimate.costEfficiency).toBeNull();
    }
  });

  it('enableA/enableB: нормировка по активным осям (под-скоры считаются всегда)', () => {
    const f = FOOD_DB.find(x => x.id === 'chicken_breast') || FOOD_DB[0];
    const aOnly = calcProductUsefulness(f, opts({ enableB: false }));
    expect(aOnly.maxPossible).toBe(105);
    const sumA = aOnly.breakdown.proteinDensity + aOnly.breakdown.microDensity
      + aOnly.breakdown.fiberQuality + aOnly.breakdown.tierScore + aOnly.breakdown.aminoScore;
    expect(aOnly.total).toBe(Math.max(0, Math.min(100, Math.round(sumA / 105 * 100))));

    const bOnly = calcProductUsefulness(f, opts({ enableA: false }));
    expect(bOnly.maxPossible).toBe(28);
    const sumB = bOnly.contextBonus.goalMatch + bOnly.contextBonus.timingMatch + bOnly.contextBonus.pharmaMatch;
    expect(bOnly.total).toBe(Math.max(0, Math.min(100, Math.round(sumB / 28 * 100))));
  });

  it('детерминизм: один и тот же вход → один и тот же результат', () => {
    const f = FOOD_DB.find(x => x.id === 'rice_white') || FOOD_DB[0];
    expect(calcProductUsefulness(f, opts())).toEqual(calcProductUsefulness(f, opts()));
  });
});

describe('scoreAllProducts / compareProducts / словари', () => {
  it('сортировка по убыванию и фильтр категории', () => {
    const all = scoreAllProducts(opts());
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].score.total).toBeGreaterThanOrEqual(all[i].score.total);
    }
    const protein = scoreAllProducts({ ...opts(), category: 'protein' });
    expect(protein.every(x => x.food.category === 'protein')).toBe(true);
  });

  it('compareProducts пропускает неизвестные id', () => {
    const res = compareProducts(['chicken_breast', 'no_such_food_123'], opts());
    expect(res.length).toBe(1);
    expect(res[0].food.id).toBe('chicken_breast');
  });

  it('GOAL_MAP_RU содержит ключевые цели', () => {
    expect(GOAL_MAP_RU.bulk).toBe('Набор массы');
    expect(GOAL_MAP_RU.cut).toBe('Сушка');
  });
});
