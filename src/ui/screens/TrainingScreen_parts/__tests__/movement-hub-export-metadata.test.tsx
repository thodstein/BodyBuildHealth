import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import React from 'react';

/**
 * Проводка «хаб → отчёт»: реальные APK-мосты недоступны в jsdom, поэтому
 * перехватываем сохранение и смотрим сам CSV. Так проверяется, что отчёт
 * объясняет, чем нанесена линия на видео (без этого его не воспроизвести).
 */
const { savedCsv } = vi.hoisted(() => ({ savedCsv: [] as string[] }));

vi.mock('../../../../core/apk-share', () => ({
  copyOrShareText: async () => 'saved',
  saveCsvApk: async (_name: string, csv: string) => { savedCsv.push(csv); return 'saved'; },
  printHtmlApk: async () => 'saved',
  saveTextFileApk: async () => 'saved',
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
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function exportCsv(seed: Record<string, unknown>): Promise<string> {
  localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', ...seed }));
  const { container } = render(<LiftMasterCard sessions={[]} />);
  act(() => {
    fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: CSV_POINTS } });
  });
  act(() => {
    fireEvent.change(container.querySelector('[data-lift="kinovea-scale"]')!, { target: { value: '0.01' } });
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
});
