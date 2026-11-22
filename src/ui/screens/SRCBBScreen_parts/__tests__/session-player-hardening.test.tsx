/**
 * session-player-hardening.test.tsx — поведением плеера проверяем баги,
 * найденные при разведке проведения тренировки:
 *  1. подход с собственным весом (weight 0) реально записывается, а не падает в log-error;
 *  2. Space/Enter пишет ВВЕДЁННЫЙ сейчас вес, а не значение из прошлого рендера;
 *  3. возврат в «Разминку» при живой сессии не стирает записанные подходы;
 *  4. «Завершить» без единого подхода не пишет тренировку на 0 сетов;
 *  5. «+ Сет» из виджета, пришедший до старта сессии, доводится (а не теряется);
 *  6. закрытие итога («Готово») сбрасывает плеер к старту.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';
import { StrengthDiary } from '../../../../engines/strength-diary.engine';
import {
  addExerciseToSession,
  loadActiveSession,
  loadSessions,
  logSet,
  saveActiveSession,
  startSession,
} from '../../../../engines/workout-logger.engine';

const btn = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => (b.textContent || '').includes(text)) as
    HTMLButtonElement | undefined;

const weightInput = (root: ParentNode) => root.querySelector('input[aria-label="вес"]') as HTMLInputElement | null;

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
        { weight: 85, reps: 6, rir: 1 },
      ],
    },
  ],
});

const bodyweightDay = (): PlayerDay => ({
  label: 'День 2 · турник',
  exercises: [
    {
      name: 'Подтягивания',
      muscleGroup: 'back',
      restSec: 90,
      targetSets: [
        { weight: 0, reps: 10, rir: 2 },
        { weight: 0, reps: 8, rir: 1 },
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

describe('SessionPlayer — подходы с собственным весом', () => {
  it('вес 0 с повторами > 0 записывается, без ошибки логирования и без выдуманного e1RM', () => {
    const { container, unmount } = render(<SessionPlayer days={[bodyweightDay()]} weekNumber={1} focus="BB" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);

    expect(container.querySelector('[data-pl="log-error"]')).toBeNull();
    const active = loadActiveSession();
    expect(active?.exercises?.[0]?.sets?.length).toBe(1);
    expect(active?.exercises?.[0]?.sets?.[0]?.weightKg).toBe(0);
    expect(active?.exercises?.[0]?.sets?.[0]?.reps).toBe(10);
    expect(active?.exercises?.[0]?.sets?.[0]?.bodyweight).toBe(true);
    expect(active?.exercises?.[0]?.sets?.[0]?.isPR).toBe(false);
    expect(active?.totalVolume).toBe(0);
    unmount();
  });
});

describe('SessionPlayer — хоткей пишет текущий ввод', () => {
  it('Space записывает вес, введённый перед нажатием, а не плановый', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);

    const w = weightInput(container)!;
    fireEvent.change(w, { target: { value: '77' } });
    fireEvent.keyDown(window, { key: ' ' });

    const active = loadActiveSession();
    expect(active?.exercises?.[0]?.sets?.[0]?.weightKg).toBe(77);
    unmount();
  });
});

describe('SessionPlayer — переходы фаз', () => {
  it('возврат в «Разминку» при живой сессии не стирает записанные подходы', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);

    const warmupTab = Array.from(container.querySelectorAll('[role="tab"]')).find((t) =>
      (t.textContent || '').includes('Разминка'),
    ) as HTMLButtonElement | undefined;
    expect(warmupTab).toBeTruthy();
    fireEvent.click(warmupTab!);

    // Фаза осталась основной, записанный подход на месте.
    expect(container.textContent).toContain('⏹ Завершить');
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);
    unmount();
  });

  it('минуты для sRPE берутся из таймера сессии, а не из зашитых 60', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);
    fireEvent.click(btn(container, '⏹ Завершить')!);

    const srpe = JSON.parse(localStorage.getItem('he_srpe_sessions') || '[]');
    expect(srpe.length).toBe(1);
    expect(srpe[0].durationMin).toBeLessThanOrEqual(2);
    unmount();
  });

  it('«Завершить» без единого подхода не пишет пустую тренировку и объясняет итог', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    expect(loadSessions().length).toBe(0);

    fireEvent.click(btn(container, '⏹ Завершить')!);

    expect(loadSessions().length).toBe(0);
    expect(loadActiveSession()).toBeNull();
    expect(container.querySelector('[data-pl="done-empty"]')).toBeTruthy();
    unmount();
  });

  it('закрытие итога сбрасывает плеер к старту, а не показывает вчерашний отчёт', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, '⏹ Завершить')!);
    expect(container.querySelector('[data-pl="done-empty"]')).toBeTruthy();

    fireEvent(window, new Event('he-workout-close'));

    expect(container.querySelector('[data-pl="done-empty"]')).toBeNull();
    expect(btn(container, 'Начать тренировку')).toBeTruthy();
    unmount();
  });
});

describe('SessionPlayer — продолжение автосохранённой сессии', () => {
  it('подход восстанавливается по своему номеру, а не по позиции в массиве', () => {
    let s = startSession('День 1 · жим', 1);
    s = addExerciseToSession(s, {
      id: 'bench',
      name: 'Жим штанги лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    const logged = logSet(s, 0, {
      setNumber: 2,
      weightKg: 100,
      reps: 8,
      rpe: 8,
      rir: 2,
      notes: '',
    });
    expect(logged.success).toBe(true);
    saveActiveSession(logged.session, 3);

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    fireEvent.click(btn(container, 'Продолжить')!);

    // Первый подход дня остаётся плановым (80): раньше единственный сохранённый
    // сет (номер 2) подставлялся в редактор первого подхода.
    expect(weightInput(container)?.value).toBe('80');
    unmount();
  });
});

describe('SessionPlayer — «+ Сет» из виджета до старта сессии', () => {
  it('стартует основную часть и записывает подход, подтверждая обработку пульту', async () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    const handled = vi.fn();

    fireEvent(window, new CustomEvent('he-workout-quick-set', { detail: { handled } }));

    await vi.waitFor(() => {
      const active = loadActiveSession();
      expect(active?.exercises?.[0]?.sets?.length).toBe(1);
    });
    expect(handled).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('⏹ Завершить');
    unmount();
  });
});

describe('SessionPlayer — вес 0 и подходы из виджета', () => {
  const zeroWeightBarbellDay = (): PlayerDay => ({
    label: 'День 3 — Жим',
    exercises: [
      {
        name: 'Жим штанги лёжа',
        muscleGroup: 'chest',
        restSec: 90,
        targetSets: [{ weight: 0, reps: 8, rir: 2 }],
      },
    ],
  });

  it('вес 0 у штанги без ввода — видимая ошибка, подход не записан', () => {
    const { container, unmount } = render(
      <SessionPlayer days={[zeroWeightBarbellDay()]} weekNumber={1} focus="PL" />,
    );
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);

    expect(container.querySelector('[data-pl="log-error"]')).not.toBeNull();
    const sets = loadActiveSession()?.exercises?.[0]?.sets || [];
    expect(sets).toHaveLength(0);
    unmount();
  });

  it('quick-set без свободных подходов отвечает handled(false), а не молчит', () => {
    const day: PlayerDay = {
      label: 'День 4 — Один подход',
      exercises: [
        { name: 'Жим штанги лёжа', muscleGroup: 'chest', restSec: 90, targetSets: [{ weight: 80, reps: 8, rir: 2 }] },
      ],
    };
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);

    const detail = { handled: vi.fn() };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-quick-set', { detail }));
    });
    expect(detail.handled).toHaveBeenCalledWith(false);
    unmount();
  });

  it('подход из виджета пишется в открытую сессию и подтверждается handled', () => {
    const day = plannedDay();
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);

    const detail: { exerciseName: string; weight: number; reps: number; rir: number; handled: boolean } = {
      exerciseName: day.exercises[0].name,
      weight: 85,
      reps: 5,
      rir: 1,
      handled: false,
    };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail }));
    });

    expect(detail.handled).toBe(true);
    const sets = loadActiveSession()?.exercises?.[0]?.sets || [];
    expect(sets.some(s => s.weightKg === 85 && s.reps === 5)).toBe(true);
    // Номер подхода продолжает план, а не дублирует уже записанный.
    expect(new Set(sets.map(s => s.setNumber)).size).toBe(sets.length);
    unmount();
  });
});

describe('SessionPlayer — флаг isBodyweight из плана', () => {
  it('явный isBodyweight позволяет записать подход с весом 0 без ввода веса', () => {
    const day: PlayerDay = {
      label: 'День 5 — Своё тело',
      exercises: [
        {
          name: 'Тяга на турнике',
          muscleGroup: 'back',
          restSec: 90,
          isBodyweight: true,
          targetSets: [{ weight: 0, reps: 6, rir: 2 }],
        },
      ],
    };
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="BB" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);

    expect(container.querySelector('[data-pl="log-error"]')).toBeNull();
    const set = loadActiveSession()?.exercises?.[0]?.sets?.[0];
    expect(set?.bodyweight).toBe(true);
    expect(set?.weightKg).toBe(0);
    expect(set?.reps).toBe(6);
    unmount();
  });
});
