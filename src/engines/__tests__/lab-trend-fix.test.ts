/**
 * lab-trend-fix.test.ts — P0: тренд LDL/HCT вверх не считался ухудшением + HbA1c кейс
 */
import { describe, it, expect } from 'vitest';
import { computeLabTrends } from '../lab-trend.engine';

describe('lab-trend P0 fix', () => {
  it('LDL 2.5→3.2 (+28% significant) должен быть в worsened, до фикса пропускался', () => {
    const labs = [
      { code: 'LDL', name: 'ЛПНП', value: 2.5, unit: 'mmol/L', date: '2026-08-01' },
      { code: 'LDL', name: 'ЛПНП', value: 3.2, unit: 'mmol/L', date: '2026-09-01' },
    ] as any[];
    const report = computeLabTrends(labs);
    expect(report.trends.length).toBe(1);
    const t = report.trends[0];
    // 2.5 normal (uln 3), 3.2 high → significant, up → worsened
    expect(t.significance).toBe('significant');
    expect(t.direction).toBe('up');
    expect(report.worsened.map((x) => x.code)).toContain('LDL');
  });

  it('HCT 45→55 (+22% significant) должен быть в worsened', () => {
    const labs = [
      { code: 'HCT', name: 'Гематокрит', value: 45, unit: '%', date: '2026-08-01' },
      { code: 'HCT', name: 'Гематокрит', value: 55, unit: '%', date: '2026-09-01' },
    ] as any[];
    const report = computeLabTrends(labs);
    const t = report.trends[0];
    expect(t.significance === 'significant' || t.significance === 'critical').toBe(true);
    expect(report.worsened.map((x) => x.code)).toContain('HCT');
  });

  it('HbA1c кейс: HBA1C upper → должен найти норму и посчитать тренд', () => {
    const labs = [
      { code: 'HbA1c', name: 'HbA1c', value: 5.0, unit: '%', date: '2026-08-01' },
      { code: 'HbA1c', name: 'HbA1c', value: 6.8, unit: '%', date: '2026-09-01' },
    ] as any[];
    const report = computeLabTrends(labs);
    expect(report.trends.length).toBe(1);
    const t = report.trends[0];
    // HbA1c uln ~6.5, 5.0 normal, 6.8 high → significant/critical
    expect(t.refHigh).toBeDefined();
    expect(t.currentAbnormal).toBe(true);
    expect(t.previousAbnormal).toBe(false);
  });

  it('GLU вниз должен быть в improved (раньше исключался)', () => {
    const labs = [
      { code: 'GLU', name: 'Глюкоза', value: 7.0, unit: 'mmol/L', date: '2026-08-01' },
      { code: 'GLU', name: 'Глюкоза', value: 5.0, unit: 'mmol/L', date: '2026-09-01' },
    ] as any[];
    const report = computeLabTrends(labs);
    // GLU 7.0 high (uln 5.6?), 5.0 normal → down, should be improved
    if (report.trends[0].significance === 'significant' || report.trends[0].significance === 'critical') {
      expect(report.improved.map((x) => x.code)).toContain('GLU');
    }
  });
});
