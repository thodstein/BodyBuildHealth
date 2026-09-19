import { describe, it, expect } from 'vitest';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv } from '../bb-diagnostics-export.engine';

/**
 * K7 (BB-CORRECTIVE-HUB-PRO-PLAN): экспорт коррекций несёт ту же дозу, что карточка/вставка
 * (weightHint/restSec/reps/RIR/level), а старый формат без дозы не ломается.
 */
const report = {
  weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [],
  symmetry: { ratios: {}, issues: [] },
  stimulus: { issues: [], global: { lengthened: 0, midRange: 0, shortened: 0, compound: 0, isolation: 0 } },
  score: { score: 80, level: 'ok', verification: 'high', floors: [] },
  findings: [], priorities: [],
} as any;

describe('bb-corrective K7: экспорт дозы', () => {
  it('HTML печатает дозу: ≈кг · отдых · повторы · RIR · уровень', () => {
    const meta = {
      correctiveDetail: [{
        id: 'dm-lateral-pause', zone: 'delt_mid', exerciseId: 'lateral_raise', protocol: '3×12–15 RIR1 2-1-1-0',
        cues: ['a', 'b', 'c'], source: 'S', weightHint: 60, restSec: 60, reps: 12, repsMax: 15, rir: 1, level: 'intermediate', phase: 'technique', alt: ['cable_lateral'],
      }],
    } as any;
    const html = buildBBDiagnosticsHtml(report, meta);
    expect(html).toMatch(/Коррекции/);
    expect(html).toMatch(/≈60 кг/);
    expect(html).toMatch(/отдых 60с/);
    expect(html).toMatch(/12–15 повт/);
    expect(html).toMatch(/RIR1/);
    expect(html).toMatch(/intermediate/);
  });
  it('HTML: bodyweight-запись — «без кг»', () => {
    const meta = { correctiveDetail: [{ id: 'sh', zone: 'delt_rear', exerciseId: 'wall_slide', protocol: '2×10', cues: [], source: 'S', bodyweight: true, restSec: 45 }] } as any;
    const html = buildBBDiagnosticsHtml(report, meta);
    expect(html).toMatch(/без кг/);
    expect(html).toMatch(/отдых 45с/);
  });
  it('CSV: хвостовые колонки дозы, старые колонки 1-в-1', () => {
    const meta = { correctiveDetail: [{ id: 'dm-lateral-pause', zone: 'delt_mid', exerciseId: 'lateral_raise', protocol: '3×12–15 RIR1', cues: [], source: 'S', weightHint: 60, restSec: 60, reps: 12, repsMax: 15 }] } as any;
    const csv = buildBBDiagnosticsCsv(report, null, meta);
    expect(csv).toMatch(/"corr_id","corr_zone","corr_exercise","corr_protocol","corr_source","corr_weight","corr_rest","corr_reps"/);
    expect(csv).toMatch(/"dm-lateral-pause","delt_mid","lateral_raise","3×12–15 RIR1","S","60","60","12-15"/);
  });
  it('старый формат без дозы — секция есть, пустые ячейки (совместимость)', () => {
    const meta = { correctiveDetail: [{ id: 'c1', zone: 'chest_upper', exerciseId: 'incline_db', protocol: '3×8 RIR2', cues: ['n'], source: 'x' }] } as any;
    expect(buildBBDiagnosticsHtml(report, meta)).toMatch(/Коррекции/);
    const csv = buildBBDiagnosticsCsv(report, null, meta);
    expect(csv).toMatch(/"c1","chest_upper","incline_db","3×8 RIR2","x","","",""/);
  });
});
