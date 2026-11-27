import { describe, it, expect } from 'vitest';
import { addFiberMicros, fiberPer100, fiberPortionG } from '../nutrition-micros';

describe('клетчатка в микросах дневника', () => {
  it('берёт верхнеуровневое fiber, а не пустые micros', () => {
    expect(fiberPer100({ fiber: 42.8, micros: { Ca: 73 } })).toBe(42.8);
  });

  it('падает на канон micros.fiber_g, когда поля fiber нет (этикетка/фото)', () => {
    expect(fiberPer100({ micros: { fiber_g: 1.5, sodium_mg: 40 } })).toBe(1.5);
    expect(fiberPer100({ micros: { Fiber: 2.2 } })).toBe(2.2);
  });

  it('нет данных — 0, без «типичных» догадок', () => {
    expect(fiberPer100(undefined)).toBe(0);
    expect(fiberPer100({})).toBe(0);
    expect(fiberPer100({ fiber: 0, micros: {} })).toBe(0);
  });

  it('масштабирует на порцию и округляет до 0.1 г', () => {
    expect(fiberPortionG(42.8, 100)).toBe(42.8);
    expect(fiberPortionG(42.8, 15)).toBe(6.4);
    expect(fiberPortionG(0, 100)).toBe(0);
    expect(fiberPortionG(10, 0)).toBe(0);
  });

  it('добавляет fiber_g к уже собранным микросам порции', () => {
    expect(addFiberMicros({ sodium_mg: 120 }, { fiber: 2.6 }, 150)).toEqual({
      sodium_mg: 120,
      fiber_g: 3.9,
    });
  });

  it('не перетирает клетчатку, пришедшую с этикетки', () => {
    expect(addFiberMicros({ fiber_g: 1.5 }, { fiber: 9 }, 100)).toEqual({ fiber_g: 1.5 });
  });

  it('возвращает undefined, когда ни микросов, ни клетчатки нет', () => {
    expect(addFiberMicros(undefined, { fiber: 0 }, 100)).toBeUndefined();
    expect(addFiberMicros(undefined, undefined, 100)).toBeUndefined();
  });

  it('даёт только клетчатку, если других микросов у продукта нет', () => {
    expect(addFiberMicros(undefined, { fiber: 30 }, 10)).toEqual({ fiber_g: 3 });
  });

  it('переносит устаревший ключ Fiber в канон fiber_g и не считает дважды', () => {
    // У части позиций FOOD_DB клетчатка лежит в micros.Fiber; агрегат дня
    // суммирует любые ключи, поэтому дубль дал бы двойную клетчатку.
    expect(addFiberMicros({ Fiber: 10, sodium_mg: 3 }, { fiber: 10.4 }, 100)).toEqual({
      sodium_mg: 3,
      fiber_g: 10,
    });
  });

  it('порция сухой клетчатки 4 г даёт 3 г при 75 г на 100 г', () => {
    expect(addFiberMicros(undefined, { fiber: 75, micros: { Fe: 18 } }, 4)).toEqual({ fiber_g: 3 });
  });
});
