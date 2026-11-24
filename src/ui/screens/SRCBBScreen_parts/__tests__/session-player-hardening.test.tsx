/**
 * session-player-hardening.test.tsx — поведением плеера проверяем баги,
 * найденные при разведке проведения тренировки:
 *  1. подход с собственным весом (weight 0) реально записывается, а не падает в log-error;
 *  2. Space/Enter пишет ВВЕДЁННЫЙ сейчас вес, а не значение из прошлого рендера;
 *  3. возврат в «Разминку» при живой сессии не стирает записанные подходы;
 *  4. «Завершить» без единого подхода не пишет тренировку на 0 сетов;
 *  5. «+ Сет» из виджета, пришедший до старта сессии, доводится (а не теряется);
 *  6. закрытие итога («Готово») сбрасывает плеер к старту.
 *  7. завершение из виджета завершает сессию плеером (sRPE — только измеренная), а подход
 *     из виджета в том же дренаже очереди не теряется.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';
import { StrengthDiary } from '../../../../engines/strength-diary.engine';
import {
  addExerciseToSession,
  loadActiveSession,
  loadSessions,
  localIsoDate,
  logSet,
  saveActiveSession,
  startSession,
} from '../../../../engines/workout-logger.engine';

const btn = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => (b.textContent || '').includes(text)) as
    HTMLButtonElement | undefined;

const weightInput = (root: ParentNode) => root.querySelector('input[aria-label="вес"]') as HTMLInputElement | null;

// Кнопка sRPE сессии: div, чей первый ребёнок — метка «sRPE». В основной части есть
// ещё RPE отдельного подхода с такими же цифрами — его брать нельзя.
const sRpeButton = (root: ParentNode, value: number) => {
  const row = Array.from(root.querySelectorAll('div')).find(
    (d) => (d.firstElementChild?.textContent || '').trim() === 'sRPE',
  );
  if (!row) return undefined;
  return Array.from(row.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === String(value)) as
    HTMLButtonElement | undefined;
};

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
    // sRPE пишется только измеренной: пользователь явно выбирает нагрузку.
    fireEvent.click(sRpeButton(container, 9)!);
    fireEvent.click(btn(container, '⏹ Завершить')!);

    const srpe = JSON.parse(localStorage.getItem('he_srpe_sessions') || '[]');
    expect(srpe.length).toBe(1);
    expect(srpe[0].sRPE).toBe(9);
    expect(srpe[0].durationMin).toBeLessThanOrEqual(2);
    unmount();
  });

  it('«Завершить» без выбора sRPE не пишет выдуманную нагрузку', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);
    fireEvent.click(btn(container, '⏹ Завершить')!);

    // Стартовое значение 7 видно на экране, но пользователь его не выбирал:
    // в ACWR не должна уезжать нагрузка, которой не было.
    expect(localStorage.getItem('he_srpe_sessions')).toBeNull();
    unmount();
  });

  it('неявный выход (таб «Итог») спрашивает подтверждение в своём диалоге', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);

    const doneTab = () =>
      Array.from(container.querySelectorAll('[role="tab"]')).find((t) => (t.textContent || '').includes('Итог')) as
        HTMLButtonElement | undefined;
    fireEvent.click(doneTab()!);
    expect(container.querySelector('[data-session="exit-confirm"]')).toBeTruthy();
    expect(loadSessions().length).toBe(0);

    // Отмена оставляет тренировку живой — подходы не теряются.
    fireEvent.click(btn(container, 'Остаться в тренировке')!);
    expect(container.querySelector('[data-session="exit-confirm"]')).toBeNull();
    expect(loadSessions().length).toBe(0);
    expect(container.textContent).toContain('⏹ Завершить');

    fireEvent.click(doneTab()!);
    fireEvent.click(btn(container, 'Сохранить и завершить')!);
    expect(loadSessions()).toHaveLength(1);
    expect(loadActiveSession()).toBeNull();
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
  it('подходы чужого дня привязываются по имени упражнения, а не по индексу', () => {
    // Автосейв сделан в другом порядке упражнений (или в другой версии плана).
    let s = startSession('День 2', 1);
    s = addExerciseToSession(s, { id: 'squat', name: 'Приседания', pattern: 'squat', muscleGroup: 'quads' });
    s = addExerciseToSession(s, {
      id: 'bench',
      name: 'Жим штанги лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    s = logSet(s, 0, { setNumber: 1, weightKg: 140, reps: 5, rpe: 8, rir: 2 }).session;
    s = logSet(s, 1, { setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2 }).session;
    saveActiveSession(s, 2);

    const reversedDay: PlayerDay = {
      label: 'День 2 · жим и присед',
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
        { name: 'Приседания', muscleGroup: 'quads', restSec: 120, targetSets: [{ weight: 100, reps: 5, rir: 2 }] },
      ],
    };
    const { container, unmount } = render(<SessionPlayer days={[reversedDay]} weekNumber={1} focus="PL" />);
    fireEvent.click(btn(container, 'Продолжить')!);

    // Первое упражнение дня — жим: раньше по индексу к нему «приклеивались» подходы приседа.
    // Записанный подход жима уже закрыт, редактор перешёл к следующему — поэтому проверяем
    // восстановленную сессию, а не поле ввода.
    const active = loadActiveSession();
    expect(active?.exercises?.[0]?.sets?.[0]?.weightKg).toBe(100);
    expect(active?.exercises?.[1]?.sets?.[0]?.weightKg).toBe(140);
    // Продолжение не заводит вторую запись в дневнике: sessionId из автосейва сохранён.
    expect(active?.sessionId).toBe(s.sessionId);
    unmount();
  });

  it('упражнение вне текущего дня не теряется при продолжении', () => {
    let s = startSession('День 2', 1);
    s = addExerciseToSession(s, { id: 'row', name: 'Тяга в наклоне', pattern: 'horizontal_pull', muscleGroup: 'back' });
    s = logSet(s, 0, { setNumber: 1, weightKg: 60, reps: 10, rpe: 8, rir: 2 }).session;
    saveActiveSession(s, 1);

    // В плане текущего дня тяги нет: раньше её подходы просто исчезали вместе с автосейвом.
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    fireEvent.click(container.querySelector('[data-act="resume-go"]') as HTMLElement);

    const active = loadActiveSession();
    const row = (active?.exercises || []).find((e) => e.exerciseName === 'Тяга в наклоне');
    expect(row).toBeTruthy();
    expect(row?.sets?.[0]?.weightKg).toBe(60);
    expect(row?.sets?.[0]?.reps).toBe(10);
    unmount();
  });

  it('вчерашняя сессия при продолжении не начисляет «часы сна» в длительность', () => {
    let s = startSession('День 1 · жим', 1);
    s = addExerciseToSession(s, {
      id: 'bench',
      name: 'Жим штанги лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    s = logSet(s, 0, { setNumber: 1, weightKg: 100, reps: 8, rpe: 8, rir: 2 }).session;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 30, 0, 0);
    localStorage.setItem(
      'he_workout_active_v1',
      JSON.stringify({
        ...s,
        date: localIsoDate(yesterday),
        startTime: '18:30',
        savedAt: yesterday.getTime() + 40 * 60000,
      }),
    );

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    fireEvent.click(container.querySelector('[data-act="resume-go"]') as HTMLElement);
    fireEvent.click(btn(container, '⏹ Завершить')!);

    const sessions = loadSessions();
    expect(sessions).toHaveLength(1);
    // Таймер продолжения стартует с нуля, а не «с 18:30 вчера»: в дневник и в sRPE
    // не должно уехать 14 часов.
    expect(sessions[0].durationMin).toBeLessThan(360);
    expect(sessions[0].durationMin).toBeLessThanOrEqual(5);
    unmount();
  });

  it('при смене плана знаменатель прогресса считается от текущего дня', () => {
    let s = startSession('День 2', 1);
    s = addExerciseToSession(s, {
      id: 'bench',
      name: 'Жим штанги лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    s = logSet(s, 0, { setNumber: 1, weightKg: 100, reps: 8, rpe: 8, rir: 2 }).session;
    saveActiveSession(s, 20); // старый план: 20 подходов

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    fireEvent.click(container.querySelector('[data-act="resume-go"]') as HTMLElement);

    // В текущем дне три запланированных подхода: прогресс 1/3, а не 1/20.
    expect(loadActiveSession()?.plannedSetsTotal).toBe(3);
    unmount();
  });

  it('живая сессия не теряется при старте новой: уходит в дневник с реальной длительностью', () => {
    const KEY = 'he_workout_active_v1';
    let s = startSession('День 1', 1);
    s = addExerciseToSession(s, {
      id: 'deadlift',
      name: 'Становая тяга',
      pattern: 'hinge',
      muscleGroup: 'back',
    });
    s = logSet(s, 0, { setNumber: 1, weightKg: 85, reps: 6, rpe: 8, rir: 2 }).session;
    // Старт 90 минут назад — ровно столько тренировка длилась до последнего автосейва.
    const start = new Date();
    start.setSeconds(0, 0);
    start.setTime(start.getTime() - 90 * 60000);
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const savedAt = start.getTime() + 90 * 60000;
    localStorage.setItem(KEY, JSON.stringify({ ...s, date: localIsoDate(start), startTime, savedAt }));

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    // «Начать заново» — явный выбор новой тренировки; спрашивает своим диалогом, а не
    // window.confirm (тот в WebView без поддержки молча гасит кнопку).
    fireEvent.click(btn(container, 'Начать заново')!);
    const confirmPanel = container.querySelector('[data-session="restart-confirm"]') as HTMLElement | null;
    expect(confirmPanel).toBeTruthy();
    // Отмена ничего не архивирует и не начинает заново — подходы остаются живыми.
    fireEvent.click(btn(confirmPanel!, 'Отмена')!);
    expect(loadSessions()).toHaveLength(0);
    expect(loadActiveSession()).not.toBeNull();

    // Подтверждение: записанные подходы уходят в дневник, новая тренировка с разминки.
    fireEvent.click(btn(container, 'Начать заново')!);
    fireEvent.click(container.querySelector('[data-act="restart-confirm-go"]') as HTMLElement);
    fireEvent.click(btn(container, 'К основной части')!);

    const sessions = loadSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe(localIsoDate(start));
    expect(sessions[0].durationMin).toBe(90);
    expect(sessions[0].exercises?.[0]?.sets?.[0]?.weightKg).toBe(85);
    // Служебные поля живой сессии в историю не попадают.
    expect((sessions[0] as any).savedAt).toBeUndefined();
    expect((sessions[0] as any).plannedSetsTotal).toBeUndefined();
    // Новая тренировка стартовала с чистого листа.
    expect(container.textContent).toContain('⏹ Завершить');
    expect(loadActiveSession()).toBeNull();
    unmount();
  });

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
    const { container, unmount } = render(<SessionPlayer days={[zeroWeightBarbellDay()]} weekNumber={1} focus="PL" />);
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
    expect(sets.some((s) => s.weightKg === 85 && s.reps === 5)).toBe(true);
    // Номер подхода продолжает план, а не дублирует уже записанный.
    expect(new Set(sets.map((s) => s.setNumber)).size).toBe(sets.length);
    unmount();
  });

  it('два подхода из виджета в одном дренаже очереди не теряются', () => {
    const day = plannedDay();
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);

    const make = () => ({
      exerciseName: day.exercises[0].name,
      weight: 85,
      reps: 5,
      rir: 1,
      handled: false,
    });
    const first = make();
    const second = make();
    // Очередь виджета разбирается синхронно, без ре-рендера между элементами.
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail: first }));
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail: second }));
    });

    expect(first.handled).toBe(true);
    expect(second.handled).toBe(true);
    const sets = loadActiveSession()?.exercises?.[0]?.sets || [];
    expect(sets).toHaveLength(2);
    expect(new Set(sets.map((s) => s.setNumber)).size).toBe(2);
    unmount();
  });

  it('подсказка RIR прошлой сессии показывается, но RPE из неё не пишется', async () => {
    vi.spyOn(StrengthDiary.prototype, 'getLastSession').mockResolvedValue({
      sessionId: 'prev',
      date: '2026-11-20',
      startTime: '10:00',
      endTime: '11:00',
      durationMin: 60,
      notes: '',
      focus: 'PL',
      weekNumber: 1,
      exercises: [
        {
          exerciseName: 'Жим штанги лёжа',
          sets: [{ setNumber: 1, weightKg: 90, reps: 8, rpe: 0, rir: 2 }],
        },
      ],
    } as never);

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    // hydratePrevious — async (getLastSession), подсказка приходит после микротасков.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const rirInput = container.querySelector('input[aria-label="RIR факт"]') as HTMLInputElement | null;
    expect(rirInput?.value).toBe('2');
    fireEvent.click(btn(container, 'OK')!);

    // Подтверждение подсказки — не измерение: RPE/RIR остаются пустыми.
    const set = loadActiveSession()?.exercises?.[0]?.sets?.[0];
    expect(set?.rpe).toBe(0);
    expect(set?.rir).toBe(0);
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

describe('SessionPlayer — завершение из виджета', () => {
  // Строка sRPE сессии: div, чей первый ребёнок — метка «sRPE». В основной части есть ещё
  // RPE отдельного подхода с такими же цифрами — его брать нельзя.
  const sessionRpeButton = (root: ParentNode, value: number) => {
    const row = Array.from(root.querySelectorAll('div')).find(
      (d) => (d.firstElementChild?.textContent || '').trim() === 'sRPE',
    );
    if (!row) return undefined;
    return Array.from(row.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === String(value)) as
      HTMLButtonElement | undefined;
  };

  it('запрос из виджета завершает сессию плеером и не пишет выдуманную sRPE', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);

    const detail: { handled?: boolean } = {};
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-finish-request', { detail }));
    });

    expect(detail.handled).toBe(true);
    expect(loadSessions()).toHaveLength(1);
    expect(loadActiveSession()).toBeNull();
    // RPE пользователь не выбирал: sRPE-запись не создаём (иначе в ACWR уйдёт 7/10).
    expect(localStorage.getItem('he_srpe_sessions')).toBeNull();
    unmount();
  });

  it('подход из виджета и завершение в одном дренаже: подход попадает в историю', () => {
    const day = plannedDay();
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);

    // Именно этот порядок выдаёт applyWidgetQueue при сливе очереди: подход, сразу за ним завершение.
    const setDetail = { exerciseName: day.exercises[0].name, weight: 87.5, reps: 4, rir: 1, handled: false };
    const finishDetail: { handled?: boolean } = {};
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail: setDetail }));
      window.dispatchEvent(new CustomEvent('he-workout-finish-request', { detail: finishDetail }));
    });

    expect(setDetail.handled).toBe(true);
    expect(finishDetail.handled).toBe(true);
    const saved = loadSessions();
    expect(saved).toHaveLength(1);
    const sets = saved[0].exercises?.[0]?.sets || [];
    expect(sets.some((s) => s.weightKg === 87.5 && s.reps === 4)).toBe(true);
    unmount();
  });

  it('старт из виджета после завершения (итог/заминка) не теряется', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);
    fireEvent.click(btn(container, '⏹ Завершить')!);
    // Плеер остаётся смонтированным на заминке, но новую тренировку начать можно.
    const detail: { handled?: boolean } = { handled: false };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-start', { detail }));
    });

    expect(detail.handled).toBe(true);
    // Сессия реально стартовала: видна основная часть, а не итог.
    expect(container.textContent).toContain('⏹ Завершить');
    unmount();
  });

  it('старт из виджета с фазы «Итог» не теряется и пустая сессия не пишется в историю', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    // Без записанных подходов «Завершить» уводит сразу в пустой «Итог» (`phase === 'done'`).
    fireEvent.click(btn(container, '⏹ Завершить')!);
    expect(container.querySelector('[data-pl="done-empty"]')).toBeTruthy();
    expect(loadSessions()).toHaveLength(0);

    const detail: { handled?: boolean } = { handled: false };
    // Родитель карточки (TrainingScreen/ExecutionZone) слушает he-workout-close и на сбросе
    // сворачивает плеер; после старта он обязан получить he-workout-open, иначе сессия идёт
    // невидимой, пока виджет рапортует handled.
    let opened = 0;
    const onOpen = () => {
      opened += 1;
    };
    window.addEventListener('he-workout-open', onOpen);
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-start', { detail }));
    });
    window.removeEventListener('he-workout-open', onOpen);

    expect(detail.handled).toBe(true);
    expect(opened).toBe(1);
    // Плеер реально стартовал заново, а не остался на итоге.
    expect(container.textContent).toContain('⏹ Завершить');
    expect(loadSessions()).toHaveLength(0);
    unmount();
  });

  it('если RPE выбран в плеере, завершение из виджета пишет эту sRPE', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);
    const nine = sessionRpeButton(container, 9);
    expect(nine).toBeTruthy();
    fireEvent.click(nine!);

    const detail: { handled?: boolean } = {};
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-finish-request', { detail }));
    });

    expect(detail.handled).toBe(true);
    const srpe = JSON.parse(localStorage.getItem('he_srpe_sessions') || '[]');
    expect(srpe).toHaveLength(1);
    expect(srpe[0].sRPE).toBe(9);
    unmount();
  });

  it('пустая сессия на запрос из виджета не завершается и не отвечает handled', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);

    const detail: { handled?: boolean } = {};
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-finish-request', { detail }));
    });

    // handled не выставлен — виджет завершит пустую сессию сам (она просто не попадёт в историю).
    expect(detail.handled).toBeUndefined();
    expect(loadSessions()).toHaveLength(0);
    unmount();
  });
});

describe('SessionPlayer — честный отказ хранилища', () => {
  it('подход из виджета не объявляется записанным, если хранилище отказало', () => {
    const day = plannedDay();
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);

    // Квота/приватный режим: запись живой сессии падает.
    const originalSetItem = localStorage.setItem.bind(localStorage);
    (localStorage as unknown as { setItem: (k: string, v: string) => void }).setItem = (key, value) => {
      if (key === 'he_workout_active_v1') throw new Error('QuotaExceededError');
      originalSetItem(key, value);
    };

    const detail = {
      exerciseName: day.exercises[0].name,
      weight: 85,
      reps: 5,
      rir: 1,
      handled: false as boolean | undefined,
    };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail }));
    });
    (localStorage as unknown as { setItem: (k: string, v: string) => void }).setItem = originalSetItem;

    // Виджету нельзя рапортовать успех: подход остался только в памяти,
    // и при закрытии приложения он исчезнет без следа.
    expect(detail.handled).toBe(false);
    expect(loadActiveSession()).toBeNull();
    unmount();
  });
});
