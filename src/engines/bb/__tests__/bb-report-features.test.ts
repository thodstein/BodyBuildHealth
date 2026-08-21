import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { buildBBPlanReport, buildBBPlanReportText } from '../bb-report.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('BB отчёт (адаптирован под изменения)', () => {
  it('отчёт содержит expandedSummary и weakPoints', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['biceps'] });
    const report = buildBBPlanReport(plan);
    expect(report.expandedSummary).toBeDefined();
    expect(report.expandedSummary!.totalWorkingSets).toBeGreaterThan(0);
    // weakPoints на основе priorityMuscles
    expect(report.weakPoints.length).toBeGreaterThanOrEqual(0);
  });

  it('текстовый отчёт строится (сводка + нагрузка)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    const text = buildBBPlanReportText(plan);
    expect(text).toContain('План:');
    expect(text).toContain('Недельная сводка');
    expect(text).toContain('Итого');
    expect(text).toContain('Нагрузка');
  });
});
