import { describe, expect, it } from 'vitest';
import {
  estimate1RMConsensus,
  estimate1RMTrimmedMean,
  estimate1RMByMethod,
  applicableFormulasForLift,
  liftRepsCap,
  rmAccuracyNote,
} from '../estimate1rm.engine';
import { rpePctBrzycki, rpeWeightFor, e1RMFromRpeSet, rpeRir } from '../rpe-table.engine';

describe('P1 trimmed-mean consensus', () => {
  it('trimmed отбрасывает выбросы: уже медианы при 100×5', () => {
    const med = estimate1RMConsensus(100, 5);
    const trim = estimate1RMTrimmedMean(100, 5);
    expect(trim.n).toBe(med.n);
    expect(Math.abs(trim.value - med.value)).toBeLessThanOrEqual(3);
  });
  it('при n<3 (1 повт) trimmed = median', () => {
    expect(estimate1RMTrimmedMean(140, 1).value).toBe(estimate1RMConsensus(140, 1).value);
  });
  it('byMethod дефолт — median (backward-compat)', () => {
    expect(estimate1RMByMethod(100, 8).value).toBe(estimate1RMConsensus(100, 8).value);
    expect(estimate1RMByMethod(100, 8, 'trimmed').value).toBe(estimate1RMTrimmedMean(100, 8).value);
  });
});

describe('P1 per-lift применимость', () => {
  it('капы: тяга/присед 10, жим 12', () => {
    expect(liftRepsCap('deadlift')).toBe(10);
    expect(liftRepsCap('squat')).toBe(10);
    expect(liftRepsCap('bench')).toBe(12);
    expect(liftRepsCap(null)).toBe(12);
  });
  it('11 повт для тяги — пусто (вне капа), для жима — непусто', () => {
    expect(applicableFormulasForLift('deadlift', 11)).toEqual([]);
    expect(applicableFormulasForLift('bench', 11).length).toBeGreaterThan(0);
  });
  it('accuracy-пометки честные', () => {
    expect(rmAccuracyNote('deadlift', 11)).toContain('грубая');
    expect(rmAccuracyNote('bench', 4)).toContain('±3%');
    expect(rmAccuracyNote('deadlift', 9)).toContain('±5%');
  });
});

describe('P1 RPE-сетка Brzycki (якоря опубликованной сетки Cornerstone 8×9)', () => {
  it('5@8 ≈ 83%, 1@9 ≈ 97%, 8@7 ≈ 72%, 10@6 ≈ 64%', () => {
    expect(rpePctBrzycki(5, 8)).toBeCloseTo(0.833, 2);
    expect(rpePctBrzycki(1, 9)).toBeCloseTo(0.972, 2);
    expect(rpePctBrzycki(8, 7)).toBeCloseTo(0.722, 2);
    expect(rpePctBrzycki(10, 6)).toBeCloseTo(0.639, 2);
  });
  it('RPE10 = до отказа: совпадает с Brzycki-nRM', () => {
    expect(rpePctBrzycki(5, 10)).toBeCloseTo(32 / 36, 3);
  });
  it('вес и обратная оценка круглые', () => {
    expect(rpeWeightFor(180, 5, 8)).toBeCloseTo(150, 0);
    expect(e1RMFromRpeSet(150, 5, 8)).toBeCloseTo(180, 0);
    expect(rpeRir(8)).toBe(2);
    expect(rpeRir(99)).toBe(0);
  });
});
