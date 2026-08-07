/**
 * diary-stats.test.ts — тесты новых статистических хелперов.
 */
import { describe, it, expect } from 'vitest';
import {
  computeDistribution,
  getNormalRange,
  classifyValue,
  buildWeeklyHistogram,
  buildHourDistribution,
  type DiaryKey,
} from '../diary-helpers';

describe('computeDistribution', () => {
  it('возвращает null для пустого массива', () => {
    expect(computeDistribution([])).toBeNull();
  });

  it('считает mean, median, stdDev для нормального набора', () => {
    const r = computeDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r).not.toBeNull();
    expect(r!.mean).toBeCloseTo(5.5, 1);
    expect(r!.median).toBeCloseTo(5.5, 1);
    expect(r!.min).toBe(1);
    expect(r!.max).toBe(10);
    expect(r!.p25).toBeCloseTo(3.25, 1);
    expect(r!.p75).toBeCloseTo(7.75, 1);
    expect(r!.stdDev).toBeGreaterThan(0);
  });

  it('IQR = p75 - p25', () => {
    const r = computeDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r!.iqr).toBeCloseTo(r!.p75 - r!.p25, 5);
  });

  it('median для чётного количества — среднее двух центральных', () => {
    const r = computeDistribution([1, 2, 3, 4]);
    expect(r!.median).toBeCloseTo(2.5, 5);
  });

  it('фильтрует не-числовые', () => {
    const r = computeDistribution([1, NaN, 2, Infinity as any, 3]);
    expect(r!.count).toBe(3);
    expect(r!.mean).toBe(2);
  });
});

describe('getNormalRange / classifyValue', () => {
  it('возвращает зону для sleep', () => {
    const r = getNormalRange('sleep');
    expect(r).not.toBeNull();
    expect(r!.low).toBe(7);
    expect(r!.high).toBe(9);
  });

  it('возвращает null для неизвестного ключа', () => {
    expect(getNormalRange('injection')).toBeNull();
  });

  it('classifyValue: normal в диапазоне', () => {
    expect(classifyValue('sleep', 7.5)).toBe('normal');
    expect(classifyValue('sleep', 8)).toBe('normal');
  });

  it('classifyValue: warn вне нормы, но в warn-зоне', () => {
    expect(classifyValue('sleep', 6.5)).toBe('warn');
  });

  it('classifyValue: danger экстремальное значение', () => {
    expect(classifyValue('sleep', 4)).toBe('danger');
    expect(classifyValue('sleep', 12)).toBe('danger');
  });

  it('classifyValue: bp 130 — warn, 150 — danger', () => {
    expect(classifyValue('bp', 130)).toBe('warn');
    expect(classifyValue('bp', 150)).toBe('danger');
    expect(classifyValue('bp', 110)).toBe('normal');
  });

  it('classifyValue: pain 25 — warn, 60 — danger', () => {
    expect(classifyValue('pain', 25)).toBe('warn');
    expect(classifyValue('pain', 60)).toBe('danger');
  });

  it('classifyValue: неизвестный ключ — unknown', () => {
    expect(classifyValue('injection', 5)).toBe('unknown');
  });
});

describe('buildWeeklyHistogram', () => {
  it('возвращает пустой массив для пустого ввода', () => {
    expect(buildWeeklyHistogram([])).toEqual([]);
  });

  it('группирует значения по неделям', () => {
    const out = buildWeeklyHistogram([
      { date: '2025-01-06', value: 7 },
      { date: '2025-01-08', value: 8 },
      { date: '2025-01-13', value: 6 },
    ]);
    expect(out.length).toBe(2);
    expect(out[0].count).toBe(2);
    expect(out[0].mean).toBe(7.5);
    expect(out[1].count).toBe(1);
  });

  it('вычисляет min/max/mean для каждой недели', () => {
    const out = buildWeeklyHistogram([
      { date: '2025-01-06', value: 6 },
      { date: '2025-01-08', value: 8 },
    ]);
    expect(out[0].min).toBe(6);
    expect(out[0].max).toBe(8);
    expect(out[0].sum).toBe(14);
  });
});

describe('buildHourDistribution', () => {
  it('возвращает 24 часа', () => {
    const out = buildHourDistribution(['2025-01-06T10:00:00', '2025-01-07T10:00:00', '2025-01-08T22:00:00']);
    expect(out).toHaveLength(24);
    expect(out[10].count).toBe(2);
    expect(out[22].count).toBe(1);
    expect(out[0].count).toBe(0);
  });

  it('возвращает нули для пустого ввода', () => {
    const out = buildHourDistribution([]);
    expect(out).toHaveLength(24);
    expect(out.every(h => h.count === 0)).toBe(true);
  });
});
