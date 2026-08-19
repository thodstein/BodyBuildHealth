/**
 * day-compare.engine.test.ts — тесты сравнения день vs день (доп. 11).
 *
 * - дни с разными дефицитами: у дня с меньшими дефицитами лучше;
 * - одинаковые дни → 'equal';
 * - числовые дельты конечны.
 */
import { describe, it, expect } from 'vitest';
import { compareDays } from '../day-compare.engine';
import { analyzeDailyDiet, getDefaultProfile } from '../product-usefulness-v2.engine';

const day = (foodId: string, g: number) => analyzeDailyDiet([{ products: [{ foodId, weightGrams: g }] }], getDefaultProfile());

describe('compareDays (доп. 11)', () => {
  it('полноценный день лучше, чем день с рисом (меньше дефицитов)', () => {
    const good = day('chicken_breast', 300);
    const plain = day('rice_white', 300);
    const r = compareDays(good, plain);
    expect(r.betterDay).toBe(0);
    expect(Number.isFinite(r.kcalDelta)).toBe(true);
  });

  it('одинаковые дни → equal', () => {
    const a = day('chicken_breast', 250);
    const b = day('chicken_breast', 250);
    const r = compareDays(a, b);
    expect(r.betterDay).toBe('equal');
    expect(r.kcalDelta).toBe(0);
  });

  it('дельты конечны', () => {
    const r = compareDays(day('salmon', 200), day('banana', 150));
    expect(Number.isFinite(r.diaasDelta)).toBe(true);
    expect(Number.isFinite(r.giLoadDelta)).toBe(true);
    expect(r.rationale.length).toBeGreaterThan(0);
  });
});
