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
      he_bb_last_movement_extra: JSON.stringify({ shoulder: 'плечо: тест', мусор: 123, bench: 'жим: хват 1.8 BAW', painMonitor: 'Боль [Локоть]: красный', posterior: 'задняя цепь: NHE 3', screenPriority: 'приоритет: 1. Боль' }),
    };
    (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null };
    try {
      const html = buildBbMovementPrintBlock();
      expect(html).toContain('Скрининг движений');
      expect(html).toContain('Голеностоп');
      expect(html).not.toContain('<b>(дорсифлексия)</b>');
      expect(html).toContain('слабее левая');
      expect(html).toContain('плечо: тест');
      // R8: новые ключи приёмника печатаются тем же персистом (кап 300 на строку)
      expect(html).toContain('жим: хват 1.8 BAW');
      expect(html).toContain('Боль [Локоть]: красный');
      expect(html).toContain('задняя цепь: NHE 3');
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
  it('R8 HTML несёт жим/боль/заднюю цепь/шарнир-нагрузку/ER:IR/приоритет + XSS-esc', () => {
    const html = buildBBDiagnosticsHtml(rep() as any, {
      ...meta(),
      bench: { level: 'fix', text: 'хват <script>bad</script> 1.8 BAW' },
      painMon: 'Боль [Локоть]: красный — 7/10 днём',
      posterior: { nhe: 'NHE: 3 повтора — слабо', adductor: 'Аддукторы: асимметрия 20%' },
      loadedHinge: { text: 'Нагруженный наклон: под весом поясница уходит' },
      erir: { text: 'ER/IR 0.62 (<0.75)' },
      screenPriority: ['1. Боль (красный)', '2. Голеностоп: мобилизация'],
    } as any);
    for (const h of ['Жим лёжа (скрининг)', 'Боль-мониторинг', 'Задняя цепь (NHE/аддукторы)', 'Шарнир под весом', 'Плечо ER:IR', 'Скрининг — приоритет']) {
      expect(html).toContain(h);
    }
    expect(html).not.toContain('<script>bad</script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('R8 HTML без новых полей — секций нет (байт-совместимость)', () => {
    const html = buildBBDiagnosticsHtml(rep() as any, meta() as any);
    for (const h of ['Жим лёжа (скрининг)', 'Боль-мониторинг', 'Задняя цепь', 'Шарнир под весом', 'Плечо ER:IR', 'Скрининг — приоритет']) {
      expect(html).not.toContain(h);
    }
  });
  it('R8 CSV несёт bench/pain_monitor/posterior/loaded_hinge/er_ir/screen_priority', () => {
    const csv = buildBBDiagnosticsCsv(rep() as any, null, {
      ...meta(),
      bench: { level: 'watch', text: 'хват 1.15 BAW' },
      painMon: 'Боль [Колено]: жёлтый',
      posterior: { nhe: 'NHE: 4 повтора', adductor: 'Аддукторы: асимметрия 12%' },
      loadedHinge: { text: 'Нагруженный наклон: нейтраль держится' },
      erir: { text: 'ER/IR 0.62 (<0.75)' },
      screenPriority: ['1. Боль (жёлтый)'],
    } as any);
    for (const k of ['bench', 'pain_monitor', 'posterior_nhe', 'posterior_addductor', 'loaded_hinge', 'er_ir', 'screen_priority']) {
      expect(csv).toContain(k);
    }
  });
  it('R8 CSV без новых полей — строк нет (тихо)', () => {
    const csv = buildBBDiagnosticsCsv(rep() as any, null, meta() as any);
    for (const k of ['bench', 'pain_monitor', 'posterior_nhe', 'loaded_hinge', 'er_ir', 'screen_priority']) {
      expect(csv.includes(k), k).toBe(false);
    }
  });
});
