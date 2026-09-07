/**
 * labs-mapping-hba1c.test.ts — P0: normalizedRatio не находил HbA1c из-за регистра
 */
import { describe, it, expect } from 'vitest';
import { normalizedRatio } from '../../core/labs-mapping';
import { computeLabIndices } from '../labs-indices.engine';

describe('labs-mapping HbA1c case P0', () => {
  it('HbA1c upper HBA1C должен найти норму', () => {
    const r = normalizedRatio('HBA1C', 5.5, '%');
    expect(r).not.toBeNull();
    expect(r).toBeGreaterThan(0);
  });

  it('HbA1c lower hba1c тоже', () => {
    const r = normalizedRatio('hba1c', 5.5, '%');
    expect(r).not.toBeNull();
  });

  it('metabolism с HbA1c не 0', () => {
    const labs = [
      { code: 'HBA1C', value: 5.5, unit: '%', date: '2026-09-01' },
      { code: 'GLU', value: 5.5, unit: 'mmol/L', date: '2026-09-01' },
    ] as any[];
    const res = computeLabIndices(labs);
    expect(res.metabolism).toBeGreaterThan(0);
    expect(res.metabolism).not.toBe(0);
  });

  it('до фикса HBA1C возвращал null → metabolism 0 (демо бага)', async () => {
    const { UCUM_MAP } = await import('../../core/constants');
    const oldLookup = (code: string) => (UCUM_MAP as any)[code] || null;
    expect(oldLookup('HBA1C')).toBeFalsy();
    expect(oldLookup('HbA1c')).toBeDefined();
  });
});
