/**
 * lab-analysis-high.test.ts — P0: high порог был 79 вместо 40 → ALT 50 считался нормой
 */
import { describe, it, expect } from 'vitest';
import { interpretLabs } from '../lab-analysis.engine';

describe('lab-analysis P0 high threshold', () => {
  it('ALT 50 (high 40, critical 80) должен быть high, а не normal', () => {
    const res = interpretLabs([{ code: 'ALT', value: 50 } as any]);
    const alt = res.interpretations.find((x) => x.code === 'ALT');
    expect(alt).toBeDefined();
    expect(alt!.status).toBe('high');
    expect(alt!.riskPercent).toBe(25);
  });

  it('ALT 90 (>80) → critical_high 40%', () => {
    const res = interpretLabs([{ code: 'ALT', value: 90 } as any]);
    const alt = res.interpretations.find((x) => x.code === 'ALT');
    expect(alt!.status).toBe('critical_high');
    expect(alt!.riskPercent).toBe(40);
  });

  it('ALT 30 (в норме) → нет интерпретации', () => {
    const res = interpretLabs([{ code: 'ALT', value: 30 } as any]);
    expect(res.interpretations.find((x) => x.code === 'ALT')).toBeUndefined();
    expect(res.liverStress).toBeGreaterThan(0);
  });

  it('HCT 53 (>50 high, <54 critical) → high', () => {
    const res = interpretLabs([{ code: 'HEMATOCRIT', value: 53 } as any]);
    const hct = res.interpretations.find((x) => x.code === 'HEMATOCRIT');
    expect(hct?.status).toBe('high');
  });
});
