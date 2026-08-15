import { describe, expect, it } from 'vitest';
import { calculatePlates, getPlateLoadingOrder, warmupPlateSequence } from '../gym-competition.engine';

describe('Калькулятор блинов — учёт веса выбранного грифа', () => {
  it('warmupPlateSequence использует вес грифа (женский 15 кг): сет 20 кг = гриф + 2.5', () => {
    const seq = warmupPlateSequence(100, 15);
    expect(seq[0].weight).toBe(20);
    expect(seq[0].plates).toContain('2.5');
  });

  it('warmupPlateSequence: разминочный вес ниже веса грифа → пустой гриф', () => {
    const seq = warmupPlateSequence(100, 25);
    expect(seq[0].weight).toBe(20);
    expect(seq[0].plates).toBe('пустой');
  });

  it('warmupPlateSequence с кастомными блинами считает от выбранного грифа', () => {
    const seq = warmupPlateSequence(100, 20, 'kg', [10]);
    expect(seq[1].weight).toBe(40);
    expect(seq[1].plates).toBe('10×1');
  });

  it('warmupPlateSequence по умолчанию сохраняет олимпийский гриф 20 кг', () => {
    const seq = warmupPlateSequence(100);
    expect(seq[0].weight).toBe(20);
    expect(seq[0].plates).toBe('пустой');
    const s2 = warmupPlateSequence(100);
    expect(s2[1].plates).toBe('10×1');
  });

  it('getPlateLoadingOrder использует вес грифа и единицы (lb)', () => {
    const order = getPlateLoadingOrder(135, 45, 'lbs');
    expect(order[0]).toBe('Пустой гриф: 45 lb');
    expect(order).toContain('+ 45lb ×2 = 135 lb');
    expect(order[order.length - 1]).toBe('Итого: 135 lb (цель: 135 lb)');
  });

  it('getPlateLoadingOrder в кг учитывает нестандартный гриф (трап 25 кг)', () => {
    const order = getPlateLoadingOrder(100, 25);
    expect(order[0]).toBe('Пустой гриф: 25 кг');
    expect(order).toContain('+ 25кг ×2 = 75 кг');
  });

  it('calculatePlates: actualWeight = гриф + блины (трап-гриф 25 кг)', () => {
    const r = calculatePlates(100, 25, 'kg');
    expect(r.barWeight).toBe(25);
    expect(r.actualWeight).toBe(100);
    expect(r.platesPerSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 10, count: 1 },
      { plate: 2.5, count: 1 },
    ]);
  });
});
