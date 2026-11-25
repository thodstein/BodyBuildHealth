/**
 * session-player-save-honesty.test.tsx — плеер не выдаёт «сохранено», если запись в
 * дневник не легла:
 *  1. провал finishSessionWithSave при завершении оставляет живую сессию единственной
 *     копией тренировки и показывает баннер, а не уводит в «Итог»;
 *  2. провал архива прошлой тренировки при старте блокирует новую сессию: иначе
 *     автосейв пустой/новой сессии затёр бы записанные подходы.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';
import { StrengthDiary } from '../../../../engines/strength-diary.engine';
import {
  addExerciseToSession,
  loadActiveSession,
  logSet,
  saveActiveSession,
  startSession,
} from '../../../../engines/workout-logger.engine';

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

/** Квота на журнал тренировок: запись `he_workout_log_v2` бросает, остальные ключи пишутся. */
function failWorkoutLogWrites() {
  // Подмена `Storage.prototype` в jsdom НЕ срабатывает: setup.ts подменяет сам
  // `window.localStorage` объектом с собственными методами. Спай ставим на инстанс.
  const realSetItem = localStorage.setItem.bind(localStorage);
  vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
    if (key === 'he_workout_log_v2') {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    }
    realSetItem(key, value);
  });
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

describe('SessionPlayer — провал записи при завершении', () => {
  it('баннер + живая сессия остаётся, в журнал ничего не пишется', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);

    failWorkoutLogWrites();
    fireEvent.click(container.querySelector('[data-act="finish-session"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-act="exit-save"]') as HTMLElement);

    // Плеер не соврал: ошибка видна, а единственная копия тренировки — живая сессия.
    expect(container.querySelector('[data-session="save-error"]')).toBeTruthy();
    const active = loadActiveSession();
    expect(active).not.toBeNull();
    expect(active?.exercises?.[0]?.sets?.length).toBe(1);
    expect(localStorage.getItem('he_workout_log_v2')).toBeNull();
    unmount();
  });
});

describe('SessionPlayer — старт при провале архива прошлой тренировки', () => {
  it('новая сессия не стартует, живая сессия с подходами остаётся той же', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    // Живая сессия другого состава появилась уже после монтирования (виджет/другое окно):
    // поэтому кнопка старта — «Начать тренировку», а не «Продолжить тренировку».
    let stale = startSession('Ноги · присед', 1);
    stale = addExerciseToSession(stale, {
      id: 'Приседания со штангой',
      name: 'Приседания со штангой',
      pattern: 'legs',
      muscleGroup: 'legs',
    });
    const logged = logSet(stale, 0, { setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2, notes: '' });
    expect(logged.success).toBe(true);
    stale = logged.session;
    expect(saveActiveSession(stale, 3)).toBe(true);

    failWorkoutLogWrites();
    startMain(container);

    expect(container.querySelector('[data-session="save-error"]')).toBeTruthy();
    const active = loadActiveSession();
    expect(active?.sessionId).toBe(stale.sessionId);
    expect(active?.exercises?.[0]?.sets?.length).toBe(1);
    expect(localStorage.getItem('he_workout_log_v2')).toBeNull();
    unmount();
  });
});
