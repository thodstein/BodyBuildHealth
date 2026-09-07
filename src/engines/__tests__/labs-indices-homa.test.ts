/**
 * labs-indices-homa.test.ts — P0: HOMA-IR делил на 2025 вместо 112.5 → ×90 занижение
 */
import { describe, it, expect } from 'vitest';
import { computeLabIndices } from '../labs-indices.engine';

describe('labs-indices HOMA-IR P0', () => {
  it('GLU 5.5 + INS 10 → HOMA 2.44 → 0.49 (а не 0.027)', () => {
    const labs = [
      { code: 'GLU', value: 5.5, unit: 'mmol/L', date: '2026-09-01' },
      { code: 'INS', value: 10, unit: 'мкЕд/мл', date: '2026-09-01' },
    ] as any[];
    const res = computeLabIndices(labs);
    // 5.5*10/22.5=2.44 /5 =0.488
    expect(res.homaIR).toBeGreaterThan(0.4);
    expect(res.homaIR).toBeLessThan(0.6);
    expect(res.homaIR).not.toBeLessThan(0.1);
  });

  it('GLU 5.5 + INS 20 → HOMA 4.88 → 0.97 (крит)', () => {
    const labs = [
      { code: 'GLU', value: 5.5, unit: 'mmol/L', date: '2026-09-01' },
      { code: 'INS', value: 20, unit: 'мкЕд/мл', date: '2026-09-01' },
    ] as any[];
    const res = computeLabIndices(labs);
    expect(res.homaIR).toBeGreaterThan(0.8);
  });

  it('без INS → фолбэк глюкоза*0.7 + HbA1c*0.3', () => {
    const labs = [
      { code: 'GLU', value: 5.5, unit: 'mmol/L', date: '2026-09-01' },
      { code: 'HbA1c', value: 5.5, unit: '%', date: '2026-09-01' },
    ] as any[];
    const res = computeLabIndices(labs);
    expect(res.homaIR).toBeGreaterThan(0);
  });
});
