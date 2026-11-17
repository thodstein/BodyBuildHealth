/**
 * use-diary-day.test.tsx — дневник не должен «застревать» на вчерашней дате.
 *
 * Жалоба: «Питание — дневник — цифры не обновляются каждый день». Кроме
 * UTC-даты, `selectedDate` фиксировался при монтировании: приложение жило
 * открытым через полночь и дневник продолжал показывать прошлый день.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiaryDay } from '../useDiaryDay';

const opts = { diaryData: {} as Record<string, any>, refreshKey: 0 };

describe('useDiaryDay: смена дня', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('по умолчанию открыт сегодняшний день', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 21, 0));
    const { result } = renderHook(() => useDiaryDay(opts));
    expect(result.current.selectedDate).toBe('2026-11-17');
  });

  it('после полуночи дневник сам переходит на новый день', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 23, 59));
    const { result } = renderHook(() => useDiaryDay(opts));
    expect(result.current.selectedDate).toBe('2026-11-17');

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 18, 0, 0, 30));
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.selectedDate).toBe('2026-11-18');
  });

  it('день, выбранный вручную, не перебивается полуночью', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 10, 0));
    const { result } = renderHook(() => useDiaryDay(opts));
    act(() => {
      result.current.setSelectedDate('2026-11-14');
    });
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 18, 0, 0, 30));
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.selectedDate).toBe('2026-11-14');
  });
});
