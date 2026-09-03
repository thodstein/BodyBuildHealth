import { describe, it, expect } from 'vitest';
import {
  armEpley1RM,
  smallMuscleE1RM,
  holdE1RM,
  workMaxFromBenchmarks,
  ensureRadialFingers,
  loadPctFor,
} from '../arm-load-quant.engine';

describe('arm-load-quant (эпик F)', () => {
  it('epley гард 1-12', () => {
    expect(armEpley1RM(100, 5)).toBeCloseTo(116.7, 0);
    expect(armEpley1RM(100, 0)).toBeNull();
    expect(armEpley1RM(100, 15)).toBeNull();
    expect(armEpley1RM(-5, 5)).toBeNull();
  });
  it('мелкие только 3-8', () => {
    expect(smallMuscleE1RM(30, 5)).not.toBeNull();
    expect(smallMuscleE1RM(30, 2)).toBeNull();
    expect(smallMuscleE1RM(30, 15)).toBeNull();
  });
  it('hold-оценка', () => {
    expect(holdE1RM(50, 10)).toBe(50);
    expect(holdE1RM(50, 20)!).toBeGreaterThan(50);
    expect(holdE1RM(0, 10)).toBeNull();
  });
  it('бенчи → workMax вместо 30', () => {
    const wm = workMaxFromBenchmarks({ wristCurlLb: 100, rtKg: 80, sideKg: 50, cocLevel: 2, pronHoldSec: 45, cupHoldSec: 30 });
    expect(wm['wrist_flexors']).toBeCloseTo(45.4, 0);
    expect(wm['grip_support']).toBe(80);
    expect(wm['side_pressure']).toBe(50);
    expect(wm['grip_crush']).toBe(50);
    expect(wm['pronators']).toBe(28);
  });
  it('radial/fingers обязательны', () => {
    expect(ensureRadialFingers(['wrist_flexors'])).toEqual(
      expect.arrayContaining(['radial_deviators', 'risers', 'thumb']),
    );
  });
  it('проценты нагрузки', () => {
    expect(loadPctFor('тяж')).toBe(0.82);
    expect(loadPctFor('техника')).toBe(0.6);
    expect(loadPctFor('памп')).toBe(0.68);
  });
});
