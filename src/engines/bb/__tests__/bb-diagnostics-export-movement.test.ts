import { describe, it, expect } from 'vitest';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv, buildBbMovementPrintBlock } from '../bb-diagnostics-export.engine';

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
  it('П2 HTML рендерит D1–D5 секции (плечо/шарнир/YBT/асимметрии/замены)', () => {
    const html = buildBBDiagnosticsHtml(rep() as any, {
      ...meta(),
      shoulder: { pass: false, locus: 'thoracic', text: 'Плечо у стены: ribs → экстензия' },
      hinge: { text: 'Шарнир: чисто · Нагруженный присед: стабилен' },
      ybt: { text: 'YBT-баланс: норма' },
      asymPriority: 'Асимметрии: голеностоп 3 см',
      driverSubs: { text: 'гоблет-присед — Голеностоп' },
    } as any);
    expect(html).toContain('Плечо у стены');
    expect(html).toContain('Шарнир + нагрузка');
    expect(html).toContain('YBT-баланс');
    expect(html).toContain('Асимметрии');
    expect(html).toContain('Замены под драйвер');
  });
  it('П2 HTML без D1–D5 — секций нет, не падает (байт-совместимость)', () => {
    const html = buildBBDiagnosticsHtml(rep() as any, meta() as any);
    expect(html).not.toContain('Плечо у стены');
    expect(html).not.toContain('Шарнир + нагрузка');
    expect(html).not.toContain('YBT-баланс');
    expect(html).not.toContain('Замены под драйвер');
  });
  it('П3 print-блок: персист → секция, XSS заэскейплен', () => {
    const store: Record<string, string> = {
      he_bb_last_movement_driver: JSON.stringify({ label: 'Голеностоп <b>(дорсифлексия)</b>', fix: 'пятка 2.5 см', driver: 'ankle', confidence: 0.7 }),
      he_bb_last_single_leg: JSON.stringify({ weakSide: 'left', text: 'Односторонний: слабее левая' }),
      he_bb_last_movement_extra: JSON.stringify({ shoulder: 'плечо: тест', мусор: 123 }),
    };
    (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null };
    try {
      const html = buildBbMovementPrintBlock();
      expect(html).toContain('Скрининг движений');
      expect(html).toContain('Голеностоп');
      expect(html).not.toContain('<b>(дорсифлексия)</b>');
      expect(html).toContain('слабее левая');
      expect(html).toContain('плечо: тест');
    } finally {
      delete (globalThis as any).localStorage;
    }
  });
  it('П3 print-блок: пустой стор — пустая строка (печать байт-в-байт)', () => {
    (globalThis as any).localStorage = { getItem: () => null };
    try {
      expect(buildBbMovementPrintBlock()).toBe('');
    } finally {
      delete (globalThis as any).localStorage;
    }
  });
  it('П3 print-блок: без localStorage — пусто, не падает', () => {
    expect(buildBbMovementPrintBlock()).toBe('');
  });
  it('П2 CSV несёт shoulder/hinge_loaded/ybt/asym_priority/driver_subs', () => {
    const csv = buildBBDiagnosticsCsv(rep() as any, null, {
      ...meta(),
      shoulder: { pass: false, locus: 'thoracic', text: 'Плечо у стены тест' },
      hinge: { text: 'Шарнир тест' },
      ybt: { text: 'YBT тест' },
      asymPriority: 'Асимметрии тест',
      driverSubs: { text: 'Замены тест' },
    } as any);
    for (const k of ['shoulder', 'hinge_loaded', 'ybt', 'asym_priority', 'driver_subs']) {
      expect(csv).toContain(k);
    }
  });
});
