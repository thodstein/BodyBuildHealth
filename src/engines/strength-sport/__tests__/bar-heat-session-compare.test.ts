import { describe, it, expect } from 'vitest';
import {
  barSpeedHeat,
  BAR_HEAT_COLORS,
  snapshotBarRep,
  compareBarSessions,
  segmentBarReps,
  type BarPoint,
  type BarRepSnapshot,
} from '../strength-sport-video.engine';

/** Равномерная серия: подъём 40 см за 0.4 с, спуск 40 см за 0.8 с → скорость различается. */
const FAST_UP: BarPoint[] = [
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

describe('barSpeedHeat — heatmapping траектории по скорости', () => {
  it('отрезков на один меньше, чем точек, и все с конечной скоростью', () => {
    const segs = barSpeedHeat(FAST_UP);
    expect(segs).toHaveLength(FAST_UP.length - 1);
    for (const s of segs) {
      expect(Number.isFinite(s.speed)).toBe(true);
      expect(['slow', 'mid', 'fast']).toContain(s.level);
    }
  });

  it('быстрый подъём окрашивается «fast», медленный спуск — «slow»', () => {
    const segs = barSpeedHeat(FAST_UP);
    // первые 4 отрезка — подъём (100 см/с), последние 4 — спуск (50 см/с)
    expect(segs[0].level).toBe('fast');
    expect(segs[segs.length - 1].level).toBe('slow');
  });

  it('без валидного времени отрезки пропускаются (скорость не выдумывается)', () => {
    expect(barSpeedHeat([{ t: 0, x: 0, y: 0 }, { t: 0, x: 0, y: 10 }])).toHaveLength(0);
    expect(barSpeedHeat([{ t: 0, x: 0, y: 0 }])).toHaveLength(0);
    expect(barSpeedHeat([])).toHaveLength(0);
    expect(barSpeedHeat([{ t: NaN, x: 0, y: 0 }, { t: 1, x: 0, y: 10 }])).toHaveLength(0);
  });

  it('цвета уровней заданы и различаются', () => {
    expect(BAR_HEAT_COLORS.fast).not.toBe(BAR_HEAT_COLORS.mid);
    expect(BAR_HEAT_COLORS.mid).not.toBe(BAR_HEAT_COLORS.slow);
  });
});

describe('snapshotBarRep — компактное представление повтора для персиста', () => {
  const rep = segmentBarReps(FAST_UP)[0];

  it('прореживает точки до maxPoints, сохраняя первую и последнюю', () => {
    const snap = snapshotBarRep(rep, 5);
    expect(snap.points.length).toBeLessThanOrEqual(5);
    expect(snap.points[0]).toEqual([Math.round(rep.points[0].x * 10) / 10, Math.round(rep.points[0].y * 10) / 10]);
    const last = rep.points[rep.points.length - 1];
    expect(snap.points[snap.points.length - 1]).toEqual([Math.round(last.x * 10) / 10, Math.round(last.y * 10) / 10]);
  });

  it('сохраняет сводку повтора (vmax/xLoop/amplitude) с округлением', () => {
    const snap = snapshotBarRep(rep);
    expect(snap.index).toBe(rep.index);
    expect(snap.vmax).toBeCloseTo(Math.round(rep.vmax * 100) / 100, 5);
    expect(snap.xLoop).toBeCloseTo(Math.round(rep.xLoop * 10) / 10, 5);
  });

  it('пустой повтор не ломается', () => {
    const empty = { index: 1, vmax: 0, xLoop: 0, amplitude: 0, points: [] } as unknown as Parameters<typeof snapshotBarRep>[0];
    expect(snapshotBarRep(empty).points).toEqual([]);
  });
});

describe('compareBarSessions — «прошлая сессия vs текущая»', () => {
  const base: BarRepSnapshot = { index: 1, vmax: 0.5, xLoop: 2, amplitude: 40, points: [] };

  it('падение vmax ≥5% → verdict worse и текст с дельтой', () => {
    const cmp = compareBarSessions(base, { ...base, vmax: 0.44, xLoop: 2.5 });
    expect(cmp?.verdict).toBe('worse');
    expect(cmp?.deltaPct).toBe(-12);
    expect(cmp?.deltaXLoopCm).toBe(0.5);
    expect(cmp?.text).toContain('ниже прошлой сессии');
    expect(cmp?.text).toContain('-12%');
  });

  it('рост vmax ≥5% → verdict better', () => {
    expect(compareBarSessions(base, { ...base, vmax: 0.55 })?.verdict).toBe('better');
  });

  it('в пределах ±5% → verdict same', () => {
    const cmp = compareBarSessions(base, { ...base, vmax: 0.51 });
    expect(cmp?.verdict).toBe('same');
    expect(cmp?.text).toContain('на уровне');
  });

  it('без данных (или нулевой vmax) сравнения нет — null, а не «0%»', () => {
    expect(compareBarSessions(null, base)).toBeNull();
    expect(compareBarSessions(base, null)).toBeNull();
    expect(compareBarSessions({ ...base, vmax: 0 }, base)).toBeNull();
  });
});
