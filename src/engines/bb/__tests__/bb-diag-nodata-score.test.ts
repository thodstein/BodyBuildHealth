/**
 * bb-diag-nodata-score.test.ts — BB-D-05 (хвост): пустой вход давал 100/100.
 *
 * Композит из одних дефолтов — арифметика, а не измерение. Хаб решает один раз
 * (`scoreState: 'no_data'`) и отчёт обязан писать то же, что на экране:
 * «нет данных», а не «100 · ok».
 */
import { describe, it, expect } from 'vitest';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv } from '../bb-diagnostics-export.engine';

const report = {
  weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [],
  symmetry: { ratios: {}, score: 0, issues: [] }, stimulus: { issues: [], scorePenalty: 0, global: {} },
  score: { score: 100, level: 'ok', verification: 0, floors: [], verificationMissing: ['screen', 'diary', 'measures'] },
  findings: [], priorities: [],
} as any;

describe('BB-D-05 (хвост): «нет данных» вместо 100', () => {
  it('без флага печатается обычная оценка (обратная совместимость)', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-03' } as any);
    expect(html).toContain('100/100');
    expect(html).not.toContain('Оценка: нет данных');
    const csv = buildBBDiagnosticsCsv(report, null, { weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(csv).toContain('"score","100"');
  });

  it('HTML: нет данных — прямое слово, без балла и «ok»', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-03', scoreState: 'no_data' } as any);
    expect(html).toContain('Оценка: нет данных');
    expect(html).not.toContain('100/100');
    expect(html).not.toContain('проверка данных 0%');
  });

  it('CSV: score/level/verification = нет данных, а не 100/ok/0%', () => {
    const csv = buildBBDiagnosticsCsv(report, null, { weakCauses: {}, weakHeads: [], specBlock: null, scoreState: 'no_data' } as any);
    expect(csv).toContain('"score","нет данных"');
    expect(csv).toContain('"level","нет данных"');
    expect(csv).toContain('"verification","—"');
    expect(csv).not.toContain('"score","100"');
  });
});
