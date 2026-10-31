import { describe, it, expect } from 'vitest';
import {
  segmentBarReps,
  barRepOverlay,
  type BarPoint,
} from '../strength-sport-video.engine';

/**
 * Синтетическая серия повторов: каждый повтор — подъём на amp см за upDur с,
 * затем спуск за downDur с. Позволяет задать «усталость» через рост upDur.
 */
function buildSeries(opts: {
  amps: number[];
  upDur: number[];
  downDur?: number;
  fps?: number;
  xDrift?: number;
  startT?: number;
}): BarPoint[] {
  const fps = opts.fps ?? 30;
  const downDur = opts.downDur ?? 0.8;
  const drift = opts.xDrift ?? 0;
  const dt = 1 / fps;
  const pts: BarPoint[] = [];
  let t = opts.startT ?? 0;
  const push = (y: number, x: number) => pts.push({ t: Math.round(t * 1000) / 1000, x, y });
  push(0, 0);
  for (let i = 0; i < opts.amps.length; i++) {
    const amp = opts.amps[i];
    const up = opts.upDur[i];
    const nUp = Math.max(2, Math.round(up / dt));
    for (let k = 1; k <= nUp; k++) {
      t += dt;
      const frac = k / nUp;
      // лёгкая нелинейность, чтобы не был идеально линейный рамп
      const y = amp * (frac * 0.85 + 0.15 * (1 - Math.cos(Math.PI * frac)) / 2);
      push(y, drift * frac);
    }
    const nDown = Math.max(2, Math.round(downDur / dt));
    for (let k = 1; k <= nDown; k++) {
      t += dt;
      push(amp * (1 - k / nDown), drift * (1 - k / nDown));
    }
  }
  return pts;
}

describe('segmentBarReps — нарезка серии на повторы', () => {
  it('три повтора распознаются, метрики каждого посчитаны', () => {
    const pts = buildSeries({ amps: [40, 40, 40], upDur: [0.8, 0.9, 1.0] });
    const reps = segmentBarReps(pts);
    expect(reps.length).toBe(3);
    reps.forEach(r => {
      expect(r.amplitude).toBeGreaterThan(20);
      expect(r.vmax).toBeGreaterThan(0);
      expect(r.durationMs).toBeGreaterThan(200);
    });
    // Время монотонно растёт — повторы идут по порядку.
    expect(reps[0].startT).toBeLessThan(reps[2].startT);
    expect(reps.map(r => r.index)).toEqual([1, 2, 3]);
  });

  it('один повтор — серия из одного, overlay недоступен (не выдумываем)', () => {
    const pts = buildSeries({ amps: [40], upDur: [0.8] });
    const reps = segmentBarReps(pts);
    expect(reps.length).toBe(1);
    expect(barRepOverlay(reps)).toBeNull();
  });

  it('почти неподвижная штанга — повторов нет', () => {
    const pts: BarPoint[] = Array.from({ length: 40 }, (_, i) => ({ t: i / 30, x: 0, y: 20 + (i % 2) * 0.3 }));
    expect(segmentBarReps(pts)).toEqual([]);
  });

  it('xLoop внутри повтора считается по горизонтали этого повтора', () => {
    const pts = buildSeries({ amps: [40, 40], upDur: [0.8, 0.8], xDrift: 3 });
    const reps = segmentBarReps(pts);
    expect(reps.length).toBe(2);
    // x гуляет 0→3 см на подъёме: xLoop ≈ 3 (сглаживание может чуть уменьшить).
    expect(reps[0].xLoop).toBeGreaterThan(1.5);
    expect(reps[0].xLoop).toBeLessThanOrEqual(3.1);
  });
});

describe('barRepOverlay — первый vs последний повтор', () => {
  it('падение скорости на ~20% → warn', () => {
    const pts = buildSeries({ amps: [40, 40, 40], upDur: [0.8, 0.9, 1.0] });
    const ov = barRepOverlay(segmentBarReps(pts));
    expect(ov).not.toBeNull();
    expect(ov!.reps).toBe(3);
    expect(ov!.velocityLossPct).toBeLessThanOrEqual(-10);
    expect(ov!.velocityLossPct).toBeGreaterThanOrEqual(-35);
    expect(ov!.verdict).toBe('warn');
    expect(ov!.text).toContain('Повторы: 3');
    expect(ov!.text).toContain('заметная потеря скорости');
  });

  it('скорость держится → ok', () => {
    const pts = buildSeries({ amps: [40, 40, 40], upDur: [0.8, 0.8, 0.8] });
    const ov = barRepOverlay(segmentBarReps(pts));
    expect(ov).not.toBeNull();
    expect(ov!.verdict).toBe('ok');
    expect(Math.abs(ov!.velocityLossPct)).toBeLessThan(15);
  });

  it('сильное падение (>25%) → crit и честная подпись', () => {
    const pts = buildSeries({ amps: [40, 40], upDur: [0.6, 1.2] });
    const ov = barRepOverlay(segmentBarReps(pts));
    expect(ov).not.toBeNull();
    expect(ov!.velocityLossPct).toBeLessThanOrEqual(-25);
    expect(ov!.verdict).toBe('crit');
    expect(ov!.text).toContain('критическая потеря скорости');
  });

  it('амплитуда и xLoop отдаются дельтами, а не абсолютом', () => {
    const pts = buildSeries({ amps: [40, 30], upDur: [0.8, 0.8], xDrift: 2 });
    const ov = barRepOverlay(segmentBarReps(pts));
    expect(ov).not.toBeNull();
    expect(ov!.amplitudeDeltaCm).toBeLessThan(0); // второй повтор ниже
    expect(ov!.first.amplitude).toBeGreaterThan(ov!.last.amplitude);
  });
});
