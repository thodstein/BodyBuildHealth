import { describe, expect, it } from 'vitest';
import { femaleToMaleRatio, sinclairScore } from '../relative-strength.engine';
import { getStrengthLevel, getStrengthPercentile } from '../../performance-analytics.engine';

describe('P4 DOTS-ratio вместо плоских 0.62', () => {
  it('якоря кривой: 50→1.26, 80→~1.366, 120→~1.397', () => {
    expect(femaleToMaleRatio(50)).toBeCloseTo(1.26, 2);
    expect(femaleToMaleRatio(80)).toBeCloseTo(1.366, 2);
    expect(femaleToMaleRatio(120)).toBeCloseTo(1.397, 2);
  });
  it('монотонность и кламп', () => {
    expect(femaleToMaleRatio(90)).toBeGreaterThan(femaleToMaleRatio(60));
    expect(femaleToMaleRatio(0)).toBe(1.37);
    expect(femaleToMaleRatio(200)).toBeLessThanOrEqual(1.45);
  });
  it('женщина с тем же результатом — уровень не ниже мужского', () => {
    const m = getStrengthLevel('squat', 80, 140, 'male');
    const f = getStrengthLevel('squat', 80, 140, 'female');
    const order = ['untrained', 'novice', 'intermediate', 'advanced', 'elite', 'world_class'];
    expect(order.indexOf(f)).toBeGreaterThanOrEqual(order.indexOf(m));
    expect(getStrengthPercentile('squat', 80, 140, 'female')).toBeGreaterThanOrEqual(
      getStrengthPercentile('squat', 80, 140, 'male'),
    );
  });
});

describe('P4 Sinclair (IWF 2021–2024)', () => {
  it('М 81/300 → ~380.8', () => {
    expect(sinclairScore(300, 81, 'male')).toBeCloseTo(380.8, 0);
  });
  it('тяжёлая категория → почти тотал; мусор → 0', () => {
    expect(sinclairScore(300, 200, 'male')).toBe(300);
    expect(sinclairScore(0, 81, 'male')).toBe(0);
    expect(sinclairScore(200, 60, 'female')).toBeGreaterThan(200);
  });
});
