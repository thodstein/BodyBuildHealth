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
  correctionBlock: ['📅 Блок коррекции: 6 нед · 2 упр. · волна 3-3-4-4-3-3 · зоны: chest_upper'],
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
    expect(m.correctionBlock).toHaveLength(1);
    expect(m.lrDirection).toHaveLength(1);
  });

  it('ROUND-10: блок коррекции едет в HTML и CSV; без него — секций нет (байт-в-байт)', () => {
    const report = { weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [], symmetry: { ratios: {}, score: 0, issues: [] }, stimulus: { issues: [], scorePenalty: 0, global: {} }, score: { score: 100, level: 'ok', verification: 0, floors: [] }, findings: [], priorities: [] } as any;
    const withBlock = buildPro2Meta(baseInput());
    const html = buildBBDiagnosticsHtml(report, { date: '2026-09-22', ...withBlock } as any);
    expect(html).toContain('Блок коррекции (волна)');
    expect(html).toContain('волна 3-3-4-4-3-3');
    const csv = buildBBDiagnosticsCsv(report, null, { ...withBlock, weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(csv).toContain('correction_block');
    const empty = buildPro2Meta(baseInput({ correctionBlock: null }));
    const htmlEmpty = buildBBDiagnosticsHtml(report, { date: '2026-09-22', ...empty } as any);
    expect(htmlEmpty).not.toContain('Блок коррекции (волна)');
    const csvEmpty = buildBBDiagnosticsCsv(report, null, { ...empty, weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(csvEmpty).not.toContain('correction_block');
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

  it('BB-D-33: готовность/флаги/возврат/LVP/сухожилия/возраст-пол доезжают до HTML', () => {
    const meta = buildPro2Meta(baseInput({
      readiness: { level: 'yellow', advice: 'снизь объём', reasons: ['сон 5 ч'] },
      redFlags: { active: true, blocked: true, items: ['острая боль'], text: 'стоп-флаги: острая боль' },
      returnTo: { text: 'поэтапный возврат', stages: [{ stage: 1, title: 'техника', volume: '0%', rir: '+4', note: 'лёгкое' }] },
      lvp: { lift: 'squat', r2: 0.42, e1rm: 140, text: 'LVP: R² 0.42, e1RM 140', valid: true },
      tendon: { elbow: 'локоть: warn', shoulder: 'плечо: ok' },
      teen: '14-15 лет: объём ниже',
      femaleNotes: ['талия/бёдра: ориентир 0.7'],
    }));
    expect(meta.readiness).toMatchObject({ level: 'yellow' });
    expect(meta.redFlags).toMatchObject({ blocked: true });
    expect(meta.returnTo?.stages).toHaveLength(1);
    expect(meta.lvp).toMatchObject({ lift: 'squat' });
    expect(meta.tendon).toMatchObject({ elbow: 'локоть: warn' });
    expect(meta.teen).toContain('14-15');
    expect(meta.femaleNotes).toHaveLength(1);

    const report = { weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [], symmetry: { ratios: {}, score: 0, issues: [] }, stimulus: { issues: [], scorePenalty: 0, global: {} }, score: { score: 100, level: 'ok', verification: 0, floors: [], verificationMissing: [] }, findings: [], priorities: [] } as any;
    const html = buildBBDiagnosticsHtml(report, { date: '2026-09-22', ...meta } as any);
    // Каждая секция реально отрисована (а не просто лежит в объекте)
    for (const needle of ['Готовность', 'Флаги', 'возврат', 'LVP', 'Сухожилия', 'Подросток', 'Женские ориентиры']) {
      expect(html).toContain(needle);
    }
  });

  it('BB-D-38: пустые ориентиры по полу/возрасту — секции нет (не выдумываем)', () => {
    const meta = buildPro2Meta(baseInput({ teen: null, femaleNotes: null }));
    expect(meta.teen ?? null).toBeNull();
    expect(meta.femaleNotes ?? null).toBeNull();
    // источник: хаб считает ноты движками, а не литералами
    expect(SRC).toContain('teenTrainingNote(');
    expect(SRC).toContain('femaleSymmetryNotes(');
  });

  it('BB-G-01/04: сводка объёма/recovery и эффект коррекции доезжают до HTML', () => {
    const meta = buildPro2Meta(baseInput({
      volumeRecovery: {
        chips: [{ label: 'MRV', value: 'Грудь 24/20', detail: 'сверх MRV: Грудь' }],
        limiter: { label: 'Сон 5 ч', detail: 'объём приоритетов ×0.8' },
        advice: ['Снять 4 подх. с Грудь (факт 24 > MRV 20)'],
        effect: 'Эффект коррекции за 4 нед: 1 улучшилось · 0 хуже · 0 без изменений',
      },
    }));
    expect(meta.volumeRecovery).toMatchObject({ limiter: { label: 'Сон 5 ч' } });
    const report = { weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [], symmetry: { ratios: {}, score: 0, issues: [] }, stimulus: { issues: [], scorePenalty: 0, global: {} }, score: { score: 100, level: 'ok', verification: 0, floors: [], verificationMissing: [] }, findings: [], priorities: [] } as any;
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-03', ...meta } as any);
    expect(html).toContain('Объём · Recovery · Mobility');
    expect(html).toContain('Грудь 24/20');
    expect(html).toContain('Ограничитель');
    expect(html).toContain('Снять 4 подх.');
    expect(html).toContain('Эффект коррекции');
    // CSV-паритет: те же строки, что видны в хабе
    const csv = buildBBDiagnosticsCsv(report, null, { ...meta, weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(csv).toContain('vr_limiter');
    expect(csv).toContain('vr_advice');
    expect(csv).toContain('correction_effect');
    // без панели — секции нет (не выдумываем пустой блок)
    const empty = buildBBDiagnosticsHtml(report, { date: '2026-11-03', ...buildPro2Meta(baseInput()) } as any);
    expect(empty).not.toContain('Объём · Recovery · Mobility');
  });

  it('BB-G-08: «что делать дальше» доезжает до HTML и CSV (1–2 действия, без пустого блока)', () => {
    const meta = buildPro2Meta(baseInput({
      nextActions: [
        { title: 'Снять 4 подх. с Грудь', why: 'факт 26 против MRV 22', kind: 'training', zone: 'yellow', where: { type: 'screen', id: 'volume_hub', label: 'Объём-хаб' } },
        { title: 'Собрать план в конструкторе', why: 'Без плана не считаются покрытие головок', kind: 'plan', zone: 'yellow', where: null },
      ],
    }));
    expect(meta.nextActions).toHaveLength(2);
    const report = { weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [], symmetry: { ratios: {}, score: 0, issues: [] }, stimulus: { issues: [], scorePenalty: 0, global: {} }, score: { score: 60, level: 'warn', verification: 0.5, floors: [], verificationMissing: [] }, findings: [], priorities: [] } as any;
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-03', ...meta } as any);
    expect(html).toContain('Что делать дальше');
    expect(html).toContain('Снять 4 подх. с Грудь');
    // место шага видно в отчёте, а не только в приложении
    expect(html).toContain('Объём-хаб');
    const csv = buildBBDiagnosticsCsv(report, null, { ...meta, weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(csv).toContain('next_action');
    expect(csv).toContain('Снять 4 подх. с Грудь');
    // порядок сохраняется (первый шаг — первый в файле)
    expect(csv.indexOf('next_action')).toBeLessThan(csv.indexOf('Снять 4 подх.'));
    // без действий — секций нет (не рисуем пустую инструкцию)
    const emptyMeta = buildPro2Meta(baseInput({ nextActions: [] }));
    expect(emptyMeta.nextActions).toBeUndefined();
    const emptyHtml = buildBBDiagnosticsHtml(report, { date: '2026-11-03', ...emptyMeta } as any);
    expect(emptyHtml).not.toContain('Что делать дальше');
    const emptyCsv = buildBBDiagnosticsCsv(report, null, { ...emptyMeta, weakCauses: {}, weakHeads: [], specBlock: null } as any);
    expect(emptyCsv).not.toContain('next_action');
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
