/**
 * PRO-5 Э5 — единый сборщик PRO-меты выдачи ББ-диагностики (`bb-hub-export.ts`).
 * Локи: один объект для HTML/CSV (CSV больше не теряет driver_subs), пустое — тихо,
 * и хаб собирает мету ровно одним вызовом (никаких копий литералов).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPro2Meta, type BbHubPro2Input } from '../bb-hub-export';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv } from '../../../../engines/bb/bb-diagnostics-export.engine';

const SRC = readFileSync(resolve(__dirname, '..', 'BBDiagnosticsHub.tsx'), 'utf8');

const baseInput = (over?: Partial<BbHubPro2Input>): BbHubPro2Input => ({
  lrVerdicts: [{ group: 'chest', left: 10, right: 12, asymPct: 18, weakSide: 'left', verdict: 'topup', topUpSets: 2, text: 'слабее левая' }],
  moveDriver: { driver: 'ankle', label: 'Голеностоп', fix: 'подпятка', confidence: 0.8 },
  singleLeg: { weakSide: 'left', text: 'слабее левая' },
  ohs: { totalScore: 4, failed: 1 },
  mmcLine: 'Внутренний фокус: тяни локтем — включай мышцу',
  shoulder: { pass: false, locus: 'thoracic', text: 'плечо у стены: грудной' },
  hingeText: 'шарнир чисто · пол не плывёт',
  ybt: { text: 'YBT: асимметрия 5 см' },
  asymText: 'Асимметрия: КТС 2 см',
  driverSubsText: 'Подпятка · Тяга троса — держи стопу',
  bench: { level: 'fix', text: 'жим: сузь хват' },
  painMonLine: 'Боль 7/10 → красный',
  posterior: { nhe: 'NHE 3 повтора', adductor: null },
  loadedHinge: { text: 'снизь вес' },
  erir: { text: '0.63 — добавь наружную' },
  screenPriority: ['1. Голеностоп — подпятка'],
  correctiveDetail: [{ id: 'c1', zone: 'chest_upper', exerciseId: 'incline_db', protocol: '3×8 RIR2 3-1-1-0', cues: ['n'], source: 'x' }],
  lrDirection: [{ group: 'chest', text: 'Перекос держится: левая' }],
  ...over,
});

describe('bb-hub-export (PRO-5 Э5)', () => {
  it('полный вход → все секции меты на месте (lr маппится, driverSubs — объект text)', () => {
    const m = buildPro2Meta(baseInput());
    expect(m.lr).toEqual([{ group: 'chest', left: 10, right: 12, asymPct: 18, weakSide: 'left', verdict: 'topup', topUpSets: 2, text: 'слабее левая' }]);
    expect(m.movementDriver).toMatchObject({ label: 'Голеностоп' });
    expect(m.singleLeg).toMatchObject({ weakSide: 'left' });
    expect(m.ohs).toEqual({ totalScore: 4, failed: 1 });
    expect(m.mmc).toContain('Внутренний');
    expect(m.hinge).toEqual({ text: 'шарнир чисто · пол не плывёт' });
    expect(m.driverSubs).toEqual({ text: 'Подпятка · Тяга троса — держи стопу' });
    expect(m.bench).toEqual({ level: 'fix', text: 'жим: сузь хват' });
    expect(m.painMon).toBe('Боль 7/10 → красный');
    expect(m.posterior).toEqual({ nhe: 'NHE 3 повтора', adductor: null });
    expect(m.screenPriority).toEqual(['1. Голеностоп — подпятка']);
    expect(m.correctiveDetail).toHaveLength(1);
    expect(m.lrDirection).toHaveLength(1);
  });

  it('пустое — тихо: driverSubs null, bench/painMon/posterior/erir пустые', () => {
    const m = buildPro2Meta(baseInput({
      driverSubsText: null,
      bench: null,
      painMonLine: null,
      posterior: null,
      loadedHinge: null,
      erir: null,
      screenPriority: null,
      correctiveDetail: null,
      asymText: '',
    }));
    expect(m.driverSubs).toBeNull();
    expect(m.bench).toBeNull();
    expect(m.painMon).toBeNull();
    expect(m.posterior).toBeNull();
    expect(m.erir).toBeNull();
    expect(m.correctiveDetail).toBeNull();
    expect(m.asymPriority).toBe('');
  });

  it('CSV получает driver_subs из той же меты (паритет с HTML, раньше строка терялась)', () => {
    const meta = buildPro2Meta(baseInput());
    const report = { weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [], symmetry: { ratios: {}, score: 0, issues: [] }, stimulus: { issues: [], scorePenalty: 0, global: {} }, score: { score: 100, level: 'ok', verification: 0, floors: [] }, findings: [], priorities: [] } as any;
    const csv = buildBBDiagnosticsCsv(report, null, { ...meta, weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(csv).toContain('driver_subs');
    expect(csv).toContain('Подпятка · Тяга троса — держи стопу');
    const html = buildBBDiagnosticsHtml(report, { date: '2026-09-18', ...meta } as any);
    expect(html).toContain('Замены под драйвер');
    expect(html).toContain('Подпятка');
  });

  it('source-guard: хаб собирает мету ровно одним вызовом, копий литералов нет', () => {
    expect((SRC.match(/buildPro2Meta\(/g) || []).length).toBe(1);
    expect(SRC).not.toContain('pro2csv');
    expect(SRC).not.toContain('buildMovementExport');
    expect(SRC).not.toContain('let pro2: Record');
    // причины — единое мемо с auditFor (экспорт не считает свою копию)
    expect((SRC.match(/diagnoseWeakCausesBatch\(/g) || []).length).toBe(1);
    // деталь коррекций — одно мемо (карточка = экспорт = мост)
    expect((SRC.match(/correctiveDetailForExport/g) || []).length).toBeGreaterThanOrEqual(3);
    // Э5-доводка (R3/R5/R6): каждый расчёт сведён к одному мемо
    expect((SRC.match(/readSavedBbPlan\(\);/g) || []).length).toBe(1); // savedPlan
    expect((SRC.match(/readPlanHistory\(localStorage/g) || []).length).toBe(1); // planHistory
    expect((SRC.match(/endsWith\('_asym'\)/g) || []).length).toBe(1); // asymMax
    expect((SRC.match(/Внутренний' : 'Внешний/g) || []).length).toBe(1); // mmcLine
  });
});
