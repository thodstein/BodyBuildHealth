/**
 * training-diary-start.test.tsx — «Начать тренировку» из дневника.
 *
 * Дневник дергал onGoWorkout, а тот ставил только runtimeStarted. При
 * сохранённом плане ПЛ/ББ зона проведения рисует лишь карточку плана, поэтому
 * клик не запускал тренировку и человек оставался на свёрнутой карточке.
 * Теперь дневник шлёт he-workout-open — тот же путь, что виджеты.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { TrainingScreen } from '../screens/TrainingScreen';

const PL_RUNTIME = {
  focus: 'Грудь',
  week: 1,
  track: 'pl',
  days: [
    {
      label: 'День 1 · Грудь',
      exercises: [
        { name: 'Жим штанги лёжа', muscleGroup: 'chest', restSec: 90, targetSets: [{ weight: 80, reps: 8, rir: 2 }] },
      ],
    },
  ],
};

describe('TrainingScreen: старт тренировки из дневника', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('с планом ПЛ открывает проведение, а не оставляет карточку свёрнутой', async () => {
    localStorage.setItem('he_pl_runtime', JSON.stringify(PL_RUNTIME));
    const { container } = render(<TrainingScreen initialSubTab="diary" />);

    await waitFor(() => expect(container.querySelector('[data-act="diary-start"]')).not.toBeNull(), { timeout: 5000 });
    await act(async () => {
      fireEvent.click(container.querySelector('[data-act="diary-start"]') as HTMLElement);
    });

    await waitFor(() => expect(container.querySelector('.hub-exec')).not.toBeNull(), { timeout: 5000 });
    // data-act="session-start" — это и есть свёрнутая карточка плана.
    expect(container.querySelector('[data-act="session-start"]')).toBeNull();
    expect(container.textContent).toContain('Проведение тренировки');
  });
});
