/**
 * lab-trend-bound.test.ts — проход 145: тренды не считают обрезанные числа
 * измерением.
 *
 * `computeLabTrends` брал из точек только `value`: «Ферритин >1000» давал
 * процент и направление как точное измерение 1000, «вне нормы» решалось
 * сравнением числа с границей (поэтому «>5» при верхней 300 попадал в «норму»),
 * прогноз строился по обрезанным точкам, а знак не доезжал ни до строки тренда,
 * ни до CSV.
 *
 * Теперь вердикт трёхзначный (как в дневнике), разность и направление считаются
 * только у двух точных чисел, прогноз при границе не строится, а значения
 * печатаются через `labValueLabel`.
 */
import { describe, it, expect } from 'vitest';
import { computeLabTrends, exportTrendsToCSV, getTrendInsights } from '../lab-trend.engine';

// Ферритин: норма 30–300 (UCUM_MAP), удобно для границы «>1000».
const p = (date: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `${date}-${value}`,
  code: 'FERRITIN',
  name: 'Ферритин',
  value,
  unit: 'ug/L',
  date,
  phase: 'baseline',
  ...extra,
});

describe('проход 145: точные числа считаются как раньше', () => {
  it('рост внутри нормы — норма, без значимости', () => {
    const t = computeLabTrends([p('2026-10-01', 200), p('2026-11-01', 250)]).trends[0];
    expect(t.direction).toBe('up');
    expect(t.percentChange).toBe(25);
    expect(t.currentAbnormal).toBe(false);
    expect(t.previousAbnormal).toBe(false);
    expect(t.significance).toBe('normal');
  });

  it('выход из нормы даёт значимость и попадает в ухудшения', () => {
    const report = computeLabTrends([p('2026-10-01', 200), p('2026-11-01', 500)]);
    const t = report.trends[0];
    expect(t.currentAbnormal).toBe(true);
    expect(t.significance).toBe('critical');
    expect(report.worsened.map(w => w.code)).toContain('FERRITIN');
  });
});

describe('проход 145: граница не превращается в измерение', () => {
  it('«>1000» после 200: отклонение доказано, разность — нет', () => {
    const report = computeLabTrends([p('2026-10-01', 200), p('2026-11-01', 1000, { bound: '>' })]);
    const t = report.trends[0];
    expect(t.currentBound).toBe('>');
    expect(t.currentAbnormal).toBe(true);
    expect(t.direction).toBe('unknown');
    expect(t.absoluteChange).toBeNull();
    expect(t.percentChange).toBeNull();
    // Переход «норма → отклонение» доказан, но сила изменения — нет.
    expect(t.significance).toBe('significant');
    // Направление неизвестно — в «ухудшения» по проценту не попадает.
    expect(report.worsened.map(w => w.code)).not.toContain('FERRITIN');
    // Но новое отклонение названо.
    expect(getTrendInsights(report.trends).join(' ')).toContain('Новые отклонения');
  });

  it('«>5» при верхней границе 300 не «норма» и не значимость', () => {
    const report = computeLabTrends([p('2026-10-01', 200), p('2026-11-01', 5, { bound: '>' })]);
    const t = report.trends[0];
    expect(t.currentAbnormal).toBeUndefined();
    expect(t.direction).toBe('unknown');
    expect(t.significance).toBe('normal');
    expect(getTrendInsights(report.trends).join(' ')).toContain('Обрезанные значения');
    expect(getTrendInsights(report.trends).join(' ')).not.toContain('Стабильное состояние');
  });

  it('граница у прошлой записи тоже снимает разность', () => {
    const t = computeLabTrends([p('2026-10-01', 800, { bound: '>' }), p('2026-11-01', 900)]).trends[0];
    expect(t.previousBound).toBe('>');
    expect(t.previousAbnormal).toBe(true);
    expect(t.currentAbnormal).toBe(true);
    expect(t.absoluteChange).toBeNull();
    expect(t.direction).toBe('unknown');
  });

  it('точки несут знак', () => {
    const t = computeLabTrends([p('2026-10-01', 200), p('2026-11-01', 1000, { bound: '>' })]).trends[0];
    expect(t.points.map(x => x.bound)).toEqual([undefined, '>']);
  });
});

describe('проход 145: прогноз и выгрузка', () => {
  it('прогноз по точным точкам строится', () => {
    const t = computeLabTrends([p('2026-09-01', 100), p('2026-10-01', 150), p('2026-11-01', 200)]).trends[0];
    expect(t.predictedValue).toBeDefined();
  });

  it('одна обрезанная точка — прогноза нет', () => {
    const t = computeLabTrends([
      p('2026-09-01', 100),
      p('2026-10-01', 150),
      p('2026-11-01', 1000, { bound: '>' }),
    ]).trends[0];
    expect(t.predictedValue).toBeUndefined();
  });

  it('CSV печатает знак, а процент оставляет пустым', () => {
    const report = computeLabTrends([p('2026-10-01', 200), p('2026-11-01', 1000, { bound: '>' })]);
    const csv = exportTrendsToCSV(report);
    expect(csv).toContain('>1000');
    expect(csv).toContain('unknown');
  });
});
