/**
 * female-weight-classes.test.ts — женские весовые категории PL (аддитивно).
 * Мужское поведение selectWeightClass не меняется.
 */
import { describe, expect, it } from 'vitest';
import {
  GENERAL_WEIGHT_CLASSES_WOMEN,
  IPF_WEIGHT_CLASSES_WOMEN,
  selectWeightClass,
  selectWeightClassForSex,
} from '../gym-competition.engine';

describe('female weight classes (PL)', () => {
  it('IPF women classes are present and ascending', () => {
    expect(IPF_WEIGHT_CLASSES_WOMEN[0]).toBe(43);
    expect([...IPF_WEIGHT_CLASSES_WOMEN]).toEqual([...IPF_WEIGHT_CLASSES_WOMEN].sort((a, b) => a - b));
  });

  it('general women classes are available', () => {
    expect(GENERAL_WEIGHT_CLASSES_WOMEN).toContain(52);
    expect(GENERAL_WEIGHT_CLASSES_WOMEN).toContain(67.5);
  });

  it('female selects a female class (60 kg → 63 kg IPF, без сушки)', () => {
    const result = selectWeightClassForSex('female', 60, 'IPF');
    expect(result.weightClass).toBe(63);
    expect(result.cuttingRequired).toBe(false);
  });

  it('female above all classes lands on the top class (85 kg → 84 kg)', () => {
    const result = selectWeightClassForSex('female', 85, 'IPF');
    expect(result.weightClass).toBe(84);
    expect(result.cuttingRequired).toBe(false);
  });

  it('female and male differ for the same body weight', () => {
    const female = selectWeightClassForSex('female', 58, 'IPF');
    const male = selectWeightClassForSex('male', 58, 'IPF');
    expect(female.weightClass).not.toBe(male.weightClass);
  });

  it('legacy selectWeightClass keeps male behavior', () => {
    expect(selectWeightClass(58, 'IPF').weightClass).toBe(59);
  });
});
