/**
 * training-widget-open.test.tsx — старт из виджета/пульта/док-панели.
 *
 * Событие he-workout-open ловит и экран тренировок (ExecutionZone в этот момент
 * ещё не смонтирован). Раньше экран только переключал зону и ставил
 * runtimeStarted, поэтому при сохранённом плане ПЛ/ББ пользователь попадал на
 * свёрнутую карточку «Начать по плану» — второй тап был неочевиден.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, waitFor } from '@testing-library/react';
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

describe('TrainingScreen: открытие проведения из виджета', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('с планом ПЛ карточка проведения раскрывается, а не остаётся свёрнутой', async () => {
    localStorage.setItem('he_pl_runtime', JSON.stringify(PL_RUNTIME));
    const { container } = render(<TrainingScreen />);
    // До события зона не открыта вовсе.
    expect(container.querySelector('.hub-exec')).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event('he-workout-open'));
    });

    // Зона грузится лениво (React.lazy) — ждём её появления.
    await waitFor(() => expect(container.querySelector('.hub-exec')).not.toBeNull(), { timeout: 5000 });
    // Свёрнутая карточка — это единственная кнопка «Начать по плану»
    // (data-act="session-start"). Раскрытая карточка её не показывает.
    expect(container.querySelector('[data-act="session-start"]')).toBeNull();
    expect(container.textContent).toContain('Проведение тренировки');
  });

  it('без плана ПЛ включается плеер выбора дня, а не пустой экран', async () => {
    const { container } = render(<TrainingScreen />);
    await act(async () => {
      window.dispatchEvent(new Event('he-workout-open'));
    });
    await waitFor(() => expect(container.querySelector('.hub-exec')).not.toBeNull(), { timeout: 5000 });
    const player = container.querySelector('[data-session="player"]') as HTMLElement | null;
    expect(player).not.toBeNull();
    expect(player!.style.display).toBe('block');
  });
});
