import { describe, it, expect } from 'vitest';
import { ARM_BIOMECH, ARM_WEAK_POINTS, isValidAngleForArmWeakPoint } from '../arm-biomechanics.engine';
import { ARM_CORRECTIONS, validateArmCorrections } from '../arm-weakpoint-corrections';
import { getArmExercises } from '../../../core/exercise-catalog-arm';

describe('arm-biomechanics 12 точек', () => {
  it('12 weakPoints существуют', () => {
    expect(ARM_WEAK_POINTS.length).toBe(12);
    expect(new Set(ARM_WEAK_POINTS).size).toBe(12);
  });
  it('каждая точка имеет angleRange, weakMuscles, intensity 0.60-0.75', () => {
    for (const wp of ARM_WEAK_POINTS) {
      const b = ARM_BIOMECH[wp];
      expect(b, wp).toBeTruthy();
      expect(b.angleRangeDeg[0] < b.angleRangeDeg[1]).toBe(true);
      expect(b.weakMuscles.length >= 1).toBe(true);
      expect(b.intensityPct).toBeGreaterThanOrEqual(0.6);
      expect(b.intensityPct).toBeLessThanOrEqual(0.75);
      expect(b.corrections.length).toBeGreaterThanOrEqual(2);
      expect(b.biomechanicalReason.length).toBeGreaterThan(20);
    }
  });
  it('corrections ids существуют в каталоге', () => {
    const ids = new Set(getArmExercises().map(e=>e.id));
    const errs = validateArmCorrections(ids);
    expect(errs, errs.join(', ')).toEqual([]);
  });
  it('isValidAngle работает', () => {
    expect(isValidAngleForArmWeakPoint('cup_start', 10)).toBe(true);
    expect(isValidAngleForArmWeakPoint('cup_start', 30)).toBe(false);
    expect(isValidAngleForArmWeakPoint('pron_lock', 140)).toBe(true);
    expect(isValidAngleForArmWeakPoint('side_pin', 40)).toBe(true);
    expect(isValidAngleForArmWeakPoint('side_pin', 10)).toBe(false);
  });
});
