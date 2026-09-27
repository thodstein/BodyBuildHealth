/**
 * lms-detraining.test.ts — тесты детренированности (Yilmaz 2026, JSCR).
 * Проверяет: ступени потерь, граничные значения, корректность на крайних случаев.
 */

import { describe, it, expect } from 'vitest';
import { computeDetrainingPM } from '../lms-progression.engine';

describe('Детренированность', () => {
  it('без пауз — без потерь', () => {
    expect(computeDetrainingPM(100, 0)).toBe(100);
    expect(computeDetrainingPM(100, 3)).toBe(100);
    expect(computeDetrainingPM(100, 6)).toBe(100);
  });

  it('7-13 дней — −3%', () => {
    expect(computeDetrainingPM(100, 7)).toBe(97);
    expect(computeDetrainingPM(100, 10)).toBe(97);
    expect(computeDetrainingPM(100, 13)).toBe(97);
  });

  it('14-20 дней — −8%', () => {
    expect(computeDetrainingPM(100, 14)).toBe(92);
    expect(computeDetrainingPM(100, 17)).toBe(92);
    expect(computeDetrainingPM(100, 20)).toBe(92);
  });

  it('21-34 дня — −13%', () => {
    expect(computeDetrainingPM(100, 21)).toBe(87);
    expect(computeDetrainingPM(100, 28)).toBe(87);
    expect(computeDetrainingPM(100, 34)).toBe(87);
  });

  it('35+ дней — потолок −18%', () => {
    expect(computeDetrainingPM(100, 35)).toBe(82);
    expect(computeDetrainingPM(100, 60)).toBe(82);
    expect(computeDetrainingPM(100, 365)).toBe(82);
  });

  it('граничные значения — корректные ступени', () => {
    expect(computeDetrainingPM(200, 14)).toBe(184);
    expect(computeDetrainingPM(50, 21)).toBe(43.5);
  });

  it('невалидный PM — возвращается как есть', () => {
    expect(computeDetrainingPM(0, 14)).toBe(0);
    expect(computeDetrainingPM(-10, 14)).toBe(-10);
    expect(computeDetrainingPM(NaN, 14)).toBe(NaN);
  });

  it('невалидные дни — возвращается PM без изменений', () => {
    expect(computeDetrainingPM(100, -5)).toBe(100);
    expect(computeDetrainingPM(100, NaN)).toBe(100);
  });

  it('монотонность: чем дольше пауза, тем больше потери (до потолка)', () => {
    const pm = 100;
    const losses = [3, 7, 14, 21, 35].map(d => computeDetrainingPM(pm, d));
    for (let i = 1; i < losses.length; i++) {
      expect(losses[i]).toBeLessThan(losses[i - 1]);
    }
    // Потолок: 35 и 60 дней дают одинаковый результат
    expect(computeDetrainingPM(pm, 60)).toBe(computeDetrainingPM(pm, 35));
  });
});
