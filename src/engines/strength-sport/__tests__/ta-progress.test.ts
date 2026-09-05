import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sinclairCoefficient, sinclairTotal, appendTAProgress, taProgressTrend, progressTotal, SINCLAIR_CURRENT_CYCLE, saveTAProgress, loadTAProgress, TA_PROGRESS_KEY } from '../strength-sport-ta-progress.engine';

describe('TA progress + Sinclair V3-A', () => {
  it('пример IWF: F 67.9/257 → ≈323 (в PDF опечатка 67.8/67.9, допуск 0.5)', () => {
    // В официальном PDF X посчитан от ~67.76, а не 67.9 (1.257536738 vs формульные 1.2565007).
    // Проверяем формулу напрямую + итог с допуском опечатки документа (цикл 2021-2024 pinned).
    const x = Math.log10(67.9 / 153.757);
    expect(sinclairCoefficient(67.9, 'female', '2021-2024')).toBeCloseTo(Math.pow(10, 0.787004341 * x * x), 9);
    expect(sinclairTotal(257, 67.9, 'female', '2021-2024')).toBeCloseTo(323.187, 0);
  });
  it('M 81/305 → ≈387.09 (цикл 2021-2024)', () => {
    expect(sinclairTotal(305, 81, 'male', '2021-2024')).toBeCloseTo(387.09, 1);
  });
  it('V8 дефолт — текущий цикл 2025-2028', () => {
    expect(SINCLAIR_CURRENT_CYCLE).toBe('2025-2028');
    // PZPC-таблица: M 81.5кг → 1.282014
    expect(sinclairCoefficient(81.5, 'male')).toBeCloseTo(1.282014, 3);
    expect(sinclairCoefficient(81.5, 'male', '2025-2028')).toBe(sinclairCoefficient(81.5, 'male'));
  });
  it('V8 циклы различаются; B нового цикла выше', () => {
    const oldC = sinclairCoefficient(81, 'male', '2021-2024')!;
    const newC = sinclairCoefficient(81, 'male', '2025-2028')!;
    expect(Math.abs(oldC - newC)).toBeGreaterThan(0.001);
    expect(sinclairCoefficient(195, 'male', '2021-2024')).toBe(1); // ≥193.609
    expect(sinclairCoefficient(195, 'male', '2025-2028')).toBeGreaterThan(1); // <201.159
    expect(sinclairCoefficient(205, 'male', '2025-2028')).toBe(1);
  });
  it('вес ≥ B → коэффициент 1.0 (цикл 2021-2024)', () => {
    expect(sinclairCoefficient(200, 'male', '2021-2024')).toBe(1);
    expect(sinclairTotal(300, 200, 'male', '2021-2024')).toBe(300);
    expect(sinclairCoefficient(160, 'female', '2021-2024')).toBe(1);
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
  it('V8 тренд уважает цикл снимка', () => {
    const hist = [
      { date: '2026-01-01', bodyweightKg: 80, snatchKg: 90, cleanJerkKg: 110, cycle: '2021-2024' as const },
      { date: '2026-02-01', bodyweightKg: 80, snatchKg: 90, cleanJerkKg: 110, cycle: '2025-2028' as const },
    ];
    const t = taProgressTrend(hist, 'male');
    // та же сумма/вес, но коэффициенты циклов разные → Sinclair-дельта ненулевая
    expect(t?.totalDelta).toBe(0);
    expect(t?.sinclairDelta).not.toBe(0);
  });
  it('детерминизм формулы', () => {
    expect(sinclairTotal(250, 75, 'male')).toBe(sinclairTotal(250, 75, 'male'));
  });
  it('V8 save/load round-trip (регрессия: ключ обязан существовать)', () => {
    expect(TA_PROGRESS_KEY).toBe('he_ta_progress_hist_v1');
    let store: any = {};
    const orig = (global as any).localStorage;
    (global as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    } as any;
    try {
      const entry = { date: '2026-01-01', bodyweightKg: 81, snatchKg: 100, cleanJerkKg: 125, cycle: '2025-2028' as const };
      expect(saveTAProgress([entry])).toBe(true);
      const loaded = loadTAProgress();
      expect(loaded.length).toBe(1);
      expect(loaded[0]).toMatchObject({ date: '2026-01-01', cycle: '2025-2028' });
    } finally {
      (global as any).localStorage = orig;
    }
  });
});
