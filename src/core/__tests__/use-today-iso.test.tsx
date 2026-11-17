/**
 * use-today-iso.test.tsx — «сегодня» должно переключаться само.
 *
 * Жалоба: «На главной питании цифры питания не обновляются каждый день».
 * Причина была в том, что дата считалась один раз (к тому же по UTC) и экран
 * оставался на вчерашнем дне до перезапуска приложения.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodayIso } from '../use-today-iso';

describe('useTodayIso', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('отдаёт локальную дату и переключается после полуночи', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 23, 59, 30));
    const { result } = renderHook(() => useTodayIso());
    expect(result.current).toBe('2026-11-17');

    act(() => {
      vi.setSystemTime(new Date(2026, 11, 18, 0, 0, 30));
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('2026-12-18');
  });

  it('перечитывает дату при возврате в приложение', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 12, 0, 0));
    const { result } = renderHook(() => useTodayIso());
    expect(result.current).toBe('2026-11-17');

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 25, 12, 0, 0));
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe('2026-11-25');
  });

  it('ЛОКАЛЬНАЯ дата, а не UTC (граница суток не съезжает)', () => {
    const offsetMinutes = new Date().getTimezoneOffset();
    // Восточнее UTC расходится раннее утро (UTC ещё вчера), западнее — поздний
    // вечер (UTC уже завтра). При offset = 0 проверять нечего.
    const probe = offsetMinutes < 0
      ? new Date(2026, 10, 17, 1, 0)     // UTC+ : в UTC это 16-е
      : offsetMinutes > 0
        ? new Date(2026, 10, 17, 23, 30) // UTC- : в UTC это 18-е
        : null;
    if (!probe) return;

    vi.useFakeTimers();
    vi.setSystemTime(probe);
    const { result } = renderHook(() => useTodayIso());
    expect(result.current).toBe('2026-11-17');
    expect(probe.toISOString().slice(0, 10)).not.toBe('2026-11-17');
  });
});
