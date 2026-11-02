import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import React from 'react';

/**
 * Проводка «хаб → отчёт»: реальные APK-мосты недоступны в jsdom, поэтому
 * перехватываем сохранение и смотрим сам CSV. Так проверяется, что отчёт
 * объясняет, чем нанесена линия на видео (без этого его не воспроизвести).
 */
const { savedCsv, savedText, savedHtml } = vi.hoisted(() => ({
  savedCsv: [] as string[],
  savedText: [] as Array<{ name: string; text: string }>,
  savedHtml: [] as string[],
}));

vi.mock('../../../../core/apk-share', () => ({
  copyOrShareText: async () => 'saved',
  saveCsvApk: async (_name: string, csv: string) => { savedCsv.push(csv); return 'saved'; },
  printHtmlApk: async (html: string) => { savedHtml.push(html); return 'saved'; },
  saveTextFileApk: async (name: string, text: string) => { savedText.push({ name, text }); return 'saved'; },
  saveBlobApk: async () => 'saved',
  shareOutcomeLabel: () => 'сохранено',
}));

import { LiftMasterCard } from '../LiftMasterCard';

const MASTER_KEY = 'he_lift_master_v1';
const CSV_POINTS = 'time,x,y\n0,0,0\n0.1,1,10\n0.2,2,20\n0.3,3,30';

const ANCHORS = [
  { timeSec: 0.1, trackX: 0, trackY: 0, videoX: 100, videoY: 520 },
  { timeSec: 0.4, trackX: 0.5, trackY: 16.7, videoX: 104, videoY: 362.2 },
  { timeSec: 0.7, trackX: 1, trackY: 33.3, videoX: 108, videoY: 223.8 },
  { timeSec: 1.0, trackX: 1.5, trackY: 50, videoX: 112, videoY: 100 },
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('he_lift_master_collapsed_v1', '{}');
  savedCsv.length = 0;
  savedText.length = 0;
  savedHtml.length = 0;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function exportCsv(seed: Record<string, unknown>, csvText = CSV_POINTS, scale = '0.01'): Promise<string> {
  localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', ...seed }));
  const { container } = render(<LiftMasterCard sessions={[]} />);
  act(() => {
    fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: csvText } });
  });
  act(() => {
    fireEvent.change(container.querySelector('[data-lift="kinovea-scale"]')!, { target: { value: scale } });
  });
  act(() => {
    fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!);
  });
  await act(async () => {
    fireEvent.click(container.querySelector('[data-lift="export-csv"]')!);
  });
  expect(savedCsv.length).toBe(1);
  return savedCsv[0];
}

/** Значение строки CSV вместе с кавычками: имена полей сами содержат запятые. */
const rowValue = (csv: string, field: string): string => {
  const prefix = `"${field}","`;
  const line = csv.split('\n').find((l) => l.startsWith(prefix));
  expect(line, `строка «${field}» в CSV`).toBeTruthy();
  return line!.slice(prefix.length - 1);
};

describe('хаб → CSV: как нанесена линия на видео', () => {
  it('перспектива: режим, разброс масштаба, привязки, смещение трека, масштаб CSV', async () => {
    const csv = await exportCsv({
      videoPersp: { bench: { anchors: ANCHORS, vA: -8, vB: 520, vC: 0.004, fitPx: 0.1, frameW: 1280, frameH: 720 } },
      videoOffsetSec: { bench: 1.5 },
    });
    expect(rowValue(csv, 'Наложение линии на видео')).toContain('перспектива (4 привязки');
    expect(rowValue(csv, 'Разброс масштаба по высоте, %')).toBe('"31"');
    expect(rowValue(csv, 'Привязок перспективы, шт')).toBe('"4"');
    expect(rowValue(csv, 'Смещение трека от начала видео, с')).toBe('"1.5"');
    expect(rowValue(csv, 'Масштаб CSV, см/ед')).toBe('"0.01"');
    // Единая калибровка кадра не задана — в отчёте «—», а не придуманный масштаб.
    expect(rowValue(csv, 'Масштаб калибровки кадра, px/см')).toBe('"—"');
  });

  it('калибровка кадра: единый px/см без перспективных полей', async () => {
    const csv = await exportCsv({
      videoCalib: { bench: { videoX: 100, videoY: 520, trackX: 0, trackY: 0, pxPerCm: 8.24 } },
    });
    expect(rowValue(csv, 'Наложение линии на видео')).toContain('калибровка кадра');
    expect(rowValue(csv, 'Масштаб калибровки кадра, px/см')).toBe('"8.24"');
    expect(rowValue(csv, 'Разброс масштаба по высоте, %')).toBe('"—"');
    expect(rowValue(csv, 'Привязок перспективы, шт')).toBe('"—"');
  });

  it('без калибровки — «панель», параметры съёмки идут в отчёт', async () => {
    const csv = await exportCsv({
      capture: { heightM: '1.2', distM: '3', side: 'left', device: 'phone' },
    });
    expect(rowValue(csv, 'Наложение линии на видео')).toContain('панель');
    expect(rowValue(csv, 'Съёмка: параметры')).toContain('камера 1.2 м');
    expect(csv).toContain('слева');
    expect(csv).toContain('телефон');
    expect(rowValue(csv, 'Масштаб калибровки кадра, px/см')).toBe('"—"');
  });

  it('ракурс по замеру: горизонтальный ход и вердикт идут в отчёт', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    // Масштаб 1: файл уже в сантиметрах после детекта мм — цифры ракурса читаемые.
    const csv = await exportCsv({ capture: { side: 'left' } }, rows.join('\n'), '1');
    // 2.85 см горизонтали на 7.6 см хода = 37.5% — отчёт называет и число, и обе версии.
    expect(rowValue(csv, 'Горизонтальный ход штанги, % хода')).toBe('"37.5"');
    const verdict = rowValue(csv, 'Проверка ракурса');
    expect(verdict).toContain('по горизонтали');
    expect(verdict).toContain('не различить');
    expect(verdict).toContain('«спереди/сбоку»');
  });

  it('мало точек: ракурс не выдумывается, в отчёте «—»', async () => {
    const csv = await exportCsv({});
    expect(rowValue(csv, 'Проверка ракурса')).toBe('"—"');
    expect(rowValue(csv, 'Горизонтальный ход штанги, % хода')).toBe('"—"');
  });

  it('экран и отчёт не расходятся: числа хаба совпадают с CSV', async () => {    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    localStorage.setItem(MASTER_KEY, JSON.stringify({
      lift: 'bench',
      videoPersp: { bench: { anchors: ANCHORS, vA: -8, vB: 520, vC: 0.004, fitPx: 0.1, frameW: 1280, frameH: 720 } },
      capture: { side: 'left', heightM: '1.2', distM: '3', device: 'phone' },
    }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: rows.join('\n') } });
    });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });

    const num = (el: Element | null, what: string): string => {
      const m = /(\d+(?:\.\d+)?)\s*%/.exec(el?.textContent ?? '');
      expect(m, `${what}: число в тексте «${el?.textContent}»`).toBeTruthy();
      return m![1];
    };
    const screenDrift = num(container.querySelector('[data-lift="angle-drift"]'), 'ход штанги на экране');
    const screenSkew = num(container.querySelector('[data-lift="angle-skew"]'), 'разброс масштаба на экране');
    const perspState = container.querySelector('[data-lift="video-persp-state"]')!.textContent ?? '';
    expect(perspState).toContain(`разброс масштаба ${screenSkew}%`);
    const msg = container.querySelector('[data-lift="kinovea-msg"]')!.textContent ?? '';
    const xLoop = /xLoop ([\d.]+) см/.exec(msg)?.[1];
    expect(xLoop, `xLoop в сообщении разбора: «${msg}»`).toBeTruthy();

    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-csv"]')!); });
    expect(savedCsv.length).toBe(1);
    const csv = savedCsv[0];
    expect(rowValue(csv, 'Горизонтальный ход штанги, % хода')).toBe(`"${screenDrift}"`);
    expect(rowValue(csv, 'Разброс масштаба по высоте, %')).toBe(`"${screenSkew}"`);
    expect(rowValue(csv, 'Kinovea xLoop, см')).toBe(`"${xLoop}"`);
    // Ракурс задан, но разброс масштаба 31% важнее хода — вердикт про перспективу.
    expect(rowValue(csv, 'Проверка ракурса')).toContain('перспективу по 4 кадрам');
    expect(rowValue(csv, 'Проверка ракурса')).not.toContain('не указан');
  });

  it('вид спереди: метрика подписана «боковой уход», вердикт — про технику', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    const csv = await exportCsv({ capture: { side: 'front' } }, rows.join('\n'), '1');
    expect(rowValue(csv, 'Боковой уход штанги, % хода')).toBe('"37.5"');
    // Старой подписи быть не должно: иначе цифру прочтут как путь вглубь кадра.
    expect(csv).not.toContain('"Горизонтальный ход штанги, % хода"');
    expect(rowValue(csv, 'Проверка ракурса')).toContain('сигнал техники');
  });

  it('SVG-картинка несёт строку ракурса: её пересылают отдельно от отчёта', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', capture: { side: 'left' } }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: rows.join('\n') } });
    });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-svg"]')!); });

    expect(savedText.length).toBe(1);
    const svg = savedText[0].text;
    expect(savedText[0].name).toMatch(/\.svg$/);
    expect(svg).toContain('ход 37.5%');
    // Та же оговорка, что в отчёте: цифра без неё читается как приговор технике.
    expect(svg).toContain('либо техника, либо камера не под 90°');
    // Кириллица в SVG не экранируется в мусор.
    expect(svg).not.toContain('&amp;amp;');
  });

  it('SVG при виде спереди: боковой ход как техника, без подсказки про камеру', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', capture: { side: 'front' } }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: rows.join('\n') } });
    });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-svg"]')!); });

    const svg = savedText[0].text;
    expect(svg).toContain('боковой ход штанги (техника)');
    expect(svg).not.toContain('не под 90°');
  });
});

describe('хаб → отчёт: сравнение с прошлой сессией', () => {
  /** CSV с достаточным числом точек: из четырёх строк повтор не сегментируется. */
  const rows = (() => {
    const out = ['time,x,y'];
    for (let i = 0; i < 20; i++) out.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    return out.join('\n');
  })();
  /** Прошлая сессия снята под 8°, текущая — под 25°: xLoop сравнивать нельзя, vmax можно. */
  const past = {
    series: {
      bench: {
        savedAt: Date.UTC(2026, 9, 28),
        weightKg: 100,
        reps: [{ index: 1, vmax: 0.52, xLoop: 2.1, amplitude: 40, points: [[0, 0], [0.5, 10], [1, 20]], cosPhi: 0.99, angleDeg: 8 }],
      },
    },
  };
  const now = {
    vbtWeight: '95',
    refAngle: { bench: { azimuthDeg: 25, ratio: 0.906, cosPhi: 0.906, lengthCm: 131, atSec: null, spanPx: 300 } },
  };

  it('дельта vmax и xLoop — числами, оговорки про вес и ракурс — рядом с ними', async () => {
    const csv = await exportCsv({ ...past, ...now }, rows, '1');
    expect(rowValue(csv, 'Δvmax к прошлой сессии, %')).toMatch(/^"-?\d+"$/);
    expect(rowValue(csv, 'ΔxLoop к прошлой сессии, см')).toMatch(/^"-?\d+(\.\d)?"$/);
    // Поправка на ракурс — отдельной строкой: измеренное не подменяется оценкой.
    expect(rowValue(csv, 'ΔxLoop к прошлой сессии с поправкой на ракурс, см')).toMatch(/^"-?\d+(\.\d)?"$/);
    const note = rowValue(csv, 'Сравнение сессий');
    expect(note).toContain('прошлая сессия 28.10.2026');
    expect(note).toContain('вес 100 → 95');
    expect(note).toContain('ракурс 8° → 25°');
  });

  it('равный вес и один ракурс — без ложных оговорок', async () => {
    savedCsv.length = 0;
    const same = await exportCsv({
      series: { bench: { ...past.series.bench, weightKg: 95, reps: [{ ...past.series.bench.reps[0], cosPhi: 0.906, angleDeg: 25 }] } },
      ...now,
    }, rows, '1');
    expect(rowValue(same, 'Δvmax к прошлой сессии, %')).toMatch(/^"-?\d+"$/);
    const note = rowValue(same, 'Сравнение сессий');
    expect(note).not.toContain('вес');
    expect(note).not.toContain('ракурс');
  });

  it('SVG-картинка несёт оговорку: её пересылают отдельно от отчёта', async () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', ...past, ...now }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: rows } });
      fireEvent.change(container.querySelector('[data-lift="kinovea-scale"]')!, { target: { value: '1' } });
    });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-svg"]')!); });

    expect(savedText.length).toBe(1);
    expect(savedText[0].name).toMatch(/\.svg$/);
    // Подписи разбиты на строки по ширине картинки — сверяем текст без разметки.
    const flat = savedText[0].text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    expect(flat).toContain('вес 100 → 95');
    expect(flat).toMatch(/ракурс 8°\s+→\s+25°/);
    expect(flat).toContain('с поправкой');
  });

  it('без прошлой сессии — прочерки, а не нулевая дельта', async () => {
    const csv = await exportCsv({}, rows, '1');
    expect(rowValue(csv, 'Δvmax к прошлой сессии, %')).toBe('"—"');
    expect(rowValue(csv, 'ΔxLoop к прошлой сессии, см')).toBe('"—"');
    expect(rowValue(csv, 'Сравнение сессий')).toBe('"—"');
  });

  it('HTML несёт ту же оговорку, что и CSV: дельта без неё читается как прогресс техники', async () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', ...past, ...now }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: rows } });
      fireEvent.change(container.querySelector('[data-lift="kinovea-scale"]')!, { target: { value: '1' } });
    });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-html"]')!); });

    expect(savedHtml.length).toBe(1);
    expect(savedHtml[0]).toContain('Сравнение с прошлой сессией');
    expect(savedHtml[0]).toContain('вес 100 → 95');
    expect(savedHtml[0]).toContain('ракурс 8° → 25°');
    expect(savedHtml[0]).toContain('(оценка)');
  });
});

describe('хаб → отчёт: ракурс, измеренный по эталону в кадре', () => {
  const refSeed = {
    refAngle: { bench: { azimuthDeg: 12, ratio: 0.978, lengthCm: 131, atSec: 2.5 } },
    refLengthCm: '131',
  };

  it('угол и длина эталона — отдельные строки CSV, а не только текст вердикта', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    const csv = await exportCsv(refSeed, rows.join('\n'), '1');
    expect(rowValue(csv, 'Угол камеры по эталону, °')).toBe('"12"');
    expect(rowValue(csv, 'Эталон в кадре, см')).toBe('"131"');
    // Вердикт несёт оговорку «это замер», а не «кажется, сбоку».
    expect(rowValue(csv, 'Проверка ракурса')).toContain('измерен по эталону');
    expect(rowValue(csv, 'Проверка ракурса')).toContain('слева/справа');
  });

  it('без эталона строки честно пустые — «—», а не выдуманный 0°', async () => {
    const csv = await exportCsv({}, CSV_POINTS);
    expect(rowValue(csv, 'Угол камеры по эталону, °')).toBe('"—"');
    expect(rowValue(csv, 'Эталон в кадре, см')).toBe('"—"');
    expect(rowValue(csv, 'xLoop с поправкой на ракурс, см')).toBe('"—"');
    expect(rowValue(csv, 'Поправка xLoop на ракурс, %')).toBe('"—"');
  });

  it('поправка xLoop на ракурс — отдельные числа, замер остаётся рядом', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    const csv = await exportCsv({
      refAngle: { bench: { azimuthDeg: 25, ratio: 0.906, lengthCm: 131, atSec: 2.5, spanPx: 300 } },
      refLengthCm: '131',
    }, rows.join('\n'), '1');
    // cos 25° = 0.906 → поправка +10.4%: число, а не текст «примерно».
    expect(rowValue(csv, 'Поправка xLoop на ракурс, %')).toBe('"10.4"');
    expect(rowValue(csv, 'xLoop с поправкой на ракурс, см')).toMatch(/^"\d+(\.\d+)?"$/);
    // Измеренный xLoop никуда не делся: поправка — дополнение, а не подмена.
    expect(rowValue(csv, 'Kinovea xLoop, см')).not.toBe('"—"');
  });

  it('ось эталона уходит в отчёт — без неё угол не воспроизвести', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    const along = await exportCsv({
      refAngle: { bench: { azimuthDeg: 30, ratio: 0.5, cosPhi: 0.866, axis: 'along', lengthCm: 131, atSec: null, spanPx: 300 } },
      refLengthCm: '131',
    }, rows.join('\n'), '1');
    expect(rowValue(along, 'Эталон: ось')).toBe('"вдоль штанги"');
    // Поправка на ракурс считается по cos φ, поэтому +15.5%, а не +100% по ratio.
    expect(rowValue(along, 'Поправка xLoop на ракурс, %')).toBe('"15.5"');

    savedCsv.length = 0;
    const across = await exportCsv({
      refAngle: { bench: { azimuthDeg: 30, ratio: 0.866, cosPhi: 0.866, axis: 'across', lengthCm: 120, atSec: null, spanPx: 300 } },
      refLengthCm: '120',
    }, rows.join('\n'), '1');
    expect(rowValue(across, 'Эталон: ось')).toBe('"поперёк движения"');
    expect(rowValue(across, 'Поправка xLoop на ракурс, %')).toBe('"15.5"');
  });

  it('спор «параметры ↔ замер» в отчёте не прячется', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    // Параметры говорят «спереди», замер — 8°: в отчёте иначе стоит и «грубо», и «сравнимо».
    const csv = await exportCsv({
      capture: { side: 'front' },
      refAngle: { bench: { azimuthDeg: 8, ratio: 0.99, lengthCm: 131, atSec: null, spanPx: 300 } },
    }, rows.join('\n'), '1');
    const row = rowValue(csv, 'Ракурс: параметры и замер');
    expect(row).toContain('противоречит параметрам');
    expect(row).toContain('камера в плоскости движения (8°)');
    expect(row).toContain('бракует xLoop');

    // Стороны согласны — строки нет, чтобы отчёт не пугал зря.
    savedCsv.length = 0;
    const clean = await exportCsv({
      capture: { side: 'left' },
      refAngle: { bench: { azimuthDeg: 8, ratio: 0.99, lengthCm: 131, atSec: null, spanPx: 300 } },
    }, rows.join('\n'), '1');
    expect(rowValue(clean, 'Ракурс: параметры и замер')).toBe('"—"');
  });

  it('поправка меньше точности тапа — в отчёт не идёт как число', async () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    // ratio 0.99 (8°), но эталон 40 px: ±5.3% точности больше самой поправки.
    const csv = await exportCsv({
      refAngle: { bench: { azimuthDeg: 8, ratio: 0.99, lengthCm: 131, atSec: null, spanPx: 40 } },
    }, rows.join('\n'), '1');
    expect(rowValue(csv, 'Поправка xLoop на ракурс, %')).toBe('"—"');
    expect(rowValue(csv, 'xLoop с поправкой на ракурс, см')).toBe('"—"');
    // Сам замер ракурса при этом на месте — отброшена только поправка.
    expect(rowValue(csv, 'Угол камеры по эталону, °')).toBe('"8"');
  });

  it('HTML-отчёт объясняет замер: угол и по какому эталону он снят', async () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', ...refSeed }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: CSV_POINTS } });
    });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-html"]')!); });

    expect(savedHtml.length).toBe(1);
    expect(savedHtml[0]).toContain('Угол камеры по эталону');
    expect(savedHtml[0]).toContain('12° от плоскости движения');
    expect(savedHtml[0]).toContain('эталон 131 см');
    // Поправка горизонтали — с оговоркой, что это оценка, а не новая правда.
    expect(savedHtml[0]).toContain('xLoop с поправкой на ракурс');
    expect(savedHtml[0]).toContain('не замена съёмке в плоскости движения');
  });
});

/**
 * Волна 28: «куда ушла штанга», «проверен ли угол» и «сколько горизонтали съел
 * ракурс». Три вопроса, на которые отчёт раньше отвечал цифрой без слов.
 */
describe('хаб → отчёт: направление ухода, сверка эталонов, модель поворота', () => {
  /** 20 точек с уходом вбок: из четырёх строк повтор не сегментируется. */
  const rows20 = () => {
    const rows = ['time,x,y'];
    for (let i = 0; i < 20; i++) rows.push(`${(i * 0.05).toFixed(2)},${100 + i * 1.5},${50 + i * 4}`);
    return rows.join('\n');
  };

  it('направление ухода: знак x переводится в «к голове» по стороне съёмки', async () => {
    const csv = await exportCsv({ capture: { side: 'left' } }, rows20(), '1');
    expect(rowValue(csv, 'Направление ухода')).toContain('к голове');
    // Это вывод из параметров, а не измерение: оговорка едет вместе со словом.
    expect(rowValue(csv, 'Направление ухода')).toContain('по параметрам съёмки');
  });

  it('жим с камерой справа: тот же кадр читается наоборот', async () => {
    const csv = await exportCsv({ capture: { side: 'right' } }, rows20(), '1');
    expect(rowValue(csv, 'Направление ухода')).toContain('к ногам');
  });

  it('вид спереди: направление не названо, а не выдумано', async () => {
    const csv = await exportCsv({ capture: { side: 'front' } }, rows20(), '1');
    expect(rowValue(csv, 'Направление ухода')).toBe('"—"');
  });

  it('сверка вторым эталоном: подтверждённый угол отличается от одиночного', async () => {
    const checked = await exportCsv({
      refAngle: { bench: { azimuthDeg: 25, ratio: 0.906, cosPhi: 0.906, lengthCm: 131, atSec: null, spanPx: 300, checked: 'both', crossDevPct: 1.2 } },
      refLengthCm: '131',
    }, rows20(), '1');
    expect(rowValue(checked, 'Эталоны: сверка')).toContain('подтверждён вторым эталоном');
    expect(rowValue(checked, 'Эталоны: сверка')).toContain('1.2');

    savedCsv.length = 0;
    const single = await exportCsv({
      refAngle: { bench: { azimuthDeg: 25, ratio: 0.906, cosPhi: 0.906, lengthCm: 131, atSec: null, spanPx: 300 } },
      refLengthCm: '131',
    }, rows20(), '1');
    expect(rowValue(single, 'Эталоны: сверка')).toContain('проверен один эталон');
  });

  it('модель поворота: включается кнопкой и растягивает горизонталь, а не измерение', async () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({
      lift: 'bench',
      refAngle: { bench: { azimuthDeg: 25, ratio: 0.906, cosPhi: 0.906, lengthCm: 131, atSec: null, spanPx: 300 } },
    }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: rows20() } });
    });
    act(() => { fireEvent.change(container.querySelector('[data-lift="kinovea-scale"]')!, { target: { value: '1' } }); });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });
    // Без включённой модели строка честно пустая.
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-csv"]')!); });
    expect(rowValue(savedCsv[0], 'Модель поворота')).toBe('"—"');

    act(() => { fireEvent.click(container.querySelector('[data-lift="export-model"]')!); });
    savedCsv.length = 0;
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-csv"]')!); });
    const note = rowValue(savedCsv[0], 'Модель поворота');
    // 1 / cos 25° = 1.10 — модель названа моделью, а не «уточнённым xLoop».
    expect(note).toContain('×1.10');
    expect(note).toContain('не второй замер');
    // Измеренный xLoop остаётся измеренным.
    expect(rowValue(savedCsv[0], 'Kinovea xLoop, см')).not.toContain('Модель');
  });

  it('SVG: модель — пунктиром, подпись говорит «пересчёт»', async () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({
      lift: 'bench',
      refAngle: { bench: { azimuthDeg: 25, ratio: 0.906, cosPhi: 0.906, lengthCm: 131, atSec: null, spanPx: 300 } },
    }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: rows20() } });
    });
    act(() => { fireEvent.change(container.querySelector('[data-lift="kinovea-scale"]')!, { target: { value: '1' } }); });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });
    act(() => { fireEvent.click(container.querySelector('[data-lift="export-model"]')!); });
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-svg"]')!); });

    const svg = savedText[0].text;
    expect(svg).toContain('stroke="#4ade80"');
    expect(svg).toContain('модель: камера в плоскости');
    expect(svg).toContain('Модель поворота');
    // Подпись переносится по словам, поэтому проверяем смысл, а не всю фразу целиком.
    expect(svg).toContain('пересчёт измеренного пути');
  });

  it('без измеренного угла модель не включается: растягивать нечего', async () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench' }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    act(() => {
      fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: rows20() } });
    });
    act(() => { fireEvent.click(container.querySelector('[data-lift="parse-kinovea"]')!); });
    act(() => { fireEvent.click(container.querySelector('[data-lift="export-model"]')!); });
    const btn = container.querySelector('[data-lift="export-model"]')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    await act(async () => { fireEvent.click(container.querySelector('[data-lift="export-csv"]')!); });
    expect(rowValue(savedCsv[0], 'Модель поворота')).toBe('"—"');
  });
});

