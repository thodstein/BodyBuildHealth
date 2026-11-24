/**
 * widget-workout-integrity.test.ts — подходы из нативного виджета не теряются и не дублируются.
 *
 *  - вес 0 для упражнения без отягощения записывается как «свой вес», а не отвергается;
 *  - вес 0 для штанги отвергается (никакого молчаливого тоннажа 0);
 *  - завершение из виджета сообщает плееру, а история не дублируется;
 *  - пока плеер открыт, виджет не пишет в хранилище сам, а отдаёт подход плееру;
 *  - подход без RPE/RIR не получает выдуманный RPE 10.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyWidgetQueue, resolveWorkoutPlan, setWorkoutPlayerActive } from '../../ui/native/widget-sync';
import { finishSession, loadActiveSession, loadSessions, saveActiveSession } from '../../engines/workout-logger.engine';

const PLAN = {
  days: [
    {
      label: 'День A',
      exercises: [
        { name: 'Жим лёжа', muscleGroup: 'chest', restSec: 120, targetSets: [{ weight: 80, reps: 8, rir: 2 }] },
        { name: 'Подтягивания', muscleGroup: 'back', restSec: 90, targetSets: [{ weight: 0, reps: 8, rir: 2 }] },
      ],
    },
    {
      label: 'День B',
      exercises: [{ name: 'Присед', muscleGroup: 'legs', targetSets: [{ weight: 100, reps: 5, rir: 2 }] }],
    },
  ],
  focus: 'upper',
  week: 1,
  track: 'bb',
};

const setsOf = (name: string) => {
  const active = loadActiveSession();
  if (!active) return 0;
  return (active.exercises.find((e) => e.exerciseName === name)?.sets || []).length;
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('he_pl_runtime', JSON.stringify(PLAN));
  setWorkoutPlayerActive(false);
});

afterEach(() => {
  setWorkoutPlayerActive(false);
  localStorage.clear();
});

describe('виджет: подходы и завершение', () => {
  it('вес 0 у подтягиваний пишется как «свой вес»', () => {
    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Подтягивания', weight: 0, reps: 8, rir: 2, ts: Date.now() },
    ]);
    expect(res.setsAdded).toBe(1);
    const active = loadActiveSession();
    const set = active?.exercises.find((e) => e.exerciseName === 'Подтягивания')?.sets[0];
    expect(set?.bodyweight).toBe(true);
    expect(set?.reps).toBe(8);
  });

  it('вес 0 у штанги отвергается, подход не появляется', () => {
    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 0, reps: 8, rir: 2, ts: Date.now() },
    ]);
    expect(res.setsAdded).toBe(0);
    expect(setsOf('Жим лёжа')).toBe(0);
  });

  it('номер подхода продолжает уже записанные, а не считается по длине массива', () => {
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.now() }]);
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 82.5, reps: 6, ts: Date.now() }]);
    const sets = loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets || [];
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it('завершение из виджета сообщает плееру и не дублирует историю', () => {
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.now() }]);

    let closeEvents = 0;
    const onClose = () => {
      closeEvents += 1;
    };
    window.addEventListener('he-workout-close', onClose);

    applyWidgetQueue([{ type: 'workout_finish', ts: Date.now() }]);
    expect(closeEvents).toBe(1);
    expect(loadSessions()).toHaveLength(1);

    // Плеер мог держать ту же сессию в состоянии и завершить её повторно — upsert, не дубль.
    const finished = loadSessions()[0];
    expect(finishSession(finished, 'note').sessionId).toBe(finished.sessionId);
    expect(loadSessions()).toHaveLength(1);

    window.removeEventListener('he-workout-close', onClose);
  });

  it('пока плеер открыт, виджет отдаёт подход событием и не пишет в хранилище', () => {
    setWorkoutPlayerActive(true);
    const seen: Array<Record<string, unknown>> = [];
    const onSet = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as Record<string, unknown>;
      seen.push(detail);
      detail.handled = true;
    };
    window.addEventListener('he-workout-widget-set', onSet);

    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 82.5, reps: 7, rir: 2, ts: Date.now() },
    ]);

    expect(res.setsAdded).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].exerciseName).toBe('Жим лёжа');
    expect(seen[0].weight).toBe(82.5);
    expect(loadActiveSession()).toBeNull();

    window.removeEventListener('he-workout-widget-set', onSet);
  });

  it('если плеер не обработал событие, подход всё равно не теряется', () => {
    setWorkoutPlayerActive(true);
    const onSet = () => {
      /* handled остаётся false */
    };
    window.addEventListener('he-workout-widget-set', onSet);

    const res = applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.now() }]);

    expect(res.setsAdded).toBe(1);
    expect(setsOf('Жим лёжа')).toBe(1);
    expect(saveActiveSession).toBeTypeOf('function');

    window.removeEventListener('he-workout-widget-set', onSet);
  });

  it('при открытом плеере завершение отдаётся плееру, а не пишется виджетом', () => {
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.now() }]);
    setWorkoutPlayerActive(true);

    let requests = 0;
    let closeEvents = 0;
    const onClose = () => {
      closeEvents += 1;
    };
    const onFinishRequest = (ev: Event) => {
      requests += 1;
      ((ev as CustomEvent).detail as { handled: boolean }).handled = true;
    };
    window.addEventListener('he-workout-close', onClose);
    window.addEventListener('he-workout-finish-request', onFinishRequest);

    const res = applyWidgetQueue([{ type: 'workout_finish', ts: Date.now() }]);

    expect(requests).toBe(1);
    expect(res.workoutsFinished).toBe(1);
    // Завершал плеер: виджет не писал историю, не стирал активную сессию и не сбрасывал плеер.
    expect(loadSessions()).toHaveLength(0);
    expect(loadActiveSession()).not.toBeNull();
    expect(closeEvents).toBe(0);

    window.removeEventListener('he-workout-close', onClose);
    window.removeEventListener('he-workout-finish-request', onFinishRequest);
  });

  it('если плеер запрос завершения не обработал, виджет завершает сессию сам', () => {
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.now() }]);
    setWorkoutPlayerActive(true);

    const onFinishRequest = () => {
      /* handled остаётся false */
    };
    window.addEventListener('he-workout-finish-request', onFinishRequest);

    const res = applyWidgetQueue([{ type: 'workout_finish', ts: Date.now() }]);

    expect(res.workoutsFinished).toBe(1);
    expect(loadSessions()).toHaveLength(1);
    expect(loadActiveSession()).toBeNull();

    window.removeEventListener('he-workout-finish-request', onFinishRequest);
  });

  it('при открытом плеере старт отдаётся плееру и виджет не пишет сессию', () => {
    setWorkoutPlayerActive(true);
    let starts = 0;
    const onStart = (ev: Event) => {
      starts += 1;
      ((ev as CustomEvent).detail as { handled: boolean }).handled = true;
    };
    window.addEventListener('he-workout-widget-start', onStart);

    const res = applyWidgetQueue([{ type: 'workout_start', ts: Date.now() }]);

    expect(starts).toBe(1);
    expect(res.workoutsStarted).toBe(1);
    expect(loadActiveSession()).toBeNull();

    window.removeEventListener('he-workout-widget-start', onStart);
  });

  it('если плеер старт не обработал, виджет сам дополняет живую сессию планом', () => {
    // Подход с виджета записан раньше; упражнения дня плана в сессии ещё нет.
    applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Тяга в наклоне', weight: 60, reps: 10, rir: 2, ts: Date.now() },
    ]);
    const before = loadActiveSession();
    expect(before).not.toBeNull();
    setWorkoutPlayerActive(true);
    const onStart = () => {
      /* handled остаётся false: плеер не в фазе ready */
    };
    window.addEventListener('he-workout-widget-start', onStart);
    const plan = resolveWorkoutPlan();
    expect(plan?.exercises.length).toBeGreaterThan(0);

    const res = applyWidgetQueue([{ type: 'workout_start', ts: Date.now() }]);

    const active = loadActiveSession();
    // Живая сессия не перезапущена, записанный подход не потерян.
    expect(active?.sessionId).toBe(before?.sessionId);
    expect(active?.exercises.find((e) => e.exerciseName === 'Тяга в наклоне')?.sets).toHaveLength(1);
    // Фолбэк дотянул упражнения дня плана в живую сессию — до фикса ветка молчала.
    for (const ex of plan?.exercises ?? []) {
      expect(active?.exercises.some((e) => e.exerciseName === ex.name)).toBe(true);
    }
    // Сессия уже шла — старт не считается вторым.
    expect(res.workoutsStarted).toBe(0);

    window.removeEventListener('he-workout-widget-start', onStart);
  });

  it('подход без RPE и RIR не получает выдуманный RPE 10', () => {
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.now() }]);
    const set = loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets[0];
    expect(set?.rir).toBe(0);
    expect(set?.rpe).toBe(0);
  });

  it('RIR 2 превращается в RPE 8, а явно введённый RPE не перетирается', () => {
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 2, ts: Date.now() }]);
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 82.5, reps: 6, rpe: 9.5, ts: Date.now() }]);
    const sets = loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets || [];
    expect(sets[0]?.rpe).toBe(8);
    expect(sets[1]?.rpe).toBe(9.5);
  });
});
