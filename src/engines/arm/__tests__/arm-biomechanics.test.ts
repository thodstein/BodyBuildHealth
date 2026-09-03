import { describe, it, expect } from 'vitest';
import { ARM_BIOMECH, ARM_WEAK_POINTS, isValidAngleForArmWeakPoint, angleJointForWeakPoint, vbtThresholdForWeakPoint, phaseForArmAngle, autoValidateArmAngles } from '../arm-biomechanics.engine';
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
  it('angleJoint: side/back/contain — none, остальные — слайдер', () => {
    expect(angleJointForWeakPoint('side_mid')).toBe('none');
    expect(angleJointForWeakPoint('side_pin')).toBe('none');
    expect(angleJointForWeakPoint('back_start')).toBe('none');
    expect(angleJointForWeakPoint('back_drag')).toBe('none');
    expect(angleJointForWeakPoint('contain_fingers')).toBe('none');
    expect(angleJointForWeakPoint('cup_start')).toBe('wrist');
    expect(angleJointForWeakPoint('pron_open')).toBe('forearm');
    expect(angleJointForWeakPoint('sup_drag')).toBe('elbow');
  });
  it('autoValidate пропускает none-точки', () => {
    const out = autoValidateArmAngles({ elbow: 110, wrist: 10, forearm: 90 }, ['side_mid','cup_start'] as any);
    expect(out.some(r => r.weakPoint === 'side_mid')).toBe(false);
    expect(out.some(r => r.weakPoint === 'cup_start')).toBe(true);
  });
  it('support-путь: contain покрывает RT/Axle', () => {
    expect(ARM_BIOMECH['contain_fingers'].weakMuscles).toContain('grip_support');
    expect(ARM_BIOMECH['contain_fingers'].corrections).toContain('rolling_thunder');
    expect(ARM_BIOMECH['contain_fingers'].corrections).toContain('apollon_axle');
    expect(ARM_CORRECTIONS['contain_fingers'].exercises).toContain('rolling_thunder');
  });
  it('rising покрывает девиаторы', () => {
    expect(ARM_BIOMECH['rising_top'].corrections).toContain('radial_dev_heavy');
    expect(ARM_CORRECTIONS['rising_top'].exercises).toContain('ulnar_dev_heavy');
  });
  it('VBT-пороги по точкам (план §6.3)', () => {
    expect(vbtThresholdForWeakPoint('cup_start')).toEqual({ warnPct: 12, stopPct: 20 });
    expect(vbtThresholdForWeakPoint('pron_lock')).toEqual({ warnPct: 15, stopPct: 25 });
    expect(vbtThresholdForWeakPoint('side_pin')).toEqual({ warnPct: 10, stopPct: 20 });
    expect(vbtThresholdForWeakPoint('contain_fingers')).toEqual({ warnPct: 15, stopPct: 25 });
  });
  it('phaseForArmAngle подсказывает точку', () => {
    expect(phaseForArmAngle({ elbowDeg: 110, wristDeg: -10, forearmDeg: 90 })).toBe('cup_start');
    expect(phaseForArmAngle({ elbowDeg: 110, wristDeg: 10, forearmDeg: 140 })).toBe('pron_lock');
    expect(phaseForArmAngle({ elbowDeg: 110, wristDeg: 10, forearmDeg: 90 })).toBe(null);
  });
  it('phaseForArmAngle для press предлагает side_mid, а не рискованный side_pin', () => {
    expect(phaseForArmAngle({ elbowDeg: 120, wristDeg: 10, forearmDeg: 90, technique: 'press' })).toBe('side_mid');
  });
});
