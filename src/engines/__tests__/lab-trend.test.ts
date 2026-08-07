import { describe, expect, it } from 'vitest';
import { computeLabTrends, getTrendColor, getTrendIcon, getTrendInsights, exportTrendsToCSV } from '../lab-trend.engine';
import type { LabPoint } from '../../core/types';

function lab(code: string, value: number, date: string, unit = 'U/L', phase = 'baseline'): LabPoint {
  return { id: date + code, code, name: code, value, unit, date, phase } as LabPoint;
}

describe('lab-trend.engine', () => {
  it('returns unknown direction for a single measurement', () => {
    const result = computeLabTrends([lab('ALT', 35, '2024-01-01')]);
    expect(result.trends[0].direction).toBe('unknown');
    expect(result.trends[0].previousValue).toBeNull();
  });

  it('detects up/down/stable direction', () => {
    const labs = [
      lab('ALT', 30, '2024-01-01'),
      lab('ALT', 45, '2024-02-01'),
      lab('ALT', 42, '2024-03-01'),
    ];
    const result = computeLabTrends(labs);
    const trend = result.trends[0];
    expect(trend.direction).toBe('down');
    expect(trend.absoluteChange).toBeCloseTo(-3, 5);
    expect(trend.percentChange).toBeCloseTo(-6.67, 1);
  });

  it('flags critical when current is abnormal and previous was normal', () => {
    const labs = [
      lab('GLU', 4.5, '2024-01-01', 'mmol/L'),
      lab('GLU', 8.5, '2024-02-01', 'mmol/L'),
    ];
    const result = computeLabTrends(labs);
    expect(result.trends[0].significance).toBe('critical');
    expect(result.worsened).toHaveLength(1);
  });

  it('flags improved when abnormal returns to normal', () => {
    const labs = [
      lab('LDL', 5.0, '2024-01-01', 'mmol/L'),
      lab('LDL', 2.8, '2024-02-01', 'mmol/L'),
    ];
    const result = computeLabTrends(labs);
    expect(result.trends[0].significance).toBe('significant');
    expect(result.improved).toHaveLength(1);
  });

  it('groups trends by code', () => {
    const labs = [
      lab('ALT', 35, '2024-01-01'),
      lab('AST', 28, '2024-01-01'),
      lab('ALT', 40, '2024-02-01'),
      lab('AST', 30, '2024-02-01'),
    ];
    const result = computeLabTrends(labs);
    expect(result.trends).toHaveLength(2);
    expect(result.trends.map(t => t.code)).toEqual(expect.arrayContaining(['ALT', 'AST']));
  });

  it('returns summary text', () => {
    const labs = [
      lab('ALT', 35, '2024-01-01'),
      lab('ALT', 50, '2024-02-01'),
      lab('AST', 28, '2024-02-01'),
    ];
    const result = computeLabTrends(labs);
    expect(result.summary).toContain('2 маркеров');
  });

  it('getTrendColor returns correct colors', () => {
    expect(getTrendColor('critical')).toBe('#ef4444');
    expect(getTrendColor('significant')).toBe('#f97316');
    expect(getTrendColor('watch')).toBe('#eab308');
    expect(getTrendColor('normal')).toBe('var(--text-dim)');
  });

  it('getTrendIcon returns correct icons', () => {
    expect(getTrendIcon('up', 'critical')).toBe('↑↑');
    expect(getTrendIcon('down', 'significant')).toBe('↓');
    expect(getTrendIcon('stable', 'normal')).toBe('→');
  });

  it('getTrendInsights returns summary for worsened/improved/new', () => {
    const trends: LabTrend[] = [
      { code: 'ALT', name: 'ALT', points: [], previousValue: 30, currentValue: 80, unit: 'U/L', absoluteChange: 50, percentChange: 166, direction: 'up', significance: 'critical', previousDate: '2024-01-01', currentDate: '2024-02-01', refLow: 0, refHigh: 40, currentAbnormal: true, previousAbnormal: false },
      { code: 'LDL', name: 'LDL', points: [], previousValue: 5, currentValue: 3, unit: 'mmol/L', absoluteChange: -2, percentChange: -40, direction: 'down', significance: 'significant', previousDate: '2024-01-01', currentDate: '2024-02-01', refLow: 0, refHigh: 3, currentAbnormal: false, previousAbnormal: true },
    ];
    const insights = getTrendInsights(trends);
    expect(insights.length).toBeGreaterThanOrEqual(2);
    expect(insights.some(i => i.includes('Ухудшение'))).toBe(true);
    expect(insights.some(i => i.includes('Улучшение'))).toBe(true);
  });

  it('getTrendInsights returns stable message when no significant changes', () => {
    const trends: LabTrend[] = [
      { code: 'ALT', name: 'ALT', points: [], previousValue: 35, currentValue: 36, unit: 'U/L', absoluteChange: 1, percentChange: 2.8, direction: 'up', significance: 'normal', previousDate: '2024-01-01', currentDate: '2024-02-01', refLow: 0, refHigh: 40, currentAbnormal: false, previousAbnormal: false },
    ];
    const insights = getTrendInsights(trends);
    expect(insights).toContain('📊 Стабильное состояние — без значимых изменений.');
  });

  it('exportTrendsToCSV produces valid CSV with header and rows', () => {
    const report: LabTrendReport = {
      trends: [
        { code: 'ALT', name: 'ALT', points: [], previousValue: 35, currentValue: 45, unit: 'U/L', absoluteChange: 10, percentChange: 28.6, direction: 'up', significance: 'significant', previousDate: '2024-01-01', currentDate: '2024-02-01', refLow: 0, refHigh: 40, currentAbnormal: true, previousAbnormal: false },
      ],
      improved: [],
      worsened: [],
      newMarkers: [],
      summary: '1 маркер · 1 с изменением',
    };
    const csv = exportTrendsToCSV(report);
    expect(csv).toContain('Code,Name');
    expect(csv).toContain('ALT');
    expect(csv).toContain('significant');
    expect(csv.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('predicts next value for trends with 3+ points', () => {
    const labs = [
      lab('ALT', 30, '2024-01-01'),
      lab('ALT', 35, '2024-02-01'),
      lab('ALT', 40, '2024-03-01'),
    ];
    const result = computeLabTrends(labs);
    const trend = result.trends[0];
    expect(trend.predictedValue).toBeDefined();
    expect(trend.predictionConfidence).toBeDefined();
    expect(typeof trend.predictedValue).toBe('number');
    expect(typeof trend.predictionConfidence).toBe('number');
  });

  it('does not predict for trends with fewer than 3 points', () => {
    const labs = [
      lab('ALT', 30, '2024-01-01'),
      lab('ALT', 35, '2024-02-01'),
    ];
    const result = computeLabTrends(labs);
    const trend = result.trends[0];
    expect(trend.predictedValue).toBeUndefined();
    expect(trend.predictionConfidence).toBeUndefined();
  });
});
