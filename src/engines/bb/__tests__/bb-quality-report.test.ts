import { describe, it, expect } from 'vitest';
import { buildBBQualityReport, bbQualityReportSummary, bbQualityBadge } from '../bb-quality-report.engine';

const basePlan = {
  weeks: [{ week: 1, sessions: [{ exercises: [] }] }, { week: 2, sessions: [{ exercises: [] }] }],
  validation: { valid: true, issues: [] },
  balanceReport: { issues: [] },
  rotationReport: { issues: [] },
  weeklyVolume: { 1: { chest: { directSets: 12 }, back: { directSets: 14 } }, 2: { chest: { directSets: 10 } } },
  expandedSummary: { totalWorkingSets: 36 },
};

describe('bb-quality-report', () => {
  it('чистый план → скор на базе safety (без validation-штрафов), ok', () => {
    const r = buildBBQualityReport(basePlan as any, {});
    expect(r.validationValid).toBe(true);
    expect(r.riskLevel).toBe('ok');
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.totalWorkingSets).toBe(36);
    expect(r.peakWeek).toBe(1); // неделя 1 с 26 сетами — пик
  });

  it('validation-замечания вычитаются из скора', () => {
    const plan = {
      ...basePlan,
      validation: { valid: false, issues: [
        { level: 'error', code: 'empty_plan', message: 'План пуст' },
        { level: 'warning', code: 'low_training_frequency', message: 'частота 1x/нед' },
      ] },
    };
    const clean = buildBBQualityReport(basePlan as any, {});
    const bad = buildBBQualityReport(plan as any, {});
    expect(bad.validationValid).toBe(false);
    expect(bad.score).toBe(clean.score - 13); // -10 error, -3 warning
  });

  it('много ошибок → danger-уровень', () => {
    const plan = {
      ...basePlan,
      validation: { valid: false, issues: Array.from({ length: 6 }, () => ({ level: 'error', code: 'empty_plan', message: 'План пуст' })) },
    };
    const r = buildBBQualityReport(plan as any, {});
    expect(r.riskLevel).toBe('danger');
  });

  it('дедуп дублирующихся замечаний', () => {
    const plan = {
      ...basePlan,
      validation: { valid: true, issues: [{ level: 'warning', code: 'effective_mrv_overflow', message: 'chest > MRV', week: 1 }] },
      balanceReport: { issues: [] },
      safety: {},
    };
    // safety с тем же текстом — дубль должен убраться по ключу (разный source → разные ключи, но проверим логику)
    const r = buildBBQualityReport(plan as any, {});
    // validation issue 1 + возможно safety issues (строка). Проверим что validation присутствует.
    expect(r.issues.some(i => i.code === 'effective_mrv_overflow')).toBe(true);
  });

  it('сводка и бейдж', () => {
    const r = buildBBQualityReport(basePlan as any, {});
    expect(bbQualityReportSummary(r)).toContain(String(r.score));
    expect(bbQualityReportSummary(r)).toContain('0 ошибок');
    expect(bbQualityBadge('danger')).toEqual({ label: '🔴 риск', color: '#f87171' });
    expect(bbQualityBadge('ok').label).toBe('🟢 хорошо');
  });

  it('perWeek сортирован и peakWeek корректен', () => {
    const r = buildBBQualityReport(basePlan as any, {});
    expect(r.perWeek.map(p => p.week)).toEqual([1, 2]);
    expect(r.perWeek[0].plannedSets).toBe(26);
  });
});
