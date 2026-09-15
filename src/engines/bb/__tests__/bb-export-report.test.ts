/**
 * 4.7/4.8 (план BB-AUTO-EXHAUSTIVE-PRO):
 *  - печать «таблицы мезоцикла» через единый движковый buildBBPlanPrintHtml
 *    (раньше кнопка «Вся таблица» дублировала handlePrintPlan);
 *  - экспорт отчёта quality/safety/validator + generateActionableRecommendations
 *    + buildBBPlanReportText (был мёртвый движковый экспорт).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateActionableRecommendations } from '../bb-validator.engine';

const SRC = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'BbAutoConstructor.tsx'), 'utf8');
const plan = { weeks: [], pattern: { id: 'p' } } as never;

describe('4.8 generateActionableRecommendations (движок)', () => {
  it('target_volume_deficit → high + «добавьте N»', () => {
    const recs = generateActionableRecommendations(plan, [
      { code: 'target_volume_deficit', level: 'warning', message: 'chest: effective volume 5.0 ниже MEV 8' },
    ] as never);
    expect(recs).toHaveLength(1);
    expect(recs[0].priority).toBe('high');
    expect(recs[0].action).toContain('3');
  });

  it('effective_mrv_overflow → high + «снизьте»', () => {
    const recs = generateActionableRecommendations(plan, [
      { code: 'effective_mrv_overflow', level: 'warning', message: 'back: effective 25.0 > MRV 20', week: 3 },
    ] as never);
    expect(recs[0].priority).toBe('high');
    expect(recs[0].action).toContain('5');
  });

  it('deload_volume_not_reduced → medium', () => {
    const recs = generateActionableRecommendations(plan, [
      { code: 'deload_volume_not_reduced', level: 'warning', message: 'x' },
    ] as never);
    expect(recs[0].priority).toBe('medium');
  });

  it('без проблем → all_clear', () => {
    const recs = generateActionableRecommendations(plan, []);
    expect(recs).toHaveLength(1);
    expect(recs[0].code).toBe('all_clear');
  });
});

describe('4.7/4.8 wiring (source-guard)', () => {
  it('печать таблицы мезоцикла через движковый buildBBPlanPrintHtml', () => {
    expect(SRC).toContain('buildBBPlanPrintHtml(plan');
  });

  it('handlePrintPlan больше не дублируется на двух кнопках', () => {
    expect((SRC.match(/onClick=\{handlePrintPlan\}/g) || []).length).toBe(1);
  });

  it('отчёт качества использует рекомендации + движковый текст', () => {
    expect(SRC).toContain('handleExportQualityReport');
    expect(SRC).toContain('generateActionableRecommendations(plan,');
    expect(SRC).toContain('buildBBPlanReportText(plan)');
  });
});
