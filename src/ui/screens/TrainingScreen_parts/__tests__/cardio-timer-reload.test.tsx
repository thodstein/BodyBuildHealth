/**
 * cardio-timer-reload.test.tsx — идущая тренировка переживает перезагрузку.
 *
 * Аудит 2026-11 (пятый проход): на Android WebView может быть убит в фоне, а
 * `location.reload()` (и pull-to-refresh) уничтожали state таймера. Атлет
 * оставался без таймера и без записи в дневнике — сессия пропадала молча.
 * Теперь активная сессия снимается в localStorage и продолжается с того же
 * места: остаток считается по времени снимка (на паузе не тикает).
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioSessionTimer } from '../CardioSessionTimer';
import { buildCardioCycle, type CardioCycle } from '../../../../engines/lms/cardio.engine';
import { loadCardioLog } from '../../../../engines/lms/cardio-diary.engine';

const KEY = 'he_cardio_timer_active';
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Цикл, у которого сегодняшняя сессия — 30 мин Zone 2 (без структуры). */
function cycleToday(structured?: { workSec: number; restSec: number; reps: number }[], durationMin = 30): CardioCycle {
  const base = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'reload-1' });
  const dow = (new Date().getDay() + 6) % 7;
  const template = base.weeks[0].sessions[0];
  return {
    ...base,
    startDate: isoOf(new Date()),
    weeks: base.weeks.map((w, i) => i === 0 ? {
      ...w,
      sessions: [{ ...template, type: structured ? 'hiit' : 'zone2', durationMin, dayOfWeek: dow, weeklyFrequency: 1, structured }],
    } : w),
  };
}

const T0 = new Date('2026-11-05T10:00:00');

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CardioSessionTimer: сессия переживает перезагрузку', () => {
  it('остаток считается от снимка, а не начинается с нуля', () => {
    const c = cycleToday();
    const first = render(<CardioSessionTimer cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт Zone 2' }));
    expect(localStorage.getItem(KEY)).toBeTruthy();
    first.unmount();

    vi.setSystemTime(new Date('2026-11-05T10:05:00'));
    render(<CardioSessionTimer cycle={c} />);

    expect(screen.getByRole('timer').textContent).toBe('25:00');
    expect(screen.getByText(/восстановлена после перезагрузки/)).toBeTruthy();
  });

  it('на паузе простой не съедает время', () => {
    const c = cycleToday();
    const first = render(<CardioSessionTimer cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт Zone 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Пауза' }));
    first.unmount();

    vi.setSystemTime(new Date('2026-11-05T10:30:00'));
    render(<CardioSessionTimer cycle={c} />);

    expect(screen.getByRole('timer').textContent).toBe('30:00');
    expect(screen.getByRole('button', { name: 'Пауза' }).textContent).toMatch(/продолжить/i);
  });

  it('интервальный шаг не откатывается: снимок пишется на «Дальше»', () => {
    const c = cycleToday([{ workSec: 60, restSec: 30, reps: 2 }], 20);
    const first = render(<CardioSessionTimer cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт HIIT' }));
    const next = screen.getByRole('button', { name: 'Следующий шаг' });
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText('Отдых 1/2')).toBeTruthy();
    first.unmount();

    render(<CardioSessionTimer cycle={c} />);
    expect(screen.getByText('Отдых 1/2')).toBeTruthy();
  });

  it('вчерашняя сессия не воскрешается', () => {
    const c = cycleToday();
    const first = render(<CardioSessionTimer cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт Zone 2' }));
    first.unmount();

    vi.setSystemTime(new Date('2026-11-06T10:00:00'));
    render(<CardioSessionTimer cycle={c} />);

    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.queryByText(/восстановлена после перезагрузки/)).toBeNull();
  });

  it('завершённая, но не сохранённая сессия восстанавливается с фактом и вводом', () => {
    const c = cycleToday();
    const first = render(<CardioSessionTimer cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт Zone 2' }));
    fireEvent.click(screen.getByRole('button', { name: /завершить/i }));
    // Панель оценки: дисциплина и RPE введены, но в дневник не сохранено.
    fireEvent.click(screen.getByRole('button', { name: 'Дисциплина: велосипед' }));
    fireEvent.change(screen.getByLabelText('RPE'), { target: { value: '7' } });
    expect(localStorage.getItem(KEY)).toBeTruthy();
    first.unmount();

    vi.setSystemTime(new Date('2026-11-05T10:30:00'));
    render(<CardioSessionTimer cycle={c} />);

    expect(screen.getByText(/Завершённая сессия восстановлена/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Дисциплина: велосипед' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('RPE') as HTMLInputElement).value).toBe('7');
    // В дневник ничего не ушло само: запись только по кнопке.
    expect(loadCardioLog().length).toBe(0);
  });

  it('после «Сохранить в дневник» снимок стирается', () => {
    const c = cycleToday();
    render(<CardioSessionTimer cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт Zone 2' }));
    fireEvent.click(screen.getByRole('button', { name: /завершить/i }));
    fireEvent.click(screen.getByRole('button', { name: /сохранить в дневник/i }));
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadCardioLog().length).toBe(1);
  });

  it('после сохранения сессия в списке помечена «уже записано сегодня»', () => {
    const c = cycleToday();
    render(<CardioSessionTimer cycle={c} />);
    expect(screen.queryByText(/уже записано сегодня/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Старт Zone 2' }));
    fireEvent.click(screen.getByRole('button', { name: /завершить/i }));
    fireEvent.click(screen.getByRole('button', { name: /сохранить в дневник/i }));
    expect(screen.getByText(/уже записано сегодня/)).toBeTruthy();
    // aria-label не меняется (кнопка всё ещё «Старт Zone 2»), меняется подпись.
    expect(screen.getByRole('button', { name: 'Старт Zone 2' }).textContent).toContain('Ещё раз');
  });

  it('битый снимок не ломает экран', () => {
    localStorage.setItem(KEY, '{не json');
    const c = cycleToday();
    render(<CardioSessionTimer cycle={c} />);
    expect(screen.getByRole('button', { name: 'Старт Zone 2' })).toBeTruthy();
  });
});
