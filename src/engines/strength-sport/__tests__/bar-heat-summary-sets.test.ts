import { describe, it, expect } from 'vitest';
import {
  heatSummary,
  barSetStats,
  barSetOverlay,
  scaleBarPoints,
  pointIndexAtTime,
  snapshotBarRep,
  repSetIndex,
  type BarPoint,
  type BarRepSegment,
} from '../strength-sport-video.engine';

const POINTS: BarPoint[] = [
  { t: 0, x: 0, y: 0 },
  { t: 0.1, x: 0, y: 10 },
  { t: 0.2, x: 0, y: 20 },
  { t: 0.3, x: 0, y: 30 },
  { t: 0.4, x: 0, y: 40 },
  { t: 0.6, x: 0, y: 30 },
  { t: 0.8, x: 0, y: 20 },
  { t: 1.0, x: 0, y: 10 },
  { t: 1.2, x: 0, y: 0 },
];

function rep(index: number, vmax: number, setIndex?: number): BarRepSegment {
  return {
    index,
    points: [
      { t: 0, x: 0, y: 0 },
      { t: 0.2, x: 1, y: 20 },
      { t: 0.4, x: 0, y: 40 },
    ],
    startT: 0,
    endT: 0.4,
    amplitude: 40,
    yMax: 40,
    yMin: 0,
    xLoop: 1,
    vmax,
    xBias: 0,
    durationMs: 400,
    ...(setIndex != null ? { setIndex } : {}),
  };
}

describe('heatSummary — числа под раскраской', () => {
  it('считает долю медленных отрезков и точку минимума скорости', () => {
    const s = heatSummary(POINTS);
    expect(s).toBeTruthy();
    expect(s!.segments).toBe(POINTS.length - 1);
    expect(s!.slowPct).toBeGreaterThan(0);
    expect(s!.slowPct).toBeLessThanOrEqual(100);
    // спуск вдвое медленнее подъёма → минимум скорости на верхней части пути
    expect(s!.stickingHeightCm).toBeGreaterThan(0);
    expect(s!.stickingSpeedCmS).toBeGreaterThan(0);
  });

  it('без времени отрезков heatmap не выдумывается', () => {
    expect(heatSummary([{ x: 0, y: 0 }, { x: 1, y: 10 }] as BarPoint[])).toBeNull();
    expect(heatSummary([])).toBeNull();
  });
});

describe('barSetStats / barSetOverlay — подход vs подход', () => {
  it('повторы без метки считаются первым подходом', () => {
    expect(repSetIndex(rep(1, 0.6))).toBe(1);
    const stats = barSetStats([rep(1, 0.6), rep(2, 0.5)]);
    expect(stats).toHaveLength(1);
    expect(stats[0].reps).toBe(2);
    expect(stats[0].vmaxMean).toBe(0.55);
    expect(stats[0].vmaxMin).toBe(0.5);
  });

  it('подходы группируются и сортируются по номеру', () => {
    const stats = barSetStats([rep(1, 0.6, 1), rep(2, 0.55, 1), rep(3, 0.45, 2)]);
    expect(stats.map((s) => s.setIndex)).toEqual([1, 2]);
    expect(stats[1].vmaxMean).toBe(0.45);
  });

  it('overlay сравнивает первый и последний подход, падение — отрицательный Δ', () => {
    const o = barSetOverlay([rep(1, 0.6, 1), rep(2, 0.58, 1), rep(3, 0.45, 2)]);
    expect(o).toBeTruthy();
    expect(o!.sets).toBe(2);
    expect(o!.deltaPct).toBe(-24);
    expect(o!.text).toContain('Подходы 2');
    expect(o!.text).toContain('падает');
  });

  it('один подход — нечего сравнивать', () => {
    expect(barSetOverlay([rep(1, 0.6)])).toBeNull();
    expect(barSetOverlay([])).toBeNull();
  });

  it('setIndex переживает снимок для персиста', () => {
    expect(snapshotBarRep(rep(1, 0.6, 3)).setIndex).toBe(3);
    expect(snapshotBarRep(rep(1, 0.6)).setIndex).toBeUndefined();
  });
});

describe('scaleBarPoints — CSV в пикселях', () => {
  it('умножает координаты на «см на единицу»', () => {
    const out = scaleBarPoints([{ t: 0, x: 10, y: 100 }], 0.5);
    expect(out[0]).toEqual({ t: 0, x: 5, y: 50 });
  });

  it('k=1 и мусорный масштаб оставляют точки как есть', () => {
    const pts = [{ t: 0, x: 10, y: 100 }];
    expect(scaleBarPoints(pts, 1)).toBe(pts);
    expect(scaleBarPoints(pts, 0)).toBe(pts);
    expect(scaleBarPoints(pts, Number.NaN)).toBe(pts);
  });

  it('пустой вход — пустой выход', () => {
    expect(scaleBarPoints([], 2)).toEqual([]);
  });
});

describe('pointIndexAtTime — синхронизация оверлея с видео', () => {
  const pts = [{ t: 0 }, { t: 0.5 }, { t: 1 }, { t: 1.5 }];
  it('находит последнюю точку не позже времени', () => {
    expect(pointIndexAtTime(pts, -1)).toBe(-1);
    expect(pointIndexAtTime(pts, 0)).toBe(0);
    expect(pointIndexAtTime(pts, 0.7)).toBe(1);
    expect(pointIndexAtTime(pts, 1.5)).toBe(3);
    expect(pointIndexAtTime(pts, 99)).toBe(3);
  });
  it('пустой трек и NaN дают честный ответ', () => {
    expect(pointIndexAtTime([], 1)).toBe(-1);
    expect(pointIndexAtTime(pts, Number.NaN)).toBe(3);
  });
});
