/**
 * elemental-dose.test.ts — гард пересчёта «масса соли → элементарное вещество».
 *
 * Решение продукта (ноябрь 2026): и UL, и подписи считаются в ЭЛЕМЕНТАРНОМ
 * минерале (фактическое количество в таблетке), а каталог хранит то, что
 * напечатано на этикетке — массу соединения («магний цитрат 400 мг»).
 * Без этого пересчёта 400 мг цитрата читались как 400 мг магния (в 6× больше
 * факта), а UL сравнивался то с солью, то с элементом.
 */
import { describe, it, expect } from 'vitest';
import { resolveElementalFactor, elementalMgOf } from '../elemental-dose';
import { SUPPORT_CATALOG_DATA } from '../support-database';

const cat = (id: string) => (SUPPORT_CATALOG_DATA as any)[id];

describe('resolveElementalFactor: соль → элемент', () => {
  it('магний: форма определяет долю (цитрат/глицинат/оксид)', () => {
    expect(resolveElementalFactor('magnesium', { dosage: { form: 'цитрат' } })).toBeCloseTo(0.16);
    expect(resolveElementalFactor('magnesium', { dosage: { form: 'бисглицинат' } })).toBeCloseTo(0.139);
    expect(resolveElementalFactor('magnesium', { dosage: { form: 'оксид' } })).toBeCloseTo(0.603);
  });

  it('неизвестная форма — консервативный дефолт, а не 1 (не завышаем элемент)', () => {
    expect(resolveElementalFactor('magnesium', { dosage: { form: '' } })).toBeCloseTo(0.15);
    expect(resolveElementalFactor('zinc', {})).toBeCloseTo(0.20);
  });

  it('микронутриенты и органика — без коэффициента (значение уже элементарное)', () => {
    expect(resolveElementalFactor('selenium', cat('selenium'))).toBeUndefined();
    expect(resolveElementalFactor('vitamin_d3', cat('vitamin_d3'))).toBeUndefined();
    expect(resolveElementalFactor('nac', cat('nac'))).toBeUndefined();
    expect(resolveElementalFactor('coq10', cat('coq10'))).toBeUndefined();
  });
});

describe('elementalMgOf: фактическое количество в таблетке', () => {
  it('магний 400 мг соли ≈ 64 мг элементарного', () => {
    const mg = elementalMgOf('magnesium', cat('magnesium'));
    expect(mg).toBeGreaterThan(55);
    expect(mg).toBeLessThan(70);
  });

  it('доза может прийти явно (титрованная), коэффициент тот же', () => {
    expect(elementalMgOf('magnesium', cat('magnesium'), 200)).toBeCloseTo(32, 0);
  });

  it('микронутриент не пересчитывается (200 мкг селена = 0.2 мг)', () => {
    expect(elementalMgOf('selenium', cat('selenium'))).toBeCloseTo(0.2, 6);
  });

  it('нулевая/битая доза — 0, без NaN', () => {
    expect(elementalMgOf('magnesium', cat('magnesium'), 0)).toBe(0);
    expect(elementalMgOf('magnesium', cat('magnesium'), Number.NaN)).toBe(0);
  });
});
