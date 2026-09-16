import { describe, it, expect } from 'vitest';
import { doseForCause } from '../arm-correction-dose.engine';

describe('arm-correction-dose P3', () => {
  it('база без причины = ARM_CORRECTIONS', () => {
    const d = doseForCause('cup_start', null)!;
    expect(d.sets).toBe(3);
    expect(d.adjusted).toBe(false);
  });
  it('volume/technique не меняют дозу', () => {
    expect(doseForCause('pron_lock', 'volume')!.adjusted).toBe(false);
    expect(doseForCause('pron_lock', 'technique')!.adjusted).toBe(false);
  });
  it('fatigue: −1 сет, RIR+1, −5п.п.', () => {
    const d = doseForCause('cup_hold', 'fatigue')!;
    expect(d.sets).toBe(2);
    expect(d.rir).toBe(3);
    expect(d.intensityPct).toBeCloseTo(0.6, 5);
    expect(d.adjusted).toBe(true);
  });
  it('mobility: high-rep + RIR≥2', () => {
    const d = doseForCause('side_mid', 'mobility')!;
    expect(d.reps[1]).toBeGreaterThanOrEqual(12);
    expect(d.rir).toBeGreaterThanOrEqual(2);
  });
  it('strength: 5×5 кап 85%', () => {
    const d = doseForCause('back_start', 'strength')!;
    expect(d.sets).toBe(5);
    expect(d.reps).toEqual([5, 5]);
    expect(d.intensityPct).toBeLessThanOrEqual(0.85);
  });
  it('неизвестная точка → null', () => {
    expect(doseForCause('nope' as any, 'fatigue')).toBeNull();
  });
});
