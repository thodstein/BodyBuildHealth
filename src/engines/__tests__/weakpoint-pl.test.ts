import { describe, it, expect } from 'vitest';
import { diagnoseWeakPoint, WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../lms/weakpoint-pl';

describe('diagnoseWeakPoint', () => {
  it('bench/off_chest → ассистентные упражнения', () => {
    const d = diagnoseWeakPoint('bench', 'off_chest');
    expect(d.lift).toBe('bench');
    expect(d.weakPoint).toBe('off_chest');
    expect(d.label).toContain('Сход');
    expect(d.assistance.length).toBeGreaterThan(0);
    expect(d.intensityPct).toBeGreaterThan(0);
    expect(d.rationale).toBeTruthy();
  });

  it('bench/lockout → дожимы', () => {
    const d = diagnoseWeakPoint('bench', 'lockout');
    expect(d.weakPoint).toBe('lockout');
    expect(d.assistance.some(a => /дожим/i.test(a))).toBe(true);
  });

  it('squat/bottom → присед на груди / широкая постановка', () => {
    const d = diagnoseWeakPoint('squat', 'bottom');
    expect(d.assistance.length).toBeGreaterThan(0);
    expect(d.intensityPct).toBeGreaterThan(0);
  });

  it('deadlift/start → тяга из ямы', () => {
    const d = diagnoseWeakPoint('deadlift', 'start');
    expect(d.assistance.some(a => /ямы|плинт/i.test(a))).toBe(true);
  });

  it('deadlift/lockout → тяга с плинтов', () => {
    const d = diagnoseWeakPoint('deadlift', 'lockout');
    expect(d.assistance.some(a => /плинт/i.test(a))).toBe(true);
  });

  it('ohp/ohp_lockout → французский жим', () => {
    const d = diagnoseWeakPoint('ohp', 'ohp_lockout');
    expect(d.assistance.some(a => /француз/i.test(a))).toBe(true);
  });

  it('невалидная пара lift/weakPoint → fallback', () => {
    const d = diagnoseWeakPoint('bench', 'bottom' as WeakPoint);
    expect(d.assistance).toEqual([]);
    expect(d.label).toBe('-');
  });

  it('все lifts из WEAK_POINTS_BY_LIFT дают валидный диагноз', () => {
    for (const lift of Object.keys(WEAK_POINTS_BY_LIFT) as Lift[]) {
      for (const wp of WEAK_POINTS_BY_LIFT[lift]) {
        const d = diagnoseWeakPoint(lift, wp);
        expect(d.assistance.length).toBeGreaterThan(0);
        expect(d.intensityPct).toBeGreaterThan(0);
      }
    }
  });
});

describe('WEAK_POINTS_BY_LIFT', () => {
  it('содержит 7 лифтов', () => {
    expect(Object.keys(WEAK_POINTS_BY_LIFT)).toHaveLength(7);
  });

  it('bench имеет 4 слабых точки', () => {
    expect(WEAK_POINTS_BY_LIFT.bench).toHaveLength(4);
  });

  it('squat имеет 3 слабых точки', () => {
    expect(WEAK_POINTS_BY_LIFT.squat).toHaveLength(3);
  });
});
