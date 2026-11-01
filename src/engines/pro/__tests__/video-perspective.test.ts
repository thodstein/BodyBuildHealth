import { describe, it, expect } from 'vitest';
import {
  perspectiveFromAnchors,
  mapTrackToVideoPerspective,
  isPerspectiveSane,
  perspectiveLocalScale,
  perspectiveSkewPct,
  type PerspectiveCalibration,
} from '../trajectory-overlay.engine';

/**
 * Эталонная «камера под углом»: Y = (−8y + 520) / (0.004y + 1).
 * Масштаб по вертикали падает с 10.08 px/см (низ) до 7.0 px/см (верх) — 31% перспективы.
 */
const TRUE = { vA: -8, vB: 520, vC: 0.004 };
const yImg = (y: number) => (TRUE.vA * y + TRUE.vB) / (TRUE.vC * y + 1);

/** Четыре кадра: время трека, горизонталь трека, высота трека. */
const POINTS = [
  { t: 0.1, x: 0, y: 0 },
  { t: 0.4, x: 0.5, y: 16.7 },
  { t: 0.7, x: 1, y: 33.3 },
  { t: 1.0, x: 1.5, y: 50 },
];

const taps = (dy = 0) => POINTS.map((p, i) => ({
  timeSec: p.t,
  videoX: 100 + i * 4,
  videoY: yImg(p.y) + (i === POINTS.length - 1 ? dy : 0),
}));

describe('perspectiveFromAnchors — осевой проектив по четырём привязкам', () => {
  it('восстанавливает коэффициенты камеры и нулевую невязку', () => {
    const calib = perspectiveFromAnchors(taps(), POINTS)!;
    expect(calib).toBeTruthy();
    expect(calib.vA).toBeCloseTo(-8, 5);
    expect(calib.vB).toBeCloseTo(520, 4);
    expect(calib.vC).toBeCloseTo(0.004, 8);
    expect(calib.fitPx).toBeLessThan(0.2);
    expect(calib.anchors.map((a) => a.trackY)).toEqual([0, 16.7, 33.3, 50]);
  });

  it('локальный масштаб падает по высоте, разброс совпадает с реальным', () => {
    const calib = perspectiveFromAnchors(taps(), POINTS)!;
    expect(perspectiveLocalScale(calib, 0)).toBeCloseTo(10.08, 3);
    expect(perspectiveLocalScale(calib, 50)).toBeCloseTo(7.0, 3);
    expect(perspectiveSkewPct(calib)).toBe(31);
  });

  it('маппинг совпадает с настоящей камерой (вертикаль и локальная горизонталь)', () => {
    const calib = perspectiveFromAnchors(taps(), POINTS)!;
    const mapped = mapTrackToVideoPerspective([{ x: 0, y: 0 }, { x: 2, y: 16.7 }, { x: 0, y: 50 }], calib);
    expect(mapped).toHaveLength(3);
    expect(mapped[0][1]).toBeCloseTo(yImg(0), 3);
    expect(mapped[1][1]).toBeCloseTo(yImg(16.7), 3);
    expect(mapped[2][1]).toBeCloseTo(yImg(50), 3);
    // Горизонталь масштабируется локально: X = X0 + Δx · s(y).
    expect(mapped[1][0]).toBeCloseTo(100 + 2 * perspectiveLocalScale(calib, 16.7), 3);
  });

  it('зеркало X отражает горизонталь вокруг первой привязки', () => {
    const plain = perspectiveFromAnchors(taps(), POINTS)!;
    const mirrored = perspectiveFromAnchors(taps(), POINTS, { mirrorX: true })!;
    const [[a]] = mapTrackToVideoPerspective([{ x: 3, y: 10 }], plain);
    const [[b]] = mapTrackToVideoPerspective([{ x: 3, y: 10 }], mirrored);
    expect(b - 100).toBeCloseTo(-(a - 100), 6);
  });

  it('шум ±1 px не ломает калибровку', () => {
    const noisy = taps().map((t, i) => ({ ...t, videoY: t.videoY + (i % 2 === 0 ? 1 : -1) }));
    const calib = perspectiveFromAnchors(noisy, POINTS)!;
    expect(calib).toBeTruthy();
    expect(calib.fitPx).toBeLessThan(3);
    expect(isPerspectiveSane(calib)).toBe(true);
  });
});

describe('perspectiveFromAnchors — честные отказы', () => {
  it('все точки на одной высоте — проектив не определить', () => {
    const same = POINTS.map((p) => ({ ...p, y: 10 }));
    const anchors = same.map((p, i) => ({ timeSec: p.t, videoX: 100 + i, videoY: 300 }));
    expect(perspectiveFromAnchors(anchors, same)).toBeNull();
  });

  it('разброс высот меньше 3 см — отказ', () => {
    const flat = POINTS.map((p, i) => ({ ...p, y: i }));
    expect(perspectiveFromAnchors(taps(), flat)).toBeNull();
  });

  it('грубый промах в тапе ловится невязкой, а не рисуется кривой линией', () => {
    const calib = perspectiveFromAnchors(taps(-120), POINTS);
    expect(calib).toBeNull();
  });

  it('трёх привязок недостаточно: ошибку не поймать, поэтому честный null', () => {
    expect(perspectiveFromAnchors(taps().slice(0, 3), POINTS)).toBeNull();
  });

  it('пустые точки и пустые привязки — null', () => {
    expect(perspectiveFromAnchors(taps(), [])).toBeNull();
    expect(perspectiveFromAnchors([], POINTS)).toBeNull();
  });
});

describe('isPerspectiveSane / perspectiveSkewPct — защита от мусора', () => {
  const good: PerspectiveCalibration = {
    anchors: [
      { timeSec: 0.1, trackX: 0, trackY: 0, videoX: 100, videoY: 520 },
      { timeSec: 0.4, trackX: 0.5, trackY: 16.7, videoX: 104, videoY: 370 },
      { timeSec: 0.7, trackX: 1, trackY: 33.3, videoX: 108, videoY: 235 },
      { timeSec: 1.0, trackX: 1.5, trackY: 50, videoX: 112, videoY: 100 },
    ],
    vA: -8, vB: 520, vC: 0.004, fitPx: 0.1,
  };

  it('нормальная калибровка проходит', () => {
    expect(isPerspectiveSane(good)).toBe(true);
    expect(perspectiveSkewPct(good)).toBe(31);
  });

  it('NaN, мало привязок и нулевой знаменатель отбрасываются', () => {
    expect(isPerspectiveSane(null)).toBe(false);
    expect(isPerspectiveSane(undefined)).toBe(false);
    expect(isPerspectiveSane({ ...good, anchors: good.anchors.slice(0, 3) })).toBe(false);
    expect(isPerspectiveSane({ ...good, vA: Number.NaN })).toBe(false);
    expect(isPerspectiveSane({ ...good, fitPx: -1 })).toBe(false);
    // vC = −1/16.7 обнуляет знаменатель ровно на привязке y = 16.7.
    expect(isPerspectiveSane({ ...good, vC: -1 / 16.7 })).toBe(false);
    expect(perspectiveSkewPct({ ...good, vA: Number.NaN })).toBeNull();
  });

  it('маппинг по битой калибровке возвращает пусто, а не мусорные точки', () => {
    const broken = { ...good, vA: Number.NaN };
    expect(mapTrackToVideoPerspective([{ x: 0, y: 0 }], broken)).toEqual([]);
    expect(mapTrackToVideoPerspective([], good)).toEqual([]);
  });
});
