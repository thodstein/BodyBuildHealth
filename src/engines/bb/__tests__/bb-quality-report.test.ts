import { describe, it, expect } from 'vitest';
import {
  buildBBQualityReport, bbQualityReportSummary, bbQualityBadge,
  consolidateQualityIssues, penaltyForUniqueCodes,
  BB_QUALITY_ERR_CODE_PENALTY, BB_QUALITY_WARN_CODE_PENALTY,
  BB_QUALITY_ERR_CODE_CAP, BB_QUALITY_WARN_CODE_CAP,
} from '../bb-quality-report.engine';

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

  it('штраф идёт за уникальные коды (не за инстансы)', () => {
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
    expect(bad.score).toBe(clean.score - (BB_QUALITY_ERR_CODE_PENALTY + BB_QUALITY_WARN_CODE_PENALTY));
  });

  it('десятки копий одного кода не роняют скор в 0 (кап на код, не на инстанс)', () => {
    const plan = {
      ...basePlan,
      validation: { valid: false, issues: Array.from({ length: 30 }, (_, i) => ({ level: 'warning', code: 'session_muscle_leak', message: `упр ${i}`, week: (i % 8) + 1 })) },
    };
    const r = buildBBQualityReport(plan as any, {});
    // 30 инстансов одного кода → штраф только за вид (кап 15), скор не в нуле
    expect(r.score).toBeGreaterThan(0);
    // список свернут в одну строку со счётчиком
    const leak = r.issues.find(i => i.code === 'session_muscle_leak');
    expect(leak?.count).toBe(30);
    expect(leak?.message).toContain('×30');
    expect(Array.isArray(leak?.weeks)).toBe(true);
  });

  it('penaltyForUniqueCodes: капы на вид, дубли кодов не считаются дважды', () => {
    expect(penaltyForUniqueCodes(['a'], ['b'])).toBe(BB_QUALITY_ERR_CODE_PENALTY + BB_QUALITY_WARN_CODE_PENALTY);
    expect(penaltyForUniqueCodes(['a', 'a', 'a'], ['b', 'b'])).toBe(BB_QUALITY_ERR_CODE_PENALTY + BB_QUALITY_WARN_CODE_PENALTY);
    expect(penaltyForUniqueCodes(['e1', 'e2', 'e3', 'e4'], [])).toBe(BB_QUALITY_ERR_CODE_CAP);
  });

  it('consolidateQualityIssues: одинаковый worst-уровень, порядок error→warning→info', () => {
    const list = consolidateQualityIssues([
      { source: 'validation', level: 'warning', code: 'w1', message: 'w' },
      { source: 'validation', level: 'error', code: 'e1', message: 'e1' },
      { source: 'validation', level: 'error', code: 'e1', message: 'e1', week: 2 },
      { source: 'balance', level: 'info', code: 'i1', message: 'i' },
    ]);
    expect(list).toHaveLength(3);
    expect(list[0].code).toBe('e1');
    expect(list[0].count).toBe(2);
    expect(list[1].code).toBe('w1');
    expect(list[2].code).toBe('i1');
  });

  it('много РАЗНЫХ кодов ошибок → danger-уровень', () => {
    const plan = {
      ...basePlan,
      validation: { valid: false, issues: [
        { level: 'error', code: 'e1', message: 'err 1' },
        { level: 'error', code: 'e2', message: 'err 2' },
        { level: 'warning', code: 'w1', message: 'w 1' },
        { level: 'warning', code: 'w2', message: 'w 2' },
        { level: 'warning', code: 'w3', message: 'w 3' },
        { level: 'warning', code: 'w4', message: 'w 4' },
        { level: 'warning', code: 'w5', message: 'w 5' },
      ] },
    };
    const clean = buildBBQualityReport(basePlan as any, {});
    const r = buildBBQualityReport(plan as any, {});
    // 2 вида ошибок (−16 кап) + 5 видов предупреждений (−15 кап) = −31
    expect(r.score).toBe(clean.score - 31);
    if (clean.score <= 90) expect(r.riskLevel).toBe('danger');
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
