/**
 * arm-video-tracking.test.ts — живое видео → трек кисти (offline).
 * Каждый тест = поведение движка: калибровка, честные отказы, циклы, метрики.
 */
import { describe, it, expect } from 'vitest';
import {
  buildTrackFromFrames,
  calibratePixelsPerCm,
  videoTrackLine,
  type FrameObservation,
} from '../arm-video-tracking.engine';

/** Генератор «п是国内ной» тяги: N кадров по 66мс, движение по синусу. */
function frames(count: number, opts: { ampCm?: number; period?: number; noisePx?: number; startArea?: number } = {}): FrameObservation[] {
  const amp = opts.ampCm ?? 8; // см
  const period = opts.period ?? 4; // кадров на цикл? нет — на полуцикл
  const pxPerCm = 10; // 10 px на см
  const noise = opts.noisePx ?? 0;
  const out: FrameObservation[] = [];
  for (let i = 0; i < count; i++) {
    const phase = (i % (period * 2)) / (period * 2);
    const x = Math.sin(phase * Math.PI * 2) * amp;      // см
    const y = (1 - Math.cos(phase * Math.PI * 2)) * 4;   // см 0..8
    const n = (i % 3) - 1;                              // дефоном ±1 px
    out.push({
      tMs: i * 66,
      cx: Math.round((80 + x * pxPerCm + n * noise) * 10) / 10,
      cy: Math.round((40 + y * pxPerCm - n * noise) * 10) / 10,
      area: (opts.startArea ?? 60) + (i % 5),
    });
  }
  return out;
}

describe('calibratePixelsPerCm', () => {
  it('считает px/см из известного размера', () => {
    expect(calibratePixelsPerCm(10, 100)).toBe(10);
    expect(calibratePixelsPerCm(9, 45)).toBe(5);
  });
  it('ноль/мусор → 0 (движок откажет, а не придумает масштаб)', () => {
    expect(calibratePixelsPerCm(0, 100)).toBe(0);
    expect(calibratePixelsPerCm(10, 0)).toBe(0);
    expect(calibratePixelsPerCm(-5, 100)).toBe(0);
    expect(calibratePixelsPerCm(NaN, 100)).toBe(0);
  });
});

describe('buildTrackFromFrames — честные отказы', () => {
  it('без калибровки → reason, точек нет', () => {
    const r = buildTrackFromFrames(frames(40), null);
    expect(r.quality.ok).toBe(false);
    expect(r.quality.reason).toMatch(/калибровк/i);
    expect(r.points).toEqual([]);
  });
  it('мало кадров → reason', () => {
    const r = buildTrackFromFrames(frames(4), { pixelsPerCm: 10 });
    expect(r.quality.ok).toBe(false);
    expect(r.quality.reason).toMatch(/кадров/);
  });
  it('нет движения (<1см) → reason (не выдумываем метрики)', () => {
    const still: FrameObservation[] = Array.from({ length: 30 }, (_, i) => ({ tMs: i * 66, cx: 80, cy: 40, area: 40 }));
    const r = buildTrackFromFrames(still, { pixelsPerCm: 10 });
    expect(r.quality.ok).toBe(false);
    expect(r.quality.reason).toMatch(/вижения/);
  });
  it('кадры без времени/координат отбрасываются, пригодных достаточно', () => {
    const f = frames(40).map((x, i) => (i % 4 === 0 ? { ...x, cx: NaN } : x));
    const r = buildTrackFromFrames(f, { pixelsPerCm: 10 });
    expect(r.quality.ok).toBe(true);
    expect(r.points.length).toBeLessThan(40);
  });
  it('пустой вход → reason без исключения', () => {
    expect(buildTrackFromFrames(null, { pixelsPerCm: 10 }).quality.ok).toBe(false);
    expect(buildTrackFromFrames([], { pixelsPerCm: 10 }).quality.ok).toBe(false);
  });
});

describe('buildTrackFromFrames — трек и метрики', () => {
  const cal = { pixelsPerCm: 10 };

  it('трек строится в см, время в секундах от начала', () => {
    const r = buildTrackFromFrames(frames(40), cal);
    expect(r.quality.ok).toBe(true);
    expect(r.points.length).toBe(40);
    expect(r.points[0].t).toBe(0);
    expect(r.points[39].t).toBeCloseTo(39 * 66 / 1000, 1);
    const spanX = Math.max(...r.points.map((p) => p.x)) - Math.min(...r.points.map((p) => p.x));
    expect(spanX).toBeGreaterThan(4); // амплитуда 8см ± шум
  });

  it('циклы выделяются: у двухтактной тяги ≥2 цикла с метриками', () => {
    const r = buildTrackFromFrames(frames(60, { period: 6, ampCm: 10 }), cal);
    expect(r.cycles.length).toBeGreaterThanOrEqual(2);
    for (const c of r.cycles) {
      expect(c.endT).toBeGreaterThanOrEqual(c.startT);
      expect(c.xLoop).toBeGreaterThan(0);
      expect(c.vMax).toBeGreaterThan(0);
    }
  });

  it('ровный drag без ускорений = ОДИН проход (float-шум скорости не плодит циклы)', () => {
    // медленный монотонный drag: скорость постоянна → строгие пики не находятся
    const slow: FrameObservation[] = Array.from({ length: 30 }, (_, i) => ({
      tMs: i * 100,
      cx: 60 + i * 4,      // линейный дрейф ~12 см
      cy: 40,
      area: 50,
    }));
    const r = buildTrackFromFrames(slow, { pixelsPerCm: 10 });
    expect(r.quality.ok).toBe(true);
    expect(r.cycles.length).toBe(1);
    expect(r.cycles[0].endT - r.cycles[0].startT).toBeCloseTo(29 * 100 / 1000, 1);
    expect(r.notes.join(' ')).not.toMatch(/циклы не выделились/);
  });

  it('flipY переворачивает ось (верх = +)', () => {
    const up: FrameObservation[] = Array.from({ length: 20 }, (_, i) => ({ tMs: i * 66, cx: 80, cy: 40 - i, area: 40 }));
    const plain = buildTrackFromFrames(up, cal);
    const flipped = buildTrackFromFrames(up, { ...cal, flipY: true });
    const yPlain = plain.points[plain.points.length - 1].y;
    const yFlip = flipped.points[flipped.points.length - 1].y;
    expect(yPlain).toBeLessThan(0);
    expect(yFlip).toBeGreaterThan(0);
    expect(yFlip).toBeCloseTo(-yPlain, 5);
  });

  it('notes честны про единицы и нуль отсчёта', () => {
    const r = buildTrackFromFrames(frames(30), cal);
    expect(r.notes.join(' ')).toMatch(/сантиметры/);
    expect(r.notes.join(' ')).toMatch(/нуль/);
  });
});

describe('videoTrackLine', () => {
  it('ok → краткая сводка с циклами', () => {
    const r = buildTrackFromFrames(frames(40), { pixelsPerCm: 10 });
    expect(videoTrackLine(r)).toMatch(/Кадров 40/);
  });
  it('отказ → причина (не пустая строка)', () => {
    const r = buildTrackFromFrames(frames(40), null);
    expect(videoTrackLine(r)).toMatch(/калибровк/i);
    expect(videoTrackLine(null)).toBeTruthy();
  });
});
