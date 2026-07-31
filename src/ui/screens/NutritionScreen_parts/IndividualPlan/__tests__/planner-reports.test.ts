import { describe, expect, it } from 'vitest';
import { generateDrugCompatReportPure } from '../planner-reports';

describe('planner reports malformed input safety', () => {
  it('does not throw when injections is not an array', () => {
    const result = generateDrugCompatReportPure({
      dayPlan: { meals: [], totals: {} },
      injections: null as any,
      weight: 80,
      v2Pharma: {},
      phase: 'course',
      takenSupplements: [],
    });

    expect(result.warnings).toEqual([]);
  });

  it('does not throw when the generated plan has malformed meals', () => {
    const result = generateDrugCompatReportPure({
      dayPlan: { meals: null, totals: {} },
      injections: [{ type: 'ААС', dose: 500, name: 'test' }],
      weight: 80,
      v2Pharma: {},
      phase: 'course',
      takenSupplements: null as any,
    });

    expect(result.warnings).toContain('✅ Все препараты совместимы с планом питания');
  });
});
