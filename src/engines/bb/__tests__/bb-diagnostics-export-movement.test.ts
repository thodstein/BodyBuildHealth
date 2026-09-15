import { describe, it, expect } from 'vitest';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv } from '../bb-diagnostics-export.engine';

/** Паритет экспорта движений: HTML и CSV несут драйвер + односторонний + MMC (D1/D4). */
describe('bb-diagnostics-export-movement', () => {
  const rep = () => ({
    weakCandidates: [],
    weakMusclesCanonical: [],
    weakZonesGranular: [],
    symmetry: { ratios: {}, issues: [], score: 80 },
    stimulus: { global: { lengthened: 1, midRange: 2, shortened: 0, compound: 3, isolation: 2, patterns: {} }, issues: [] },
    score: { score: 90, level: 'ok', floors: [], verification: 0.5, penalties: {}, raw: 5 },
    findings: [], priorities: [],
  });
  const meta = () => ({
    movementDriver: { driver: 'ankle', label: 'Голеностоп (дорсифлексия)', fix: 'Мобилизация ежедневно', confidence: 0.9 },
    singleLeg: { weakSide: 'left', text: 'Односторонний: слабее левая' },
    mmc: 'Внутренний фокус: cue — text',
  });
  it('HTML рендерит драйвер + односторонний + MMC', () => {
    const html = buildBBDiagnosticsHtml(rep() as any, meta() as any);
    expect(html).toContain('Драйвер движений');
    expect(html).toContain('Голеностоп');
    expect(html).toContain('Односторонний скрининг');
    expect(html).toContain('слабее левая');
    expect(html).toContain('Фокус внимания');
  });
  it('HTML без движений — секций нет, не падает', () => {
    const html = buildBBDiagnosticsHtml(rep() as any, {} as any);
    expect(html).not.toContain('Драйвер движений');
    expect(html).not.toContain('Односторонний скрининг');
  });
  it('CSV несёт movement_driver + single_leg + mmc строками', () => {
    const csv = buildBBDiagnosticsCsv(rep() as any, null, meta() as any);
    expect(csv).toContain('movement_driver');
    expect(csv).toContain('ankle');
    expect(csv).toContain('single_leg');
    expect(csv).toContain('слабее левая');
    expect(csv).toContain('mmc');
  });
});
