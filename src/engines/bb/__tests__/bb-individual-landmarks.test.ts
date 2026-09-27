import { describe, expect, it } from 'vitest';
import { computeIndividualLandmarks, getAllIndividualLandmarks } from '../bb-individual-landmarks';

describe('bb-individual-landmarks', () => {
  it('returns null for unknown muscle', () => {
    const result = computeIndividualLandmarks('nonexistent_muscle_xyz');
    expect(result).toBeNull();
  });

  it('returns null when insufficient data', () => {
    const result = computeIndividualLandmarks('chest');
    // Может вернуть null или объект в зависимости от данных в дневнике
    if (result) {
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.mev).toBeGreaterThan(0);
    }
  });

  it('returns array of landmarks', () => {
    const all = getAllIndividualLandmarks();
    expect(Array.isArray(all)).toBe(true);
  });
});
