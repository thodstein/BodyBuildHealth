/**
 * lab-entry-date.test.tsx — проход 157: дата записи — дата бланка, а не момент ввода.
 *
 * Дата главнее порядка хранения (проход 151) и решает, какой бланк текущий
 * (проход 136). Каталог и расширенная панель сохраняли `new Date()`, поэтому
 * анализ, сданный месяц назад, вставал в «сегодня» и сдвигал динамику. Плюс
 * `toISOString()` — UTC: вечером в восточных поясах это соседняя дата.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LabsCatalogTab from '../screens/LabsScreen_parts/LabsCatalogTab';
import ExtendedLabsTab from '../screens/LabsScreen_parts/ExtendedLabsTab';
import { labEntryDate, todayLabDate } from '../screens/LabsScreen_parts/lab-entry-date';
import { db } from '../../core/db';

beforeEach(async () => {
  localStorage.clear();
  cleanup();
  await db.init();
  await db.clear('labs_log');
});

afterEach(() => cleanup());

const rows = () => db.getAll<any>('labs_log');
const saveButton = () => screen.getAllByRole('button').find(b => (b.textContent || '').includes('💾'))!;

describe('проход 157: одно правило даты', () => {
  it('сегодняшняя дата берётся из местного календаря, а не из UTC', () => {
    // 23:30 по местному времени: UTC уже может быть следующий или прошлый день.
    expect(todayLabDate(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02');
  });

  it('пустая дата означает «сегодня», выбранная — как есть', () => {
    const now = new Date(2026, 7, 15, 9, 0);
    expect(labEntryDate('', now)).toBe('2026-08-15');
    expect(labEntryDate('2026-08-15', now)).toBe('2026-08-15');
    // Не формат поля даты — не запись: подставляем сегодня, а не «15.08.2026».
    expect(labEntryDate('15.08.2026', now)).toBe('2026-08-15');
  });
});

describe('проход 157: каталог сохраняет дату бланка', () => {
  it('выбранная дата доезжает до записи', async () => {
    render(<LabsCatalogTab labs={[]} selectedPhase="baseline" onPhaseChange={() => {}} tick={0} />);
    fireEvent.change(screen.getByLabelText('Дата бланка'), { target: { value: '2026-08-15' } });
    fireEvent.change(screen.getByLabelText(/Феррит/i), { target: { value: '120' } });
    fireEvent.click(saveButton());
    await waitFor(async () => {
      const row = (await rows()).find(r => r.code === 'FERRITIN');
      expect(row?.date).toBe('2026-08-15');
    });
  });

  it('источник не подставляет дату сохранения', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen_parts/LabsCatalogTab.tsx'), 'utf8');
    expect(src).toContain('date: labEntryDate(entryDate),');
    expect(src).not.toContain('date: new Date().toISOString().split');
    expect(src).toContain('data-lab-entry-date');
  });
});

describe('проход 157: расширенная панель сохраняет дату бланка', () => {
  it('выбранная дата доезжает до записи', async () => {
    render(<ExtendedLabsTab labs={[]} selectedPhase="baseline" onPhaseChange={() => {}} tick={0} />);
    fireEvent.change(screen.getByLabelText('Дата бланка'), { target: { value: '2026-09-02' } });
    fireEvent.change(screen.getByLabelText(/АЛТ/i), { target: { value: '35' } });
    fireEvent.click(saveButton());
    await waitFor(async () => {
      const row = (await rows()).find(r => r.code === 'ALT');
      expect(row?.date).toBe('2026-09-02');
    });
  });

  it('источник не подставляет дату сохранения', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen_parts/ExtendedLabsTab.tsx'), 'utf8');
    expect(src).toContain('date: labEntryDate(entryDate),');
    expect(src).not.toContain('date: new Date().toISOString().split');
    expect(src).toContain('data-lab-entry-date');
  });
});
