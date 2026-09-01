import { describe, it, expect } from 'vitest';
import { diagnoseArmWeakPoint } from '../arm-weakpoint.engine';

describe('arm-weakpoint', () => {
  it('cupFails → wrist_flexors', () => {
    const d = diagnoseArmWeakPoint({ weakTest: { cupFails: true } });
    expect(d.weakMuscles).toContain('wrist_flexors');
    expect(d.priorities[0].exercises.length).toBeGreaterThan(0);
  });
  it('pronationFails → pronators', () => {
    const d = diagnoseArmWeakPoint({ weakTest: { pronationFails: true } });
    expect(d.weakMuscles).toContain('pronators');
  });
  it('supinationFails → supinators', () => {
    const d = diagnoseArmWeakPoint({ weakTest: { supinationFails: true } });
    expect(d.weakMuscles).toContain('supinators');
  });
  it('pinch <10с → grip_pinch', () => {
    const d = diagnoseArmWeakPoint({ weakTest: { pinchHoldSec: 5 } });
    expect(d.weakMuscles).toContain('grip_pinch');
  });
  it('support <60 → grip_support', () => {
    const d = diagnoseArmWeakPoint({ weakTest: { gripSupportMaxKg: 50 } });
    expect(d.weakMuscles).toContain('grip_support');
  });
  it('side → side_pressure', () => {
    const d = diagnoseArmWeakPoint({ weakTest: { sidePressureFails: true } });
    expect(d.weakMuscles).toContain('side_pressure');
  });
  it('hook техника добавляет supination pattern', () => {
    const d = diagnoseArmWeakPoint({ technique: 'hook' });
    expect(d.weakPatterns).toContain('supination');
  });
  it('toproll добавляет pronation', () => {
    const d = diagnoseArmWeakPoint({ technique: 'toproll' });
    expect(d.weakPatterns).toContain('pronation');
  });
  it('manualWeak', () => {
    const d = diagnoseArmWeakPoint({ manualWeak: ['cup'] });
    expect(d.weakMuscles).toContain('wrist_flexors');
  });
  it('пусто — баланс', () => {
    const d = diagnoseArmWeakPoint({});
    expect(d.rationale[0]).toMatch(/баланс/i);
  });
});
