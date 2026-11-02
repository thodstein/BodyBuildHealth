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
    // Шапка + 41 метрика: хаб-мастер передаёт все поддерживаемые поля
    // (Kinovea-наклон/turnover/повторы, overlay-потеря vmax, heat-сводка и вес,
    // качество и параметры съёмки, ракурс по замеру, угол камеры по эталону, ось
    // эталона и поправка горизонтали, спор параметров и замера, чем нанесена линия
    // на видео, асимметрия, метрика/порог/пауза VBT, LVP r²).
    expect(lines.length).toBe(42);
    for (const field of ['Kinovea turnover', 'Kinovea повторов', 'Overlay потеря vmax', 'Heatmap медленных отрезков', 'Точка срыва', 'Скорость в точке срыва', 'Вес штанги на записи', 'Качество съёмки', 'Съёмка: параметры', 'Горизонтальный ход штанги', 'Проверка ракурса', 'Угол камеры по эталону', 'Эталон в кадре', 'Эталон: ось', 'xLoop с поправкой на ракурс', 'Поправка xLoop на ракурс', 'Ракурс: параметры и замер', 'Наложение линии на видео', 'Масштаб калибровки кадра', 'Разброс масштаба по высоте', 'Привязок перспективы', 'Смещение трека от начала видео', 'Масштаб CSV', 'Асимметрия', 'VBT метрика', 'VBT VL-порог', 'VBT пауза', 'LVP r²']) {
      expect(csv).toContain(field);
    }
    expect(csv).toContain("'=cmd|evil");
  });
  it('отчёт фиксирует, чем нанесена линия на видео (иначе его не воспроизвести)', () => {
    const inp = {
      ...BASE,
      captureDetails: 'камера 1.2 м · дистанция 3 м · слева · телефон',
      videoOverlayMode: 'perspective' as const,
      videoScalePxPerCm: 8.24,
      videoPerspSkewPct: 31,
      videoPerspAnchors: 4,
      videoOffsetSec: 1.5,
      csvScaleCmPerUnit: 0.01,
    };
    const csv = buildMovementDiagnosticsCsv(inp);
    expect(csv).toContain('перспектива (4 привязки');
    expect(csv).toContain('камера 1.2 м');
    // Числа остаются числами — Excel не должен увидеть в них текст.
    expect(csv).toContain('"8.24"');
    expect(csv).toContain('"31"');
    expect(csv).toContain('"1.5"');
    expect(csv).toContain('"0.01"');

    const html = buildMovementDiagnosticsHtml(inp);
    expect(html).toContain('разброс масштаба 31%');
    expect(html).toContain('привязок 4');
    expect(html).toContain('трек с 1.5 с');
    expect(html).toContain('CSV 0.01 см/ед');
  });
  it('без калибровки — «панель», без данных — «—», формула в параметрах съёмки экранируется', () => {
    const panel = buildMovementDiagnosticsCsv({ ...BASE, videoOverlayMode: 'panel' });
    expect(panel).toContain('панель (без калибровки кадра)');

    const empty = buildMovementDiagnosticsCsv({ ...BASE });
    const row = empty.split('\n').find((l) => l.includes('Наложение линии на видео'))!;
    expect(row).toContain('"—"');

    const evil = buildMovementDiagnosticsCsv({ ...BASE, captureDetails: '=HYPERLINK("http://x")' });
    expect(evil).toContain("'=HYPERLINK");
  });
  it('угол камеры по эталону — отдельные строки, пустые честно «—»', () => {
    const withRef = buildMovementDiagnosticsCsv({
      ...BASE,
      refAzimuthDeg: 12,
      refLengthCm: 131,
    });
    const val = (csv: string, field: string) => csv.split('\n').find((l) => l.startsWith(`"${field}","`))!;
    expect(val(withRef, 'Угол камеры по эталону, °')).toBe('"Угол камеры по эталону, °","12"');
    expect(val(withRef, 'Эталон в кадре, см')).toBe('"Эталон в кадре, см","131"');
    // 0° — это замер («камера в плоскости»), его нельзя потерять как «пусто».
    const zero = buildMovementDiagnosticsCsv({ ...BASE, refAzimuthDeg: 0, refLengthCm: 100 });
    expect(val(zero, 'Угол камеры по эталону, °')).toBe('"Угол камеры по эталону, °","0"');

    const empty = buildMovementDiagnosticsCsv({ ...BASE });
    expect(val(empty, 'Угол камеры по эталону, °')).toBe('"Угол камеры по эталону, °","—"');
    expect(val(empty, 'Эталон в кадре, см')).toBe('"Эталон в кадре, см","—"');

    const html = buildMovementDiagnosticsHtml({ ...BASE, refAzimuthDeg: 12, refLengthCm: 131 });
    expect(html).toContain('12° от плоскости движения');
    expect(html).toContain('эталон 131 см');
    expect(buildMovementDiagnosticsHtml({ ...BASE })).not.toContain('Угол камеры по эталону');
    // Ось эталона — часть метода, а не украшение: без неё угол не пересчитать.
    const alongHtml = buildMovementDiagnosticsHtml({ ...BASE, refAzimuthDeg: 30, refLengthCm: 131, refAxis: 'along' });
    expect(alongHtml).toContain('эталон 131 см, вдоль штанги');
    const alongCsv = buildMovementDiagnosticsCsv({ ...BASE, refAzimuthDeg: 30, refLengthCm: 131, refAxis: 'along' });
    expect(alongCsv.split('\n').find((l) => l.startsWith('"Эталон: ось","'))).toBe('"Эталон: ось","вдоль штанги"');
    // Без замера оси нет — «—», а не выдуманная «поперёк движения».
    const emptyCsv = buildMovementDiagnosticsCsv({ ...BASE });
    expect(emptyCsv.split('\n').find((l) => l.startsWith('"Эталон: ось","'))).toBe('"Эталон: ось","—"');
  });
  it('спор «параметры ↔ замер» — строка отчёта, а не тишина', () => {
    const csv = buildMovementDiagnosticsCsv({
      ...BASE,
      angleCheck: 'Камера в плоскости движения (8°)',
      angleBasis: 'side',
      refAzimuthDeg: 8,
      angleMetaConflict: 'Замер противоречит параметрам: по эталону камера в плоскости движения (8°), а в параметрах указан вид спереди.',
    });
    const row = csv.split('\n').find((l) => l.startsWith('"Ракурс: параметры и замер","'))!;
    expect(row).toContain('противоречит параметрам');
    // Без спора — «—», чтобы отчёт не пересказывал сам себя.
    const clean = buildMovementDiagnosticsCsv({ ...BASE, refAzimuthDeg: 8, angleBasis: 'side' });
    expect(clean.split('\n').find((l) => l.startsWith('"Ракурс: параметры и замер","'))).toBe('"Ракурс: параметры и замер","—"');
    expect(buildMovementDiagnosticsHtml({ ...BASE })).not.toContain('Ракурс: параметры и замер');
  });
  it('поправка xLoop на ракурс — число рядом с измеренным, с оговоркой «оценка»', () => {
    const inp = {
      ...BASE,
      kinoveaXLoop: 2.85,
      refAzimuthDeg: 25,
      refLengthCm: 131,
      xLoopRefCorrectedCm: 3.15,
      xLoopRefCorrectionPct: 10.4,
    };
    const csv = buildMovementDiagnosticsCsv(inp);
    const val = (field: string) => csv.split('\n').find((l) => l.startsWith(`"${field}","`))!;
    expect(val('xLoop с поправкой на ракурс, см')).toBe('"xLoop с поправкой на ракурс, см","3.15"');
    expect(val('Поправка xLoop на ракурс, %')).toBe('"Поправка xLoop на ракурс, %","10.4"');
    // Измеренное значение остаётся отдельной строкой — поправка его не подменяет.
    expect(val('Kinovea xLoop, см')).toBe('"Kinovea xLoop, см","2.85"');

    const html = buildMovementDiagnosticsHtml(inp);
    expect(html).toContain('3.15 см');
    expect(html).toContain('поправка +10.4%');
    expect(html).toContain('оценка — не замена съёмке в плоскости движения');
    // Без поправки строки нет вовсе, а не «0 см».
    expect(buildMovementDiagnosticsHtml({ ...BASE, kinoveaXLoop: 2.85 })).not.toContain('с поправкой на ракурс');
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
