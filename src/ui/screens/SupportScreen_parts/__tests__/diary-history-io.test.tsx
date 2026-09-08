/**
 * diary-history-io.test.ts — экспорт/импорт истории дневника:
 * - CSV по RFC 4180 (запятые/кавычки/переносы не рвут структуру) + BOM для Excel;
 * - валидация импорта (массив или {entries}, только корректные записи);
 * - импорт показывает инлайн-статус, а не блокирующий alert().
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { csvCell, validateDiaryImport, SupportDiaryView } from '../SupportDiaryView';

describe('diary history io helpers', () => {
  it('csvCell экранирует по RFC 4180', () => {
    expect(csvCell('simple')).toBe('simple');
    expect(csvCell(123)).toBe('123');
    expect(csvCell(null)).toBe('');
    expect(csvCell('пил, после еды')).toBe('"пил, после еды"');
    expect(csvCell('сказал "ок"')).toBe('"сказал ""ок"""');
    expect(csvCell('строка1\nстрока2')).toBe('"строка1\nстрока2"');
  });

  it('validateDiaryImport принимает массив и {entries}, режет мусор', () => {
    const good = { date: '2026-09-01', substances: { a: { taken: true } } };
    const badDate = { date: 'yesterday', substances: {} };
    const noSubs = { date: '2026-09-02' };
    expect(validateDiaryImport([good, badDate, noSubs, null, 42])).toEqual([good]);
    expect(validateDiaryImport({ entries: [good] })).toEqual([good]);
    expect(validateDiaryImport({})).toEqual([]);
    expect(validateDiaryImport(null)).toEqual([]);
    expect(validateDiaryImport('oops')).toEqual([]);
  });
});

describe('diary history import ui', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
  });

  function openHistoryTab() {
    const utils = render(<SupportDiaryView s={{}} />);
    fireEvent.click(utils.getByText('📊 История'));
    return utils;
  }

  it('валидный файл мержится и показывает инлайн-статус без alert', () => {
    const { container } = openHistoryTab();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input, 'file input').not.toBeNull();
    const file = new File(
      [JSON.stringify([{ date: '2026-09-01', substances: { plan_a: { taken: true } } }])],
      'diary.json',
      { type: 'application/json' },
    );
    fireEvent.change(input, { target: { files: [file] } });
    return waitFor(() => {
      expect(container.textContent).toContain('Импорт завершён');
      const stored = JSON.parse(localStorage.getItem('he_support_diary') || '[]');
      expect(stored.some((e: { date: string }) => e.date === '2026-09-01')).toBe(true);
    });
  });

  it('мусорный файл — inline-ошибка, стор цел', () => {
    const { container } = openHistoryTab();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not json at all'], 'bad.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    return waitFor(() => {
      expect(container.textContent).toContain('Ошибка чтения файла');
      expect(localStorage.getItem('he_support_diary') || '[]').toBe('[]');
    });
  });
});
