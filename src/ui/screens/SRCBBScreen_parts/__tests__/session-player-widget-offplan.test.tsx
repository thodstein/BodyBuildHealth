/**
 * session-player-widget-offplan.test.tsx — открытый плеер единственный писатель
 * активной сессии:
 *  1. «✓ Завершить тренировку» при записанных и ещё не сохранённых подходах
 *     спрашивает подтверждение, а не завершает сессию с первого тапа;
 *  2. подход с виджета по упражнению вне плана дня не теряется: упражнение
 *     добавляется в живую сессию, подход записывается, handled = true.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';
import { StrengthDiary } from '../../../../engines/strength-diary.engine';
import { loadActiveSession } from '../../../../engines/workout-logger.engine';

const btn = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => (b.textContent || '').includes(text)) as
    HTMLButtonElement | undefined;

const plannedDay = (): PlayerDay => ({
  label: 'День 1 · жим',
  exercises: [
    {
      name: 'Жим штанги лёжа',
      muscleGroup: 'chest',
      restSec: 90,
      targetSets: [
        { weight: 80, reps: 8, rir: 2 },
        { weight: 82.5, reps: 8, rir: 2 },
      ],
    },
  ],
});

function startMain(container: HTMLElement) {
  fireEvent.click(btn(container, 'Начать тренировку')!);
  fireEvent.click(btn(container, 'К основной части')!);
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(StrengthDiary.prototype, 'getLastSession').mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SessionPlayer — «✓ Завершить тренировку» спрашивает подтверждение', () => {
  it('при записанном подходе показывает диалог и не стирает незавершённую сессию', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);

    fireEvent.click(container.querySelector('[data-act="finish-session"]') as HTMLElement);

    expect(container.querySelector('[data-session="exit-confirm"]')).toBeTruthy();
    // Сессия не завершена: подходы остаются в активной сессии, дописать их можно.
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);
    unmount();
  });
});

describe('SessionPlayer — подход из виджета по упражнению вне плана дня', () => {
  it('упражнение добавляется в живую сессию, подход записывается, handled = true', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);

    const detail: { exerciseName: string; weight: number; reps: number; rir: number; handled: boolean } = {
      exerciseName: 'Упражнение вне плана',
      weight: 40,
      reps: 10,
      rir: 2,
      handled: false,
    };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail }));
    });

    expect(detail.handled).toBe(true);
    const active = loadActiveSession();
    const offPlan = active?.exercises.find((e) => e.exerciseName === 'Упражнение вне плана');
    expect(offPlan?.sets?.length).toBe(1);
    expect(offPlan?.sets?.[0]?.weightKg).toBe(40);
    expect(offPlan?.sets?.[0]?.reps).toBe(10);
    unmount();
  });
});
