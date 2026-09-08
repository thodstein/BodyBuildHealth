/**
 * diary-bulk.test.tsx — массовые кнопки дневника:
 * - стор всегда остаётся массивом (была пара кнопок, писавшая объект
 *   {...entries, [today]} и ронявшая весь дневник);
 * - «Сбросить все» гасит приём, но бережёт дозы/слоты/побочки и вещества
 *   вне плана (раньше выедал метаданные и удалял ручные записи);
 * - дублирующей пары кнопок нет (одна корректная).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupportDiaryView } from '../SupportDiaryView';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('diary bulk actions', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    localStorage.setItem('he_support_plan_result', JSON.stringify(['plan_a']));
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
  });

  function seedEntry(substances: Record<string, unknown>) {
    localStorage.setItem(
      'he_support_diary',
      JSON.stringify([{ date: todayStr(), substances }]),
    );
  }

  function readEntry(): { substances: Record<string, Record<string, unknown>> } {
    const raw = JSON.parse(localStorage.getItem('he_support_diary') || '[]');
    expect(Array.isArray(raw), 'store stays an array').toBe(true);
    return raw.find((e: { date: string }) => e.date === todayStr());
  }

  it('в storyboard одна пара массовых кнопок, без дублей-порчи', () => {
    seedEntry({ plan_a: { taken: false } });
    const { queryByText } = render(<SupportDiaryView s={{}} />);
    expect(queryByText('✅ Все приняты')).not.toBeNull();
    expect(queryByText('✕ Сбросить все')).not.toBeNull();
    expect(queryByText('✅ Принять всё')).toBeNull();
    expect(queryByText('✕ Очистить всё')).toBeNull();
  });

  it('«Все приняты» отмечает, стор остаётся массивом', () => {
    seedEntry({ plan_a: { taken: false, timeSlot: 'morning' } });
    const { getByText } = render(<SupportDiaryView s={{}} />);
    fireEvent.click(getByText('✅ Все приняты'));
    const entry = readEntry();
    expect(entry.substances.plan_a.taken).toBe(true);
    expect(entry.substances.plan_a.timeSlot).toBe('morning');
  });

  it('«Сбросить все» бережёт метаданные и ручные вещества', () => {
    seedEntry({
      plan_a: { taken: true, timeSlot: 'evening', dose: '100мг', sideEffects: ['Тошнота'] },
      custom_x: { taken: true },
    });
    const { getByText } = render(<SupportDiaryView s={{}} />);
    fireEvent.click(getByText('✕ Сбросить все'));
    const entry = readEntry();
    expect(entry.substances.plan_a.taken).toBe(false);
    expect(entry.substances.plan_a.timeSlot).toBe('evening');
    expect(entry.substances.plan_a.dose).toBe('100мг');
    expect(entry.substances.plan_a.sideEffects).toEqual(['Тошнота']);
    expect(entry.substances.custom_x, 'ручное вещество на месте').toBeTruthy();
    expect(entry.substances.custom_x.taken).toBe(false);
  });
});
