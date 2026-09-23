/**
 * nutrition-quality.test.ts — профильные тесты движка качества блюда (calcMealQuality).
 *
 * Гэп: движок живой (качество дня в отчётах/карточках планировщика), но собственного
 * тест-файла не имел — покрывался лишь косвенно. Здесь — границы breakdown, честность
 * масштабирования порцией, чистота функции (P2-fix side-effect) и пороги меток.
 */
import { describe, it, expect, vi } from 'vitest';
import { calcMealQuality, getQualityLabel } from '../nutrition-quality.engine';
import { FOOD_DB } from '../../core/nutrition-database';

const item = (o: any = {}) => ({ name: 'X', kcal: 300, p: 25, f: 10, c: 30, ...o });

describe('calcMealQuality: границы и честность', () => {
  it('breakdown в границах, total = сумма', () => {
    const q = calcMealQuality([
      item({ id: 'chicken_breast', name: 'Курица', amount: 150 }),
      item({ id: 'rice_white', name: 'Рис', kcal: 200, p: 4, f: 1, c: 45, amount: 150 }),
    ]);
    const b = q.breakdown;
    expect(b.microDensity).toBeGreaterThanOrEqual(0); expect(b.microDensity).toBeLessThanOrEqual(30);
    expect(b.macroBalance).toBeGreaterThanOrEqual(0); expect(b.macroBalance).toBeLessThanOrEqual(20);
    expect(b.fiber).toBeGreaterThanOrEqual(0); expect(b.fiber).toBeLessThanOrEqual(15);
    expect(b.fatQuality).toBeGreaterThanOrEqual(0); expect(b.fatQuality).toBeLessThanOrEqual(15);
    expect(b.wholeFoods).toBeGreaterThanOrEqual(0); expect(b.wholeFoods).toBeLessThanOrEqual(20);
    expect(q.total).toBe(b.microDensity + b.macroBalance + b.fiber + b.fatQuality + b.wholeFoods);
  });

  it('чистая функция: не пишет в localStorage (P2-fix side-effect)', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem');
    calcMealQuality([item({ id: 'oats', name: 'Овсянка', amount: 100 })]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('клетчатка масштабируется порцией (amount ×2 → не меньше)', () => {
    const small = calcMealQuality([item({ id: 'oats', name: 'Овсянка', kcal: 100, p: 3, f: 2, c: 20, amount: 50 })]);
    const big = calcMealQuality([item({ id: 'oats', name: 'Овсянка', kcal: 200, p: 6, f: 4, c: 40, amount: 100 })]);
    expect(big.breakdown.fiber).toBeGreaterThanOrEqual(small.breakdown.fiber);
  });

  it('перекос макросов штрафуется (белок 100% ккал → macroBalance ≤5)', () => {
    const skewed = calcMealQuality([{ name: 'Изолят', kcal: 400, p: 100, f: 0, c: 0 }]);
    expect(skewed.breakdown.macroBalance).toBeLessThanOrEqual(5);
  });

  it('fast_food снижает wholeFoods против цельного продукта', () => {
    const junk = FOOD_DB.find(f => f.category === 'fast_food');
    const whole = FOOD_DB.find(f => f.category !== 'fast_food' && (f.kcal || 0) > 0 && (f.id || '').length > 0);
    if (junk && whole) {
      const q = calcMealQuality([{ id: junk.id, name: junk.name, kcal: 500, p: 20, f: 30, c: 40, amount: 200 }]);
      const qw = calcMealQuality([{ id: whole.id, name: whole.name, kcal: 500, p: 20, f: 30, c: 40, amount: 200 }]);
      expect(q.breakdown.wholeFoods).toBeLessThan(qw.breakdown.wholeFoods);
    }
  });

  it('дефицитные микронутриенты перечислены с целями и единицами', () => {
    const q = calcMealQuality([{ name: 'Сахар', kcal: 400, p: 0, f: 0, c: 100 }]);
    expect(q.microDeficiencies.length).toBeGreaterThan(0);
    expect(q.microDeficiencies.every(d => d.target > 0 && d.unit)).toBe(true);
  });

  it('glycemicLoad растёт с углеводами (оценка)', () => {
    const low = calcMealQuality([item({ name: 'A', kcal: 200, p: 10, f: 5, c: 20 })]);
    const high = calcMealQuality([item({ name: 'B', kcal: 800, p: 10, f: 5, c: 180 })]);
    expect(high.glycemicLoad).toBeGreaterThan(low.glycemicLoad);
  });
});

describe('getQualityLabel: пороги 85/70/55/40', () => {
  it('метки и цвета на границах', () => {
    expect(getQualityLabel(90).label).toBe('Отлично');
    expect(getQualityLabel(85).label).toBe('Отлично');
    expect(getQualityLabel(84).label).toBe('Хорошо');
    expect(getQualityLabel(70).label).toBe('Хорошо');
    expect(getQualityLabel(69).label).toBe('Средне');
    expect(getQualityLabel(55).label).toBe('Средне');
    expect(getQualityLabel(54).label).toBe('Ниже среднего');
    expect(getQualityLabel(40).label).toBe('Ниже среднего');
    expect(getQualityLabel(39).label).toBe('Плохо');
    expect(getQualityLabel(0).emoji).toBe('🔴');
  });
});
