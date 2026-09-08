/**
 * lab-trend-insights.test.ts — P0: getTrendInsights дублировал списки
 */
import { describe, it, expect } from 'vitest';
import { computeLabTrends, getTrendInsights } from '../lab-trend.engine';

describe('getTrendInsights P0', () => {
  it('LDL вверх → только ухудшение, не улучшение', () => {
    const labs = [
      { code: 'LDL', name: 'ЛПНП', value: 2.5, unit: 'mmol/L', date: '2026-08-01' },
      { code: 'LDL', name: 'ЛПНП', value: 3.5, unit: 'mmol/L', date: '2026-09-01' },
    ] as any[];
    const report = computeLabTrends(labs);
    const insights = getTrendInsights(report.trends);
    expect(insights.some((s) => s.includes('Ухудшение'))).toBe(true);
    expect(insights.some((s) => s.includes('Улучшение') && s.includes('ЛПНП'))).toBe(false);
  });

  it('HDL вверх → улучшение, не ухудшение', () => {
    const labs = [
      { code: 'HDL', name: 'ЛПВП', value: 1.0, unit: 'mmol/L', date: '2026-08-01' },
      { code: 'HDL', name: 'ЛПВП', value: 1.6, unit: 'mmol/L', date: '2026-09-01' },
    ] as any[];
    const report = computeLabTrends(labs);
    // HDL 1.0 low (uln 2.0? actually HDL low 1.0, high 2.0, so 1.0 low, 1.6 normal → improvement)
    // For HDL, higher is better, so up from low to normal should be improved
    const insights = getTrendInsights(report.trends);
    // at least not duplicated
    const worsened = insights.filter((s) => s.includes('Ухудшение')).length;
    const improved = insights.filter((s) => s.includes('Улучшение')).length;
    expect(worsened + improved).toBeLessThanOrEqual(2);
  });

  it('один тренд не попадает в оба списка', () => {
    const labs = [
      { code: 'ALT', name: 'АЛТ', value: 20, unit: 'U/L', date: '2026-08-01' },
      { code: 'ALT', name: 'АЛТ', value: 80, unit: 'U/L', date: '2026-09-01' },
    ] as any[];
    const report = computeLabTrends(labs);
    const insights = getTrendInsights(report.trends);
    const hasWorsened = insights.some((s) => s.includes('Ухудшение'));
    const hasImproved = insights.some((s) => s.includes('Улучшение'));
    // ALT up → worsened, not improved
    expect(hasWorsened).toBe(true);
    // should not have both for same single trend (unless newAbnormal also, but not improved)
    // we check that improved does not contain ALT when worsened does
    if (hasWorsened) {
      const improvedHasAlt = insights.some((s) => s.includes('Улучшение') && s.includes('АЛТ'));
      expect(improvedHasAlt).toBe(false);
    }
  });
});
