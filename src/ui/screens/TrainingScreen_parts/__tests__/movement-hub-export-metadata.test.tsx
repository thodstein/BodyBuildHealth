import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import React from 'react';

/**
 * Проводка «хаб → отчёт»: реальные APK-мосты недоступны в jsdom, поэтому
 * перехватываем сохранение и смотрим сам CSV. Так проверяется, что отчёт
 * объясняет, чем нанесена линия на видео (без этого его не воспроизвести).
 */
const { savedCsv, savedText } = vi.hoisted(() => ({
  savedCsv: [] as string[],
  savedText: [] as Array<{ name: string; text: string }>,
}));

vi.mock('../../../../core/apk-share', () => ({
  copyOrShareText: async () => 'saved',
  saveCsvApk: async (_name: string, csv: string) => { savedCsv.push(csv); return 'saved'; },
  printHtmlApk: async () => 'saved',
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
