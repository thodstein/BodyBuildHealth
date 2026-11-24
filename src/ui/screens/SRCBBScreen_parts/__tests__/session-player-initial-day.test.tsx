/**
 * session-player-initial-day.test.tsx — плеер открывается на «сегодняшнем» дне плана.
 *
 * Раньше `dayIdx` жёстко стартовал с 0: на 48-дневном BB-цикле и на многодневном
 * ПЛ-цикле человек каждый раз видел первый день, хотя виджет уже показывал
 * «сегодняшний» (он считался по графику профиля). День приходит пропом
 * `initialDayIndex` — его считает ExecutionZone по якорю `he_pl_runtime.startDate`
 * единым движком `training-day.engine`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';
import { StrengthDiary } from '../../../../engines/strength-diary.engine';

const dayOf = (label: string, name: string): PlayerDay => ({
  label,
  exercises: [{ name, muscleGroup: 'chest', restSec: 90, targetSets: [{ weight: 80, reps: 8, rir: 2 }] }],
});

const days = (): PlayerDay[] => [
  dayOf('День 1 · жим', 'Жим штанги лёжа'),
  dayOf('День 2 · присед', 'Приседания со штангой'),
  dayOf('День 3 · тяга', 'Становая тяга'),
];

/** Подпись активной кнопки выбора дня (aria-pressed=true). */
const activeDay = (root: ParentNode): string =>
  root.querySelector('button[aria-pressed="true"][aria-label^="Выбрать"]')?.getAttribute('aria-label') ?? '';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(StrengthDiary.prototype, 'getLastSession').mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SessionPlayer — начальный день из якоря плана', () => {
  it('открывается на переданном дне, а не на первом', () => {
    const { container, unmount } = render(
      <SessionPlayer days={days()} weekNumber={1} focus="BB" initialDayIndex={2} />,
    );
    expect(activeDay(container)).toBe('Выбрать День 3 · тяга');
    // Виден план выбранного дня и не виден план первого.
    expect(container.textContent).toContain('Становая тяга');
    expect(container.textContent).not.toContain('Жим штанги лёжа');
    unmount();
  });

  it('без пропа (или 0) открывается на первом дне — прежнее поведение', () => {
    const { container, unmount } = render(<SessionPlayer days={days()} weekNumber={1} focus="BB" />);
    expect(activeDay(container)).toBe('Выбрать День 1 · жим');
    expect(container.textContent).toContain('Жим штанги лёжа');
    unmount();
  });

  it('индекс за границей плана зажимается в последний день, а не даёт пустой экран', () => {
    const { container, unmount } = render(
      <SessionPlayer days={days()} weekNumber={1} focus="BB" initialDayIndex={99} />,
    );
    expect(activeDay(container)).toBe('Выбрать День 3 · тяга');
    expect(container.textContent).toContain('Становая тяга');
    unmount();
  });

  it('новый якорь плана переключает плеер на новый день (ручной выбор не залипает)', () => {
    const { container, rerender, unmount } = render(
      <SessionPlayer days={days()} weekNumber={1} focus="BB" initialDayIndex={0} />,
    );
    expect(activeDay(container)).toBe('Выбрать День 1 · жим');
    rerender(<SessionPlayer days={days()} weekNumber={1} focus="BB" initialDayIndex={1} />);
    expect(activeDay(container)).toBe('Выбрать День 2 · присед');
    expect(container.textContent).toContain('Приседания со штангой');
    unmount();
  });

  it('пока сессия идёт, новый якорь из другого окна не меняет день под тренировкой', () => {
    const { container, rerender, unmount } = render(
      <SessionPlayer days={days()} weekNumber={1} focus="BB" initialDayIndex={0} />,
    );
    const start = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Начать тренировку'),
    );
    expect(start).toBeTruthy();
    fireEvent.click(start as HTMLButtonElement);
    // Разминка — по желанию: переходим к основной части, где видно упражнения дня.
    const toMain = container.querySelector('[data-act="warmup-to-main"]');
    if (toMain) fireEvent.click(toMain);
    expect(container.textContent).toContain('Жим штанги лёжа');

    // План перезаписали (второе окно/конструктор): день не должен переключиться.
    rerender(<SessionPlayer days={days()} weekNumber={1} focus="BB" initialDayIndex={2} />);
    expect(container.textContent).toContain('Жим штанги лёжа');
    expect(container.textContent).not.toContain('Становая тяга');
    unmount();
  });
});
