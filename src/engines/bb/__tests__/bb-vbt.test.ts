import { describe, it, expect } from 'vitest';
import { bbVbtRecommendation, bbVbtZoneLabel } from '../bb-vbt.engine';

describe('bb-vbt', () => {
  it('потеря <10% — стабильна, RIR−0.5', () => {
    const r = bbVbtRecommendation('bench', 0.9, 0.85); // ~5.5%
    expect(r.suggestedRirShift).toBe(-0.5);
    expect(r.recommendation).toContain('стабильна');
  });

  it('10-20% — зона силы, без сдвига', () => {
    const r = bbVbtRecommendation('bench', 0.9, 0.78); // ~13%
    expect(r.suggestedRirShift).toBe(0);
    expect(r.recommendation).toContain('Зона силы');
  });

  it('25-40% — снизить вес, RIR+1', () => {
    const r = bbVbtRecommendation('squat', 0.8, 0.55); // ~31%
    expect(r.suggestedRirShift).toBe(1);
    expect(r.recommendation).toContain('снизьте вес');
  });

  it('>40% — отказ близко, RIR+2', () => {
    const r = bbVbtRecommendation('squat', 0.8, 0.45); // ~44%
    expect(r.exceeded).toBe(true);
    expect(r.suggestedRirShift).toBe(2);
    expect(r.recommendation).toContain('отказ');
  });

  it('bbVbtZoneLabel', () => {
    expect(bbVbtZoneLabel(5).label).toContain('стабильна');
    expect(bbVbtZoneLabel(45).label).toContain('отказ');
  });
});
