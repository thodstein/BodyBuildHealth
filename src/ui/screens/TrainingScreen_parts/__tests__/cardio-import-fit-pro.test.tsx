/**
 * cardio-import-fit-pro.test.tsx — PRO-разбор FIT: посекундные записи часов
 * наконец доезжают до поверхности (P2-аудит: импорт шёл через общий
 * `parseCardioImport`, который отбрасывает records, и движки
 * `fitDecoupling`/`fitHrZoneHistogram`/`fitSecondHalfDrop` были без UI).
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fitResult = {
  format: 'fit',
  entries: [{ id: 'f1', date: '2026-10-01', type: 'zone2' as const, durationMin: 60, avgHr: 145, sport: 'bike' as const, completed: true, source: 'import' as const }],
  warnings: [],
};
// 100 посекундных записей: HR 120..159 по кругу, мощность 180..199.
const records = Array.from({ length: 100 }, (_, i) => ({ hr: 120 + (i % 40), powerWatts: 180 + (i % 20) }));

vi.mock('../../../../engines/cardio-import.engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../engines/cardio-import.engine')>();
  return {
    ...actual,
    parseCardioFitRecords: vi.fn(() => ({ result: fitResult, records })),
  };
});

const { CardioImportPanel } = await import('../CardioImportPanel');
const { buildCardioCycle } = await import('../../../../engines/lms/cardio.engine');

beforeEach(() => localStorage.clear());

/** Подача .fit-файла с минимальным фейком (jsdom File.text() ненадёжен). */
const feedFit = async () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const fake = { name: 'ride.fit', text: async () => '', arrayBuffer: async () => new ArrayBuffer(16) };
  Object.defineProperty(input, 'files', { value: [fake], configurable: true });
  fireEvent.change(input);
  await waitFor(() => expect(screen.getByText(/проверьте превью/)).toBeTruthy());
};

describe('PRO-разбор FIT (records → зоны/decoupling/затухание)', () => {
  it('FIT: сводка импорта + PRO-блок с зонами и decoupling', async () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'fit-c', age: 30, restingHr: 60 });
    render(<CardioImportPanel cycle={c} />);
    await feedFit();
    const view = document.querySelector('[data-cardio="fit-analysis"]');
    expect(view).toBeTruthy();
    const text = view!.textContent ?? '';
    expect(text).toContain('PRO-разбор FIT');
    expect(text).toContain('100 записей');
    // HR 120..159 → Z1 18% (hr<138), Z2 20% (138..157), Z3 2% (158..159).
    expect(text).toContain('Z1 54%');
    expect(text).toContain('Z2 28%');
    expect(text).toContain('Z3 18%');
    // Мощность есть → decoupling по мощности.
    expect(text).toMatch(/Pa:HR decoupling -?\d/);
    expect(text).toContain('мощность/пульс');
    // Затухание второй половины.
    expect(text).toMatch(/Затухание/);
    // Флеш упоминает готовность PRO-разбора.
    expect(screen.getByText(/PRO-разбор FIT готов/)).toBeTruthy();
  });

  it('без зон в параметрах цикла — гистограмма честно не показывается', async () => {
    render(<CardioImportPanel cycle={null} />);
    await feedFit();
    const text = document.querySelector('[data-cardio="fit-analysis"]')!.textContent ?? '';
    expect(text).toContain('Зоны не заданы');
    expect(text).not.toContain('Z1 ');
  });

  it('не-FIT файл — PRO-блока нет (без записей не выдумываем)', async () => {
    render(<CardioImportPanel />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csv = 'date,duration,distance,hr,activity\n2026-09-18,45,12.5,138,Bike';
    const fake = { name: 's.csv', text: async () => csv, arrayBuffer: async () => new ArrayBuffer(0) };
    Object.defineProperty(input, 'files', { value: [fake], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByText(/проверьте превью/)).toBeTruthy());
    expect(document.querySelector('[data-cardio="fit-analysis"]')).toBeNull();
  });
});
