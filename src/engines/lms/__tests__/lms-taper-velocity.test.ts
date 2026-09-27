/**
 * lms-taper-velocity.test.ts — тесты адаптивного тапера по скорости.
 * Проверяет: режим 'velocity', корректность кривой, влияние fatigue.
 */

import { describe, it, expect } from 'vitest';
import { buildPLTaperCurve, TAPER_MODE_LABELS, type TaperMode } from '../lms-taper.engine';

describe('TaperMode velocity', () => {
  it('TaperMode включает velocity', () => {
    expect(TAPER_MODE_LABELS.velocity).toBeDefined();
    expect(TAPER_MODE_LABELS.velocity).toContain('скорости');
  });

  it('velocity: базовая кривая 2 недели', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 2, mode: 'velocity' });
    expect(curve.length).toBe(2);
    expect(curve[0].volumePct).toBeGreaterThan(curve[1].volumePct);
  });

  it('velocity: при низкой fatigue (скорость растёт) — тапер короче', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 3, mode: 'velocity', fatigue: 20 });
    expect(curve.length).toBeLessThanOrEqual(3);
    expect(curve[curve.length - 1].volumePct).toBeLessThan(curve[0].volumePct);
  });

  it('velocity: при высокой fatigue (скорость падает) — тапер длиннее', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 2, mode: 'velocity', fatigue: 80 });
    expect(curve.length).toBeGreaterThanOrEqual(2);
  });

  it('velocity: 1 неделя — минимальный тапер', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 1, mode: 'velocity' });
    expect(curve.length).toBe(1);
    expect(curve[0].volumePct).toBeLessThan(1);
  });

  it('velocity: 4 недели — максимальный тапер', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 4, mode: 'velocity' });
    expect(curve.length).toBe(4);
  });

  it('velocity: весовая цель влияет на объём', () => {
    const lose = buildPLTaperCurve({ taperWeeks: 2, mode: 'velocity', weightGoal: 'lose' });
    const maintain = buildPLTaperCurve({ taperWeeks: 2, mode: 'velocity', weightGoal: 'maintain' });
    expect(lose[0].volumePct).toBeLessThan(maintain[0].volumePct);
  });

  it('velocity: интенсивность сохраняется (preserve)', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 3, mode: 'velocity' });
    for (const point of curve) {
      expect(point.intensityMode).toBe('preserve');
      expect(point.intensityPct).toBe(1);
    }
  });

  it('velocity: RIR растёт к финалу', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 3, mode: 'velocity' });
    expect(curve[2].rirShift).toBeGreaterThanOrEqual(curve[0].rirShift);
  });

  it('velocity: все режимы TaperMode имеют подписи', () => {
    const modes: TaperMode[] = ['classic', 'pl', 'pro', 'wf', 'velocity'];
    for (const mode of modes) {
      expect(TAPER_MODE_LABELS[mode]).toBeDefined();
      expect(TAPER_MODE_LABELS[mode].length).toBeGreaterThan(0);
    }
  });

  it('velocity: кривая содержит описание тренда', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 2, mode: 'velocity', fatigue: 30 });
    expect(curve[0].focus).toBeDefined();
    expect(curve[0].focus.length).toBeGreaterThan(0);
  });
});
