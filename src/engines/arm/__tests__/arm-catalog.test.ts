import { describe, it, expect } from 'vitest';
import { ARM_EXERCISES, validateArmCatalog } from '../../../core/exercise-catalog-arm';

describe('arm-catalog', () => {
  it('≥35 упражнений', () => {
    expect(ARM_EXERCISES.length).toBeGreaterThanOrEqual(35);
  });
  it('уникальные id', () => {
    const ids = ARM_EXERCISES.map(e=>e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('все имеют movementPattern и substitutionGroup', () => {
    for (const ex of ARM_EXERCISES) {
      expect(ex.movementPattern, ex.id).toBeTruthy();
      expect(ex.substitutionGroup, ex.id).toBeTruthy();
    }
  });
  it('группы покрыты: cup/pronation/supination/grip', () => {
    const groups = new Set(ARM_EXERCISES.map(e=>e.substitutionGroup));
    expect(groups.has('cup_iso')).toBe(true);
    expect(groups.has('pronation')).toBe(true);
    expect(groups.has('supination')).toBe(true);
    expect(groups.has('grip_support')).toBe(true);
    expect(groups.has('grip_pinch')).toBe(true);
  });
  it('pronation ≠ supination (строгие замены)', () => {
    const pron = ARM_EXERCISES.find(e=>e.id==='pronation_cable')!;
    expect(pron.cannotReplace).toContain('supination_cable');
    const sup = ARM_EXERCISES.find(e=>e.id==='supination_cable')!;
    expect(sup.cannotReplace).toContain('pronation_cable');
  });
  it('support ≠ pinch', () => {
    const rt = ARM_EXERCISES.find(e=>e.id==='rolling_thunder')!;
    expect(rt.cannotReplace).toContain('plate_pinch_hold');
  });
  it('validate', () => {
    expect(validateArmCatalog()).toEqual([]);
  });
  it('rollingu thunder и axle в каталоге', () => {
    expect(ARM_EXERCISES.some(e=>e.id==='rolling_thunder')).toBe(true);
    expect(ARM_EXERCISES.some(e=>e.id==='apollon_axle')).toBe(true);
    expect(ARM_EXERCISES.some(e=>e.id==='saxon_bar')).toBe(true);
  });
});
