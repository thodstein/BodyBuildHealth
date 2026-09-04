import { describe, it, expect } from 'vitest';
import { sinclairCoefficient, sinclairTotal, appendTAProgress, taProgressTrend, progressTotal } from '../strength-sport-ta-progress.engine';

describe('TA progress + Sinclair V3-A', () => {
  it('пример IWF: F 67.9/257 → ≈323 (в PDF опечатка 67.8/67.9, допуск 0.5)', () => {
    // В официальном PDF X посчитан от ~67.76, а не 67.9 (1.257536738 vs формульные 1.2565007).
    // Проверяем формулу напрямую + итог с допуском опечатки документа.
    const x = Math.log10(67.9 / 153.757);
    expect(sinclairCoefficient(67.9, 'female')).toBeCloseTo(Math.pow(10, 0.787004341 * x * x), 9);
    expect(sinclairTotal(257, 67.9, 'female')).toBeCloseTo(323.187, 0);
  });
  it('M 81/305 → ≈387.09', () => {
    expect(sinclairTotal(305, 81, 'male')).toBeCloseTo(387.09, 1);
  });
  it('вес ≥ B → коэффициент 1.0', () => {
    expect(sinclairCoefficient(200, 'male')).toBe(1);
    expect(sinclairTotal(300, 200, 'male')).toBe(300);
    expect(sinclairCoefficient(160, 'female')).toBe(1);
  });
  it('нет данных → null', () => {
    expect(sinclairCoefficient(null)).toBeNull();
    expect(sinclairCoefficient(0, 'male')).toBeNull();
    expect(sinclairTotal(200, null)).toBeNull();
    expect(sinclairTotal(0, 80)).toBeNull();
  });
  it('история: замена по дате', () => {
    let h = appendTAProgress([], { date: '2026-01-01', bodyweightKg: 80, snatchKg: 90, cleanJerkKg: 110 });
    h = appendTAProgress(h, { date: '2026-01-01', bodyweightKg: 80, snatchKg: 92, cleanJerkKg: 110 });
    expect(h.length).toBe(1);
    expect(progressTotal(h[0])).toBe(202);
  });
  it('тренд: дельты + лучший Sinclair', () => {
    const t = taProgressTrend([
      { date: '2026-01-01', bodyweightKg: 80, snatchKg: 90, cleanJerkKg: 110 },
      { date: '2026-02-01', bodyweightKg: 81, snatchKg: 95, cleanJerkKg: 115 },
    ], 'male');
    expect(t?.totalDelta).toBe(10);
    expect(t?.bwDelta).toBe(1);
    expect(t?.bestSinclair).toBeGreaterThan(0);
    expect(t?.n).toBe(2);
    expect(taProgressTrend([{ date: '2026-01-01', bodyweightKg: 80, snatchKg: 90, cleanJerkKg: 110 }])).toBeNull();
  });
  it('детерминизм формулы', () => {
    expect(sinclairTotal(250, 75, 'male')).toBe(sinclairTotal(250, 75, 'male'));
  });
});
