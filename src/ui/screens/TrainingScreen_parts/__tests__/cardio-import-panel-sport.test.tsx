/**
 * cardio-import-panel-sport.test.tsx — сквозной: панель импорта НЕ теряет
 * дисциплину и provenance (P2-аудит, «мост в никуда»).
 *
 * Реальный дефект: панель собирала запись руками и не переносила `sport`/`source`
 * из результата парсера. Импорт велосипеда сохранялся как 'run' (спринт 5 —
 * дисциплина и чип «Импорт» были мертвы на последней миле).
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CardioImportPanel } from '../CardioImportPanel';
import { loadCardioLog } from '../../../../engines/lms/cardio-diary.engine';

beforeEach(() => localStorage.clear());

/**
 * Минимальный валидный CSV: 2 сессии, колонка активности = Bike.
 * Именно `activity` (а НЕ `type`) задаёт и тип, и sport — иначе findCol берёт
 * первую подходящую колонку и sport схлопывается в 'run'.
 */
const CSV = [
  'date,duration,distance,hr,activity',
  '2026-09-18,45,12.5,138,Bike',
  '2026-09-19,30,8.0,142,Bike',
].join('\n');

const feed = async () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  // Панели нужен только { name, text() } — подставляем минимальный объект,
  // потому что File.text() в jsdom этой версии ненадёжен.
  const fake = { name: 'strava.csv', text: async () => CSV, arrayBuffer: async () => new ArrayBuffer(0) };
  Object.defineProperty(input, 'files', { value: [fake], configurable: true });
  fireEvent.change(input);
  await waitFor(() => expect(screen.getByText(/проверьте превью/)).toBeTruthy());
};

describe('Панель импорта: дисциплина и provenance доходят до журнала', () => {
  it('импорт 2 сессий: sport=bike И source=import у обеих записей', async () => {
    render(<CardioImportPanel />);
    await feed();
    // Кнопка «Импортировать всё» для нескольких сессий.
    const saveAll = Array.from(document.querySelectorAll('button'))
      .find(b => /Импортировать \d+ записей/.test(b.textContent ?? ''));
    expect(saveAll).toBeTruthy();
    fireEvent.click(saveAll!);

    const log = loadCardioLog();
    expect(log).toHaveLength(2);
    expect(log.every(e => e.sport === 'bike')).toBe(true);      // дефект был: 'run'
    expect(log.every(e => e.source === 'import')).toBe(true);   // дефект был: 'manual'
    expect(log.every(e => typeof e.updatedAt === 'string')).toBe(true);
  });

  it('атомарно: 2 записи = 1 запись в localStorage (не N)', async () => {
    const inst = window.localStorage as unknown as { setItem: (k: string, v: string) => void };
    const spy = vi.spyOn(inst, 'setItem');
    render(<CardioImportPanel />);
    await feed();
    const saveAll = Array.from(document.querySelectorAll('button'))
      .find(b => /Импортировать \d+ записей/.test(b.textContent ?? ''));
    fireEvent.click(saveAll!);
    const writes = spy.mock.calls.filter(c => c[0] === 'he_cardio_sessions');
    expect(writes).toHaveLength(1);
    spy.mockRestore();
  });

  it('импорт НЕ затирает уже записанную вручную сессию', async () => {
    window.localStorage.setItem('he_cardio_sessions', JSON.stringify([{
      id: 'manual-1', date: '2026-09-01', type: 'zone2', durationMin: 30, completed: true, source: 'manual',
    }]));
    render(<CardioImportPanel />);
    await feed();
    const saveAll = Array.from(document.querySelectorAll('button'))
      .find(b => /Импортировать \d+ записей/.test(b.textContent ?? ''));
    fireEvent.click(saveAll!);

    const log = loadCardioLog();
    expect(log).toHaveLength(3);
    expect(log.find(e => e.id === 'manual-1')?.source).toBe('manual');
  });
});
