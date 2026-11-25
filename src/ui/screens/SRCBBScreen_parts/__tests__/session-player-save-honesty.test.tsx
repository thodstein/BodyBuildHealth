/**
 * session-player-save-honesty.test.tsx — плеер не выдаёт «сохранено», если запись в
 * дневник не легла:
 *  1. провал finishSessionWithSave при завершении оставляет живую сессию единственной
 *     копией тренировки и показывает баннер, а не уводит в «Итог»;
 *  2. провал архива прошлой тренировки при старте блокирует новую сессию: иначе
 *     автосейв пустой/новой сессии затёр бы записанные подходы.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';
import { StrengthDiary } from '../../../../engines/strength-diary.engine';
import {
  addExerciseToSession,
  clearActiveSession,
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

/** Квота на живую сессию: автосейв `he_workout_active_v1` бросает, остальные ключи пишутся. */
function failActiveSessionWrites() {
  const realSetItem = localStorage.setItem.bind(localStorage);
  vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
    if (key === 'he_workout_active_v1') {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    }
    realSetItem(key, value);
  });
}

/** Живая сессия другого дня с записанными подходами — как её оставляет автосейв. */
function liveSessionWithSets() {
  let s = startSession('Ноги · присед', 1);
  s = addExerciseToSession(s, {
    id: 'Приседания со штангой',
    name: 'Приседания со штангой',
    pattern: 'legs',
    muscleGroup: 'legs',
  });
  for (const setNumber of [1, 2]) {
    const logged = logSet(s, 0, { setNumber, weightKg: 100, reps: 5, rpe: 8, rir: 2, notes: '' });
    expect(logged.success).toBe(true);
    s = logged.session;
  }
  return s;
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

describe('SessionPlayer — отказ автосейва подхода', () => {
  it('баннер виден, а живая копия с прошлым подходом не стирается', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    // Первый подход лёг в автосейв обычным путём.
    fireEvent.click(btn(container, 'OK')!);
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);
    expect(container.querySelector('[data-session="autosave-error"]')).toBeNull();

    // Хранилище живой сессии отказало: второй подход (из виджета) в автосейв не попал.
    failActiveSessionWrites();
    const detail = { exerciseName: 'Жим штанги лёжа', weight: 85, reps: 5, rir: 1, handled: false };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail }));
    });

    // Отказ не проглатывается и не стирает уже сохранённый подход.
    const banner = container.querySelector('[data-session="autosave-error"]');
    expect(banner).toBeTruthy();
    expect(banner?.getAttribute('role')).toBe('alert');
    const active = loadActiveSession();
    expect(active).not.toBeNull();
    expect(active?.exercises?.[0]?.sets?.length).toBe(1);

    // Кнопка баннера только скрывает сообщение (повторной записи не делает).
    fireEvent.click(container.querySelector('[data-act="autosave-error-dismiss"]') as HTMLElement);
    expect(container.querySelector('[data-session="autosave-error"]')).toBeNull();
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);
    unmount();
  });
});

describe('SessionPlayer — провал архива незавершённой тренировки', () => {
  it('«В дневник»: отказ объяснён, карточка и живая сессия остаются', () => {
    const live = liveSessionWithSets();
    expect(saveActiveSession(live, 3)).toBe(true);
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    expect(container.querySelector('[data-session="resume"]')).toBeTruthy();

    failWorkoutLogWrites();
    fireEvent.click(container.querySelector('[data-act="resume-drop"]') as HTMLElement);

    expect(container.querySelector('[data-session="save-error"]')).toBeTruthy();
    // Карточка не исчезла: подходы остались лишь в живой сессии.
    expect(container.querySelector('[data-session="resume"]')).toBeTruthy();
    expect(loadActiveSession()?.sessionId).toBe(live.sessionId);
    expect(localStorage.getItem('he_workout_log_v2')).toBeNull();
    unmount();
  });

  it('«Начать заново»: отказ не закрывает панель и не стирает живую сессию', () => {
    const live = liveSessionWithSets();
    expect(saveActiveSession(live, 3)).toBe(true);
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    fireEvent.click(container.querySelector('[data-act="resume-restart"]') as HTMLElement);
    expect(container.querySelector('[data-session="restart-confirm"]')).toBeTruthy();

    failWorkoutLogWrites();
    fireEvent.click(container.querySelector('[data-act="restart-confirm-go"]') as HTMLElement);

    expect(container.querySelector('[data-session="save-error"]')).toBeTruthy();
    // Панель осталась открытой, новая сессия не начата.
    expect(container.querySelector('[data-session="restart-confirm"]')).toBeTruthy();
    expect(container.querySelector('[data-session="resume"]')).toBeTruthy();
    expect(loadActiveSession()?.sessionId).toBe(live.sessionId);
    expect(localStorage.getItem('he_workout_log_v2')).toBeNull();
    unmount();
  });
});

describe('SessionPlayer — завершение пустой сессии и живой ключ', () => {
  it('явный старт пишет живой черновик, пустое завершение его снимает', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    // Явный старт сохраняет живую копию сразу (с меткой «без подходов»): иначе
    // убитый WebView не оставил бы «Продолжить».
    const started = loadActiveSession();
    expect(started).not.toBeNull();
    expect(started?.startedWithoutSets).toBe(true);

    fireEvent.click(btn(container, '⏹ Завершить')!);

    // Пустое завершение снимает свою живую копию и не выдаёт «ошибку записи».
    expect(loadActiveSession()).toBeNull();
    expect(container.querySelector('[data-session="save-error"]')).toBeNull();
    // Итог без done не печатает «undefined» и не выдаёт закрытие за тренировку.
    expect(container.textContent).toContain('Тренировка закрыта');
    expect(container.textContent).not.toContain('фокус: undefined');
    unmount();
  });

  it('чужая живая копия, легшая в ключ между стартом и финишем, не стирается', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    // Вторая вкладка/виджет записали свою (пустую, явно начатую) живую сессию.
    const foreign = {
      ...startSession('Ноги · присед', 1),
      sessionId: 'sess_foreign_race',
      startedWithoutSets: true,
    };
    localStorage.setItem('he_workout_active_v1', JSON.stringify(foreign));

    fireEvent.click(btn(container, '⏹ Завершить')!);

    // Плеер снимает только свою запись: чужая сессия остаётся живой.
    expect(loadActiveSession()?.sessionId).toBe(foreign.sessionId);
    unmount();
  });

  it('clearActiveSession(id) удаляет только запись с этим sessionId (защита от гонки)', () => {
    const mine = { ...startSession('PL', 1), startedWithoutSets: true };
    localStorage.setItem('he_workout_active_v1', JSON.stringify(mine));
    clearActiveSession(mine.sessionId);
    expect(loadActiveSession()).toBeNull();

    localStorage.setItem('he_workout_active_v1', JSON.stringify(mine));
    clearActiveSession('sess_other');
    expect(loadActiveSession()?.sessionId).toBe(mine.sessionId);
  });
});

describe('SessionPlayer — подход из виджета без RIR', () => {
  it('сохраняется как «нет данных», а не «до отказа»', () => {
    const day = plannedDay();
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);

    const detail: {
      exerciseName: string;
      weight: number;
      reps: number;
      rpe: number;
      rir: number;
      rirMissing: boolean;
      handled: boolean;
    } = {
      exerciseName: day.exercises[0].name,
      weight: 80,
      reps: 8,
      rpe: 0,
      rir: 0,
      rirMissing: true,
      handled: false,
    };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail }));
    });

    expect(detail.handled).toBe(true);
    const set = loadActiveSession()?.exercises?.[0]?.sets?.[0];
    expect(set?.rir).toBe(0);
    expect(set?.rirMissing).toBe(true);
    // Строка подхода не печатает ложное «RIR 0» («до отказа» не измеряли).
    expect(container.textContent).toContain('RIR —');
    expect(container.textContent).not.toContain('RIR 0');
    unmount();
  });
});

describe('SessionPlayer — пустой черновик прошлого дня', () => {
  it('не предлагается как «Продолжить» и не уводит сегодняшнюю работу во вчерашнюю дату', () => {
    let stale = startSession('Ноги · присед', 1);
    stale = addExerciseToSession(stale, {
      id: 'Приседания со штангой',
      name: 'Приседания со штангой',
      pattern: 'legs',
      muscleGroup: 'legs',
    });
    const yesterday = localIsoDate(new Date(Date.now() - 86_400_000));
    localStorage.setItem(
      'he_workout_active_v1',
      JSON.stringify({ ...stale, date: yesterday, startedWithoutSets: true }),
    );

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    // Вчерашний пустой черновик снят с ключа и не продолжается: иначе вся сегодняшняя
    // работа ушла бы в дневник вчерашним числом.
    expect(loadActiveSession()).toBeNull();
    expect(container.querySelector('[data-session="resume"]')).toBeNull();
    expect(btn(container, 'Продолжить тренировку')).toBeFalsy();
    expect(btn(container, 'Начать тренировку')).toBeTruthy();

    startMain(container);
    const live = loadActiveSession();
    expect(live?.date).toBe(localIsoDate());
    expect(live?.date).not.toBe(yesterday);
    expect(live?.startedWithoutSets).toBe(true);
    unmount();
  });
});

describe('SessionPlayer — ручной «OK» без RIR', () => {
  it('без RIR и RPE пишет «нет данных», а не «до отказа»', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    fireEvent.click(btn(container, 'OK')!);

    const set = loadActiveSession()?.exercises?.[0]?.sets?.[0];
    expect(set?.rir).toBe(0);
    expect(set?.rpe).toBe(0);
    expect(set?.rirMissing).toBe(true);
    unmount();
  });

  it('с RPE 8 и пустым RIR выводит RIR 2, а не 0', () => {
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    const rpe = container.querySelector('input[aria-label="RPE"]') as HTMLInputElement;
    fireEvent.change(rpe, { target: { value: '8' } });
    fireEvent.click(btn(container, 'OK')!);

    const set = loadActiveSession()?.exercises?.[0]?.sets?.[0];
    expect(set?.rir).toBe(2);
    expect(set?.rpe).toBe(8);
    expect(set?.rirMissing).not.toBe(true);
    unmount();
  });

  it('ручной ввод RIR перебивает виджетовую метку «без оценки»', () => {
    const day = plannedDay();
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);

    const detail = {
      exerciseName: day.exercises[0].name,
      weight: 80,
      reps: 8,
      rpe: 0,
      rir: 0,
      rirMissing: true,
      handled: false,
    };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail }));
    });
    expect(loadActiveSession()?.exercises?.[0]?.sets?.[0]?.rirMissing).toBe(true);

    // Редактор записанного сета: ручной RIR — измерение, метка больше не действует.
    fireEvent.click(container.querySelector('[data-act="edit-set"]') as HTMLElement);
    const rir = container.querySelector('input[aria-label="RIR факт"]') as HTMLInputElement;
    fireEvent.change(rir, { target: { value: '2' } });
    const logBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => (b.textContent || '').trim() === '✓',
    ) as HTMLButtonElement | undefined;
    fireEvent.click(logBtn!);

    const set = loadActiveSession()?.exercises?.[0]?.sets?.[0];
    expect(set?.rir).toBe(2);
    expect(set?.rpe).toBe(8);
    expect(set?.rirMissing).not.toBe(true);
    unmount();
  });
});

describe('SessionPlayer — RPE из виджета и пустой явный старт', () => {
  it('RPE, введённый в виджете без RIR, остаётся измерением (RIR = 10 − RPE)', () => {
    // Android присылает rpe, когда RIR-поле не трогали: метка «не вводили» не должна
    // выбрасывать введённое измерение (иначе тот же подход с RPE 8 ложился как RPE 0).
    const day = plannedDay();
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);

    const detail = {
      exerciseName: day.exercises[0].name,
      weight: 80,
      reps: 8,
      rpe: 8,
      rir: 0,
      rirMissing: true,
      handled: false,
    };
    act(() => {
      window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail }));
    });

    expect(detail.handled).toBe(true);
    const set = loadActiveSession()?.exercises?.[0]?.sets?.[0];
    expect(set?.rpe).toBe(8);
    expect(set?.rir).toBe(2);
    expect(set?.rirMissing).toBeUndefined();
    unmount();
  });

  it('выход из начатой тренировки без подходов снимает живой черновик', () => {
    // Иначе виджет навсегда показывал «идёт тренировка», а startTime переезжал
    // в следующую сессию (длительность → кламп 360 минут).
    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    startMain(container);
    expect(loadActiveSession()?.startedWithoutSets).toBe(true);

    fireEvent.click(btn(container, 'Завершить тренировку')!);
    expect(loadActiveSession()).toBeNull();
    unmount();
  });

  it('подход из виджета не теряется, если «Завершить» нажали до ре-рендера', () => {
    // onWidgetSet пишет живую копию в ref синхронно, state обновится ре-рендером.
    // Пока exitSession смотрел только state, живой подход принимался за пустой
    // черновик, и ключ снимался вместе с записанным подходом.
    const day = plannedDay();
    const { container, unmount } = render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    startMain(container);
    const detail = {
      exerciseName: day.exercises[0].name,
      weight: 80,
      reps: 8,
      rpe: 8,
      rir: 2,
      handled: false,
    };
    // Событие — вне act: важно, что тап случается ДО перерисовки состояния сессии.
    window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail }));
    expect(detail.handled).toBe(true);

    const finishBtn = container.querySelector('[data-act="finish-session"]') as HTMLButtonElement;
    act(() => {
      finishBtn.click();
    });

    // Живая копия цела, плеер спрашивает подтверждение — а не уходит в «Итог»/пусто.
    expect(container.querySelector('[data-session="exit-confirm"]')).toBeTruthy();
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length).toBe(1);
    act(() => unmount());
  });

  it('«В дневник» для явного старта без подходов снимает черновик без ложной ошибки', () => {
    // Пустую сессию архивировать нечего: archiveActiveSession вернул бы null, и карточка
    // с диалогом «Начать заново» застряла бы с сообщением о квоте.
    const draft = { ...startSession('День 1 · жим', 1), sessionId: 'sess_today_empty' };
    expect(saveActiveSession(draft, 6, { allowEmpty: true })).toBe(true);

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    const drop = btn(container, 'В дневник');
    expect(drop).toBeTruthy();
    fireEvent.click(drop!);

    expect(loadActiveSession()).toBeNull();
    expect(container.querySelector('[data-session="save-error"]')).toBeNull();
    expect(container.querySelector('[data-session="resume"]')).toBeNull();
    unmount();
  });

  it('«В дневник» переносит подход, дописанный в черновик после рендера карточки', () => {
    // Виджет в фазе ready пишет подход сам, а снимок resumeFrom остаётся пустым.
    // Решение «архивировать нечего» по снимку стёрло бы этот подход без следа.
    let draft = addExerciseToSession(startSession('День 1 · жим', 1), {
      id: 'Жим штанги лёжа',
      name: 'Жим штанги лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    draft = { ...draft, sessionId: 'sess_today_late_set' };
    expect(saveActiveSession(draft, 6, { allowEmpty: true })).toBe(true);

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    const stored = loadActiveSession()!;
    const logged = logSet(stored, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8, rir: 2 });
    expect(logged.success).toBe(true);
    expect(saveActiveSession(logged.session, 6)).toBe(true);

    fireEvent.click(btn(container, 'В дневник')!);

    expect(container.querySelector('[data-session="save-error"]')).toBeNull();
    expect(loadActiveSession()).toBeNull();
    // Подход попал в журнал — «В дневник» архивировал живую копию, а не снял её.
    const journal = loadSessions();
    expect(journal).toHaveLength(1);
    expect(journal[0].exercises[0].sets).toHaveLength(1);
    // Заметка честная: это перенос в дневник, а не «сохранена при старте новой».
    expect(journal[0].notes).toContain('перенесена в дневник');
    expect(journal[0].notes).not.toContain('при старте новой');
    unmount();
  });

  it('«В дневник» без живой копии закрывает карточку без ложной ошибки', () => {
    // Вторая вкладка уже сняла/архивировала черновик: архивировать нечего, и
    // сообщение о квоте здесь было бы ложью.
    const draft = { ...startSession('День 1 · жим', 1), sessionId: 'sess_today_gone' };
    expect(saveActiveSession(draft, 6, { allowEmpty: true })).toBe(true);

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    expect(container.querySelector('[data-session="resume"]')).toBeTruthy();
    clearActiveSession('sess_today_gone');

    fireEvent.click(btn(container, 'В дневник')!);

    expect(container.querySelector('[data-session="save-error"]')).toBeNull();
    expect(container.querySelector('[data-session="resume"]')).toBeNull();
    unmount();
  });

  it('«В дневник» не архивирует чужую сессию, появившуюся в ключе после рендера', () => {
    // Пока карточка висела со снимком, из виджета/второй вкладки стартовала другая
    // тренировка. Архив «того, что лежит в ключе» закрыл бы её на середине и разбил
    // на две записи, хотя пользователь просил сохранить показанную.
    const shown = { ...startSession('День 1 · жим', 1), sessionId: 'sess_today_shown' };
    expect(saveActiveSession(shown, 6, { allowEmpty: true })).toBe(true);

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);

    let newer = addExerciseToSession(startSession('День 1 · жим', 1), {
      id: 'Жим штанги лёжа',
      name: 'Жим штанги лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    newer = { ...newer, sessionId: 'sess_today_newer' };
    const logged = logSet(newer, 0, { setNumber: 1, weightKg: 60, reps: 10, rpe: 8, rir: 2 });
    expect(logged.success).toBe(true);
    expect(saveActiveSession(logged.session, 6)).toBe(true);

    fireEvent.click(btn(container, 'В дневник')!);

    // Идущая сессия жива целиком, в журнал ничего не ушло, ошибки хранилища нет.
    const active = loadActiveSession();
    expect(active?.sessionId).toBe('sess_today_newer');
    expect(active?.exercises[0].sets).toHaveLength(1);
    expect(loadSessions()).toHaveLength(0);
    expect(container.querySelector('[data-session="save-error"]')).toBeNull();
    // Карточка перечитала живой ключ, а не осталась со снимком.
    expect(container.textContent).toContain('1 подх. уже записано');
    unmount();
  });

  it('карточка «Незавершённая» показывает подход, дописанный в хранилище после рендера', () => {
    // Снимок resumeFrom остаётся пустым, живая копия — с подходом. Карточка и подпись
    // кнопки обязаны читать живой ключ: иначе пользователю пишут «0 подх. уже записано»
    // прямо перед подтверждением «Незавершённая сохранится в дневник».
    let draft = addExerciseToSession(startSession('День 1 · жим', 1), {
      id: 'Жим штанги лёжа',
      name: 'Жим штанги лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    draft = { ...draft, sessionId: 'sess_today_live_card' };
    expect(saveActiveSession(draft, 6, { allowEmpty: true })).toBe(true);

    const view = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    expect(view.container.textContent).toContain('0 подх. уже записано');

    const stored = loadActiveSession()!;
    const logged = logSet(stored, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8, rir: 2 });
    expect(saveActiveSession(logged.session, 6)).toBe(true);

    // Перерисовка того же экрана — без ухода с него (виджет пишет мимо нашего state).
    view.rerender(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    expect(view.container.textContent).toContain('1 подх. уже записано');
    view.unmount();
  });

  it('«Начать заново» для явного старта без подходов не блокируется ложной ошибкой', () => {
    // Тот же тупик через вторую кнопку: архив пустой сессии вернул бы null, панель
    // осталась бы открытой с «ошибкой квоты» и новую тренировку начать было нельзя.
    const draft = { ...startSession('День 1 · жим', 1), sessionId: 'sess_today_empty2' };
    expect(saveActiveSession(draft, 6, { allowEmpty: true })).toBe(true);

    const { container, unmount } = render(<SessionPlayer days={[plannedDay()]} weekNumber={1} focus="PL" />);
    fireEvent.click(btn(container, 'Начать заново')!);
    const confirmGo = container.querySelector('[data-act="restart-confirm-go"]') as HTMLButtonElement;
    expect(confirmGo).toBeTruthy();
    fireEvent.click(confirmGo);

    expect(container.querySelector('[data-session="save-error"]')).toBeNull();
    expect(container.querySelector('[data-session="restart-confirm"]')).toBeNull();
    expect(container.querySelector('[data-session="resume"]')).toBeNull();
    // Новая тренировка реально стартовала: плеер ушёл в разминку, а не остался на карточке.
    expect(btn(container, 'К основной части')).toBeTruthy();
    fireEvent.click(btn(container, 'К основной части')!);
    // Живая копия — новой сессии, а не снятого черновика.
    const active = loadActiveSession();
    expect(active).not.toBeNull();
    expect(active?.sessionId).not.toBe('sess_today_empty2');
    unmount();
  });
});
