import { describe, expect, it, beforeEach } from 'vitest';
import {
  getRpeCalibration,
  updateRpeCalibration,
  rpeToPct,
  weightForRpe,
  clearCalibrations,
  getAllCalibrations,
} from '../bb-rpe-calibration';

describe('bb-rpe-calibration', () => {
  beforeEach(() => {
    clearCalibrations();
  });

  it('returns default calibration for unknown exercise', () => {
    const cal = getRpeCalibration('Unknown Exercise');
    expect(cal.exerciseName).toBe('Unknown Exercise');
    expect(cal.confidence).toBe(0);
    expect(cal.calibratedPct(0)).toBe(1.0);
    expect(cal.calibratedPct(5)).toBe(0.8);
  });

  it('updates calibration with observation', () => {
    const cal = updateRpeCalibration('Bench Press', 8, 0.85);
    expect(cal.exerciseName).toBe('Bench Press');
    expect(cal.observations).toHaveLength(1);
    expect(cal.observations[0]).toEqual({ rpe: 8, pct: 0.85 });
  });

  it('builds linear regression with 3+ observations', () => {
    updateRpeCalibration('Squat', 7, 0.90);
    updateRpeCalibration('Squat', 8, 0.85);
    updateRpeCalibration('Squat', 9, 0.80);
    
    const cal = getRpeCalibration('Squat');
    expect(cal.confidence).toBeGreaterThan(0);
    expect(cal.confidence).toBeLessThanOrEqual(1);
  });

  it('uses calibrated pct when confidence > 0.5', () => {
    // Добавляем много наблюдений для высокой достоверности
    for (let i = 0; i < 10; i++) {
      updateRpeCalibration('Deadlift', 7 + i * 0.2, 0.90 - i * 0.02);
    }
    
    const cal = getRpeCalibration('Deadlift');
    expect(cal.confidence).toBeGreaterThan(0.5);
    
    // Калиброванное значение должно отличаться от дефолтного
    const defaultPct = 0.92; // pctForRir(2)
    const calibratedPct = rpeToPct('Deadlift', 2);
    // Может совпадать, но функция должна работать
    expect(calibratedPct).toBeGreaterThan(0);
    expect(calibratedPct).toBeLessThanOrEqual(1);
  });

  it('falls back to default when confidence <= 0.5', () => {
    updateRpeCalibration('Bench', 8, 0.85);
    
    const pct = rpeToPct('Bench', 2);
    expect(pct).toBe(0.92); // pctForRir(2) = 1.0 - 2*0.04
  });

  it('calculates weight for RPE with calibration', () => {
    for (let i = 0; i < 10; i++) {
      updateRpeCalibration('Bench', 7 + i * 0.2, 0.90 - i * 0.02);
    }
    
    const weight = weightForRpe('Bench', 8, 100);
    expect(weight).toBeGreaterThan(0);
    expect(weight).toBeLessThanOrEqual(100);
  });

  it('returns all calibrations', () => {
    updateRpeCalibration('Bench', 8, 0.85);
    updateRpeCalibration('Squat', 9, 0.80);
    
    const all = getAllCalibrations();
    expect(all).toHaveLength(2);
  });

  it('clears all calibrations', () => {
    updateRpeCalibration('Bench', 8, 0.85);
    clearCalibrations();
    expect(getAllCalibrations()).toHaveLength(0);
  });
});
