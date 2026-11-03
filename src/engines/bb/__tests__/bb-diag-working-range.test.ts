/**
 * bb-diag-working-range.test.ts — BB-D-33 (хвост): «Рабочий вес (ориентир)» реально
 * доезжает до отчёта, а не остаётся секцией, которую движок умеет печатать.
 *
 * Локи:
 *  - коридор считается от индивидуального e1RM (LVP) и подписывается источником;
 *  - нет e1RM — нет коридора и нет секции в HTML/CSV (не выдумываем вес);
 *  - проценты в подписи выводятся из самого коридора (не хардкод «65–80»).
 */
import { describe, it, expect } from 'vitest';
import { bbWorkingRange, bbWorkingRangeNote } from '../bb-spec-ics.engine';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv } from '../bb-diagnostics-export.engine';

const report = {
  weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [],
  symmetry: { ratios: {}, score: 0, issues: [] }, stimulus: { issues: [], scorePenalty: 0, global: {} },
  score: { score: 90, level: 'ok', verification: 0.8, floors: [], verificationMissing: [] },
  findings: [], priorities: [],
} as any;

describe('BB-D-33 «Рабочий вес»: источник, подпись, честность', () => {
  it('коридор массы — 65–80% от e1RM, шаг 2.5 кг', () => {
    const r = bbWorkingRange(100, 'mass')!;
    expect(r.low).toBe(65);
    expect(r.high).toBe(80);
    expect(bbWorkingRange(0)).toBeNull();
  });

  it('подпись: движение + кг + проценты от e1RM + источник', () => {
    const r = bbWorkingRange(100, 'mass')!;
    const note = bbWorkingRangeNote(r, 100, { liftRu: 'Присед', source: 'individual' });
    expect(note).toBe('Присед: 65–80 кг (65–80% от e1RM 100 кг) · индивид. LVP');
    // популяционный профиль честно назван другим словом
    expect(bbWorkingRangeNote(r, 100, { source: 'population' })).toContain('популяц. LVP');
    // без источника — без приставки, а не «индивид» по умолчанию
    expect(bbWorkingRangeNote(r, 100)).toBe('65–80 кг (65–80% от e1RM 100 кг)');
  });

  it('проценты не дублируются хардкодом: сила считается от своего коридора', () => {
    const r = bbWorkingRange(100, 'strength')!;
    const note = bbWorkingRangeNote(r, 100);
    expect(note).toContain('80–90%');
    expect(note).not.toContain('65–80%');
  });

  it('коридор доезжает до HTML и CSV', () => {
    const meta = { workingRange: 'Присед: 65–80 кг (65–80% от e1RM 100 кг) · индивид. LVP' } as any;
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-03', ...meta } as any);
    expect(html).toContain('Рабочий вес (ориентир)');
    expect(html).toContain('Присед: 65–80 кг');
    const csv = buildBBDiagnosticsCsv(report, null, { ...meta, weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(csv).toContain('working_range');
    expect(csv).toContain('Присед: 65–80 кг');
  });

  it('нет коридора — нет секции (пустое не печатается)', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-03', workingRange: null } as any);
    expect(html).not.toContain('Рабочий вес (ориентир)');
    const csv = buildBBDiagnosticsCsv(report, null, { workingRange: null, weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(csv).not.toContain('working_range');
  });
});
