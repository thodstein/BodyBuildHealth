/**
 * lab-trend-visuals.test.tsx — проход 146: обрезанная точка тренда видна на
 * самой линии.
 *
 * Проход 145 доехал до строки тренда, подписи графика при наведении и CSV, но
 * линия рисовала «>1000» обычной залитой точкой — как точное измерение 1000.
 * Теперь у обрезанной точки пунктирное кольцо, а спарклайн с границей в
 * истории — пунктирная линия.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { trendPointStyle, trendSparklineDash } from '../lab-trend-visuals';

describe('проход 146: точка графика', () => {
  it('точное число — залитая точка, как раньше', () => {
    const style = trendPointStyle(undefined, '#00e68a');
    expect(style.fill).toBe('#00e68a');
    expect(style.strokeWidth).toBe(1);
    expect(style.strokeDasharray).toBeUndefined();
    expect(style['data-lab-bound']).toBeUndefined();
  });

  it('обрезанное число — пунктирное кольцо без заливки', () => {
    for (const bound of ['<', '>'] as const) {
      const style = trendPointStyle(bound, '#f97316');
      expect(style.fill).toBe('none');
      expect(style.stroke).toBe('#f97316');
      expect(style.strokeDasharray).toBe('2 2');
      expect(style['data-lab-bound']).toBe('yes');
    }
  });
});

describe('проход 146: спарклайн', () => {
  it('все точки точные — сплошная линия', () => {
    expect(trendSparklineDash([undefined, undefined])).toBeUndefined();
    expect(trendSparklineDash([])).toBeUndefined();
  });

  it('одна граница в истории — линия пунктирная', () => {
    expect(trendSparklineDash([undefined, '>'])).toBe('3 3');
    expect(trendSparklineDash(['<', undefined])).toBe('3 3');
  });
});

describe('проход 146: линия и строка читают одно правило', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src', 'ui', 'screens', 'LabsScreen.tsx'),
    'utf-8',
  );

  it('большой график рисует точку через trendPointStyle', () => {
    expect(src).toContain('{...trendPointStyle(p.bound, color)}');
  });

  it('спарклайн берёт пунктир из trendSparklineDash', () => {
    expect(src).toContain('strokeDasharray={trendSparklineDash(pts.map(p => p.bound))}');
  });

  it('линия большого графика тоже пунктирна при границе', () => {
    expect(src).toContain('strokeDasharray={trendSparklineDash(trend.points.map(p => p.bound))}');
  });
});
