import { describe, it, expect } from 'vitest';
import {
  bilateralAsymmetryPct,
  bilateralWeakBonus,
  planBilateralVolume,
  isBilateralBalanced,
} from '../arm-bilateral.engine';

describe('arm-bilateral (эпик B)', () => {
  it('асимметрия %', () => {
    expect(bilateralAsymmetryPct(90, 100)).toBeCloseTo(10, 5);
    expect(bilateralAsymmetryPct(100, 100)).toBe(0);
    expect(bilateralAsymmetryPct(undefined, 100)).toBeNull();
    expect(bilateralAsymmetryPct(0, 0)).toBeNull();
  });
  it('бонус по порогам 7/12', () => {
    expect(bilateralWeakBonus(5)).toBe(0);
    expect(bilateralWeakBonus(8)).toBe(0.15);
    expect(bilateralWeakBonus(12)).toBe(0.25);
    expect(bilateralWeakBonus(null)).toBe(0);
  });
  it('слабая ≥ сильной, кап MRV', () => {
    const p = planBilateralVolume({ leftKg: 80, rightKg: 100, baseSets: 10, mrvSets: 14 });
    expect(p.weakArm).toBe('left');
    expect(p.weakSets).toBeGreaterThanOrEqual(p.strongSets);
    expect(p.weakSets).toBeLessThanOrEqual(14);
    expect(p.strongSets).toBeLessThanOrEqual(14);
    expect(isBilateralBalanced(p)).toBe(true);
  });
  it('симметрия — почти поровну', () => {
    const p = planBilateralVolume({ leftKg: 100, rightKg: 101, baseSets: 10, mrvSets: 18 });
    expect(Math.abs(p.weakSets - p.strongSets)).toBeLessThanOrEqual(3);
    expect(isBilateralBalanced(p)).toBe(true);
  });
  it('без данных — поровну + подсказка', () => {
    const p = planBilateralVolume({ baseSets: 10 });
    expect(p.asymmetryPct).toBeNull();
    expect(p.weakSets).toBe(p.strongSets);
  });
});
