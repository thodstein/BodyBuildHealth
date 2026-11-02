import { describe, it, expect } from 'vitest';
import {
  referenceAngleCheck,
  referenceHorizontalCorrection,
  perspectiveTrackYForVideoY,
  perspectiveLocalScale,
  type PerspectiveCalibration,
} from '../trajectory-overlay.engine';

/**
 * Эталон в кадре: отрезок известной длины поперёк движения штанги. Камера в
 * плоскости движения видит его в полную длину, повёрнутая — укороченным в cos φ.
 * Проверяем именно это, а не «похоже на фронт».
 */

/** Отрезок по горизонтали, видимая длина dPx при масштабе pxPerCm — обёртка для читаемости тестов. */
function check(dPx: number, lengthCm: number, pxPerCm: number) {
  return referenceAngleCheck(
    { a: { x: 100, y: 300 }, b: { x: 100 + dPx, y: 300 }, lengthCm },
    { pxPerCm },
  );
}

describe('referenceAngleCheck — угол камеры по эталону в кадре', () => {
  it('мусор на входе → null: угол не выдумывается', () => {
    expect(referenceAngleCheck(null)).toBeNull();
    expect(referenceAngleCheck(undefined)).toBeNull();
    expect(referenceAngleCheck({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, lengthCm: 0 })).toBeNull();
    expect(referenceAngleCheck({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, lengthCm: -5 })).toBeNull();
    // 10 метров «эталона» — опечатка, а не измерение
    expect(referenceAngleCheck({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, lengthCm: 1000 })).toBeNull();
    expect(referenceAngleCheck({ a: { x: NaN, y: 0 }, b: { x: 10, y: 0 }, lengthCm: 10 })).toBeNull();
  });

  it('без масштаба кадра угол не выдаётся, хотя пиксели есть', () => {
    const r = referenceAngleCheck({ a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, lengthCm: 100 })!;
    expect(r.flag).toBe('unknown');
    expect(r.azimuthDeg).toBeNull();
    expect(r.reason).toContain('Без масштаба кадра');
    expect(r.reason).toContain('калибровка кадра');
  });

  it('слишком короткий отрезок в кадре — честный отказ, а не грубый угол', () => {
    const r = check(12, 6, 2)!;
    expect(r.flag).toBe('unknown');
    expect(r.azimuthDeg).toBeNull();
    expect(r.reason).toContain('12 px');
    expect(r.reason).toContain('4°');
  });

  it('камера в плоскости движения: наблюдаемая длина равна реальной, угол 0°', () => {
    const r = check(200, 100, 2)!;
    expect(r.flag).toBe('ok');
    expect(r.azimuthDeg).toBe(0);
    expect(r.observedCm).toBe(100);
    expect(r.expectedCm).toBe(100);
    expect(r.ratio).toBe(1);
    expect(r.reason).toContain('Камера в плоскости движения (отклонение 0°)');
    // Направление по одному кадру не определяется — это сказано всегда.
    expect(r.reason).toContain('Направление «слева/справа» по одному кадру не определяется');
  });

  it('поворот на 60°: отрезок виден ровно вдвое короче (cos 60°)', () => {
    const r = check(100, 100, 2)!;
    expect(r.flag).toBe('ok');
    expect(r.azimuthDeg).toBe(60);
    expect(r.ratio).toBe(0.5);
    expect(r.reason).toContain('Камера почти спереди');
    expect(r.reason).toContain('несравнимы');
  });

  it('поворот на 25°: угол и потеря горизонтали названы числом', () => {
    const cos25 = Math.cos((25 * Math.PI) / 180);
    const r = check(200 * cos25, 100, 2)!;
    expect(r.azimuthDeg).toBe(25);
    expect(r.reason).toContain('отклонена от плоскости движения на 25°');
    expect(r.reason).toContain('укорочена примерно на 9%');
  });

  it('эталон ближе к камере, чем калибровочная плоскость: угол не выдаётся', () => {
    const r = check(260, 100, 2)!; // 130 см вместо 100
    expect(r.flag).toBe('unknown');
    expect(r.azimuthDeg).toBeNull();
    expect(r.reason).toContain('длиннее, чем должен');
    expect(r.reason).toContain('плоскости движения штанги');
  });

  it('наклонный отрезок считается по гипотенузе, а не по одной оси', () => {
    // 120×160 px = 200 px ровно
    const r = referenceAngleCheck(
      { a: { x: 0, y: 0 }, b: { x: 120, y: 160 }, lengthCm: 100 },
      { pxPerCm: 2 },
    )!;
    expect(r.observedCm).toBe(100);
    expect(r.azimuthDeg).toBe(0);
  });

  it('масштаб вне правдоподобного диапазона (опечатка) — отказ, а не 90°', () => {
    const r = check(200, 100, 5000)!;
    expect(r.flag).toBe('unknown');
    expect(r.azimuthDeg).toBeNull();
  });
});

describe('referenceHorizontalCorrection — поправка горизонтали на ракурс', () => {
  /** ratio = cos φ: 0.906 — камера отклонена на 25°, 0.5 — на 60°. */
  const ok25 = { ratio: 0.906, azimuthDeg: 25, spanPx: 300 };

  it('нет значения или ракурса → unknown, а не «0% поправки»', () => {
    expect(referenceHorizontalCorrection(null, ok25).flag).toBe('unknown');
    expect(referenceHorizontalCorrection(0, ok25).flag).toBe('unknown');
    expect(referenceHorizontalCorrection(NaN, ok25).flag).toBe('unknown');
    expect(referenceHorizontalCorrection(10, null).flag).toBe('unknown');
    // ratio > 1.12 — это не угол, а сломанный замер: поправку по нему не считаем.
    expect(referenceHorizontalCorrection(10, { ratio: 1.3, azimuthDeg: 0, spanPx: 300 }).flag).toBe('unknown');
    expect(referenceHorizontalCorrection(10, { ratio: 0, azimuthDeg: 25, spanPx: 300 }).flag).toBe('unknown');
  });

  it('25°: измеренное делится на cos φ, поправка названа числом', () => {
    const r = referenceHorizontalCorrection(10, ok25)!;
    expect(r.flag).toBe('ok');
    expect(r.pct).toBe(10.4);
    expect(r.correctedCm).toBe(11.04);
    expect(r.errPct).toBe(0.7);
    // Поправка — это перенос в плоскость движения, а не «исправленная правда».
    expect(r.reason).toContain('оценка');
    expect(r.reason).toContain('не заменяет');
  });

  it('поправка меньше точности тапа → не применяется (negligible)', () => {
    // ratio 0.99 — 8°, но эталон всего 40 px: точность ±5.3% больше самой поправки.
    const r = referenceHorizontalCorrection(10, { ratio: 0.99, azimuthDeg: 8, spanPx: 40 })!;
    expect(r.flag).toBe('negligible');
    expect(r.correctedCm).toBe(10);
    expect(r.reason).toContain('не больше точности замера');
  });

  it('почти спереди: поправка отклонена, а не «домножена» на 2', () => {
    const r = referenceHorizontalCorrection(10, { ratio: 0.5, azimuthDeg: 60, spanPx: 300 })!;
    expect(r.flag).toBe('refused');
    expect(r.correctedCm).toBeNull();
    expect(r.pct).toBe(100);
    expect(r.reason).toContain('не исправляется');
  });

  it('без длины эталона в пикселях поправка есть, но точность честно не оценена', () => {
    const r = referenceHorizontalCorrection(10, { ratio: 0.906, azimuthDeg: 25 })!;
    expect(r.flag).toBe('ok');
    expect(r.errPct).toBeNull();
    expect(r.reason).toContain('точность поправки не оценена');
  });

  it('точность тапа настраивается (а не зашита в текст)', () => {
    const coarse = referenceHorizontalCorrection(10, ok25, { tapPx: 4 })!;
    expect(coarse.errPct).toBe(1.9);
    const lenient = referenceHorizontalCorrection(10, { ratio: 0.99, azimuthDeg: 8, spanPx: 40 }, { tapPx: 0.2 })!;
    // точный тап: ±0.7% — уже не «в пределах шума», поправка применяется
    expect(lenient.flag).toBe('ok');
  });

  it('замер угла несёт длину эталона в пикселях — от неё зависит точность', () => {
    const r = referenceAngleCheck(
      { a: { x: 0, y: 0 }, b: { x: 300, y: 400 }, lengthCm: 250 },
      { pxPerCm: 2 },
    )!;
    expect(r.spanPx).toBe(500);
    expect(r.ratio).toBe(1);
  });
});

describe('perspectiveTrackYForVideoY — обратная связь перспективы', () => {
  const calib: PerspectiveCalibration = {
    anchors: [
      { timeSec: 0.1, trackX: 0, trackY: 0, videoX: 100, videoY: 520 },
      { timeSec: 0.4, trackX: 0.5, trackY: 16.7, videoX: 104, videoY: 362.2 },
      { timeSec: 0.7, trackX: 1, trackY: 33.3, videoX: 108, videoY: 223.8 },
      { timeSec: 1.0, trackX: 1.5, trackY: 50, videoX: 112, videoY: 100 },
    ],
    vA: -8,
    vB: 520,
    vC: 0.004,
    fitPx: 0.4,
  };

  it('восстанавливает высоту трека по пикселю кадра (round-trip)', () => {
    for (const a of calib.anchors) {
      const y = perspectiveTrackYForVideoY(calib, a.videoY)!;
      // Коэффициенты в тесте округлены, поэтому 2 знака, а не 3.
      expect(y).toBeCloseTo(a.trackY, 2);
      // и масштаб на этой высоте положителен
      expect(perspectiveLocalScale(calib, y)).toBeGreaterThan(0);
    }
  });

  it('вырожденная связь (знаменатель ~0) → null, а не бесконечность', () => {
    const degenerate: PerspectiveCalibration = { ...calib, vA: 5, vC: 0.01 };
    // videoY * vC - vA = 500*0.01 - 5 = 0
    expect(perspectiveTrackYForVideoY(degenerate, 500)).toBeNull();
  });

  it('невалидная перспектива → null', () => {
    expect(perspectiveTrackYForVideoY({ ...calib, anchors: [] }, 300)).toBeNull();
    expect(perspectiveTrackYForVideoY(calib, NaN)).toBeNull();
  });
});
