import { describe, it, expect } from 'vitest';
import { FIBER_G_PER_1000_KCAL, fiberPct, fiberTargetG } from '../fiber-target';

describe('норма клетчатки 14 г / 1000 ккал (AI, IOM)', () => {
  it('масштабируется под дневную калорийную цель', () => {
    expect(FIBER_G_PER_1000_KCAL).toBe(14);
    expect(fiberTargetG(2500)).toBe(35);
    expect(fiberTargetG(2000)).toBe(28);
    expect(fiberTargetG(1800)).toBe(25);
    expect(fiberTargetG(2700)).toBe(38);
  });

  it('без валидной цели норма — 0, а не дефолтные 30 г', () => {
    expect(fiberTargetG(0)).toBe(0);
    expect(fiberTargetG(-100)).toBe(0);
    expect(fiberTargetG(Number.NaN)).toBe(0);
    expect(fiberTargetG(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('процент выполнения считается без деления на ноль', () => {
    expect(fiberPct(35, 35)).toBe(100);
    expect(fiberPct(17.5, 35)).toBe(50);
    expect(fiberPct(50, 35)).toBe(143);
    expect(fiberPct(10, 0)).toBe(0);
    expect(fiberPct(Number.NaN, 35)).toBe(0);
  });
});
