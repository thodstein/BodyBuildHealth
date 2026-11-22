/**
 * session-cooldown-cta.test.tsx — выход к итогам из заминки.
 *
 * После «⏹ Завершить» плеер уходит в заминку, а единственный выход к отчёту
 * был в самом низу списка блоков заминки. Теперь главный шаг стоит под
 * прогрессом (data-act="cooldown-to-done").
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';

const days: PlayerDay[] = [
  {
    label: 'День 1 · Грудь',
    exercises: [{ name: 'Жим лёжа', muscleGroup: 'chest', targetSets: [{ weight: 80, reps: 8, rir: 2 }], restSec: 90 }],
  },
];

const byText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').includes(text)) as
    HTMLButtonElement | undefined;

describe('SessionPlayer: заминка → итоги', () => {
  beforeEach(() => {
    localStorage.clear();
    window.confirm = () => true;
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('в заминке есть кнопка к итогам, и она ведёт на отчёт', () => {
    const { container } = render(<SessionPlayer days={days} weekNumber={1} focus="Грудь" />);

    const start = byText(container, 'Начать тренировку');
    expect(start).toBeTruthy();
    act(() => {
      fireEvent.click(start!);
    });

    // Плеер стартует с разминки — к основной части ведёт её же CTA.
    const toMain = container.querySelector('[data-act="warmup-to-main"]') as HTMLElement | null;
    expect(toMain).not.toBeNull();
    act(() => {
      fireEvent.click(toMain!);
    });

    // Завершить сессию без единого подхода нельзя: пустая сессия не пишется в историю и
    // сразу уходит в «не сохранено» (done-empty), минуя заминку. Поэтому сначала пишем подход.
    const okBtn = byText(container, 'OK');
    expect(okBtn).toBeTruthy();
    act(() => {
      fireEvent.click(okBtn!);
    });

    const finishBtn = byText(container, 'Завершить');
    expect(finishBtn).toBeTruthy();
    act(() => {
      fireEvent.click(finishBtn!);
    });

    const cta = container.querySelector('[data-act="cooldown-to-done"]') as HTMLElement | null;
    expect(cta).not.toBeNull();

    act(() => {
      fireEvent.click(cta!);
    });

    expect(container.querySelector('[data-act="cooldown-to-done"]')).toBeNull();
    expect(container.querySelector('[data-act="session-done-close"]')).not.toBeNull();
    expect(container.textContent).toContain('Тренировка завершена');
  });
});
