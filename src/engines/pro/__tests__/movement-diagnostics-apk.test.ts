import { describe, expect, it } from 'vitest';
import {
  buildMovementDiagnosticsHtml,
  buildMovementDiagnosticsCsv,
  movementDiagnosticsFilename,
  buildHeatTrendCsv,
} from '../movement-diagnostics-export.engine';
import { parseKinoveaCSV, analyzeBarTracking } from '../../strength-sport/strength-sport-video.engine';
import { diagnoseVelocity } from '../vbt.engine';

const BASE = {
  lift: 'bench' as const,
  liftRu: 'Жим лёжа',
  phase: 'mid' as const,
  phaseRu: 'Средняя точка',
  issues: ['bar_loops'] as const,
  issuesRu: ['Петлеобразная траектория'],
  vbtBest: 0.6,
  vbtLast: 0.45,
  vbtWeightKg: 100,
  vbtLossPct: 25,
  vbtZone: 'зона силы',
  videoNote: 'Локти 52° · хват 1.42 · скорость 0.48 м/с',
  kinoveaXLoop: 3.2,
} as any;

describe('movement-diagnostics-export', () => {
  it('HTML содержит все блоки и экранирует XSS', () => {
    const html = buildMovementDiagnosticsHtml({ ...BASE, liftRu: '<script>alert(1)</script>' });
    expect(html).toContain('Диагностика движений');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('xLoop');
  });
  it('HTML без VBT честно пишет «не измерена»', () => {
    const html = buildMovementDiagnosticsHtml({ ...BASE, vbtBest: null, vbtLast: null });
    expect(html).toContain('не измерена');
  });
  it('CSV: шапка + все поля экспорта + защита от формульной инъекции', () => {
    const csv = buildMovementDiagnosticsCsv({ ...BASE, issuesRu: ['=cmd|evil'] });
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Поле');
    // Шапка + 26 метрик: хаб-мастер передаёт все поддерживаемые поля
    // (Kinovea-наклон/turnover/повторы, overlay-потеря vmax, heat-сводка и вес,
    // качество съёмки, асимметрия, метрика/порог/пауза VBT, LVP r²).
    expect(lines.length).toBe(27);
    for (const field of ['Kinovea turnover', 'Kinovea повторов', 'Overlay потеря vmax', 'Heatmap медленных отрезков', 'Точка срыва', 'Скорость в точке срыва', 'Вес штанги на записи', 'Качество съёмки', 'Асимметрия', 'VBT метрика', 'VBT VL-порог', 'VBT пауза', 'LVP r²']) {
      expect(csv).toContain(field);
    }
    expect(csv).toContain("'=cmd|evil");
  });
  it('VBT-метрика в отчёте — по-русски, без id «mcv»', () => {
    const csv = buildMovementDiagnosticsCsv({ ...BASE, vbtMetric: 'mcv' });
    const html = buildMovementDiagnosticsHtml({ ...BASE, vbtMetric: 'peak' });
    expect(csv).toContain('средняя концентрическая (MCV)');
    expect(csv).not.toContain('"mcv"');
    expect(html).toContain('пиковая (Peak)');
  });
  it('имя файла по лифту и расширению', () => {
    expect(movementDiagnosticsFilename('squat', 'html')).toMatch(/^movement-squat-\d{8}\.html$/);
    expect(movementDiagnosticsFilename('bench', 'csv')).toMatch(/\.csv$/);
  });
  it('Kinovea CSV → xLoop инвариант (синтетика ±4см → warn)', () => {
    const csv = ['t,x,y', '0,0.0,100', '0.033,2.0,95', '0.066,-2.0,90', '0.1,4.0,85', '0.133,-4.0,80'].join('\n');
    const pts = parseKinoveaCSV(csv);
    expect(pts).not.toBeNull();
    const r = analyzeBarTracking(pts!);
    expect(r).not.toBeNull();
    // Butterworth 12Гц сглаживает размах — честный инвариант: детект ≥4 (warn-порог SRD)
    expect(r!.xLoop).toBeGreaterThanOrEqual(4);
  });
  it('VBT потеря 25% на жиме — зона превышения, фаза подсказана', () => {
    const d = diagnoseVelocity('bench', 0.6, 0.45, 100);
    expect(d.lossPct).toBeCloseTo(25, 0);
    expect(d.exceeded).toBe(true);
    expect(d.suggestedPhase).toBeTruthy();
  });
});

describe('buildHeatTrendCsv — недельная динамика heat', () => {
  const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`).getTime();

  it('сортирует недели, считает изменение доли и честно пишет «—»', () => {
    const csv = buildHeatTrendCsv([
      { ts: day('2026-10-20'), slowPct: 27, xLoopCm: 2.4, vmaxMS: 0.48 },
      { ts: day('2026-10-06'), slowPct: 40, xLoopCm: null, vmaxMS: 0.42 },
      { ts: day('2026-10-13'), slowPct: 34, xLoopCm: 2.9, vmaxMS: 0.45 },
    ], 'Жим лёжа');
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Движение","Жим лёжа"');
    expect(lines[1]).toContain('"Доля медленных отрезков, %"');
    expect(lines[2]).toContain('"40"');
    expect(lines[2]).toContain('"W41/2026"');
    expect(lines[2]).toContain('"—"'); // xLoop в первом срезе не было
    expect(lines[4]).toContain('"-7"'); // изменение относительно предыдущей недели (27 − 34), текст не ломается
    expect(lines[4]).toContain('"W43/2026"');
    expect(lines[4]).toContain('"2.4"');
    expect(lines.length).toBe(5);
  });

  it('мусор и пустая история не дают пустого файла', () => {
    const csv = buildHeatTrendCsv([], 'Присед');
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"Дата"');
    expect(lines[2]).toContain('"—"');

    const bad = buildHeatTrendCsv([{ ts: Number.NaN, slowPct: 10, xLoopCm: null, vmaxMS: null }] as any, 'Присед');
    expect(bad.split('\n').length).toBe(3); // заголовок + строки + заглушка
  });
});
