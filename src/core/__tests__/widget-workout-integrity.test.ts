/**
 * widget-workout-integrity.test.ts — подходы из нативного виджета не теряются и не дублируются.
 *
 *  - вес 0 для упражнения без отягощения записывается как «свой вес», а не отвергается;
 *  - вес 0 для штанги отвергается (никакого молчаливого тоннажа 0);
 *  - завершение из виджета сообщает плееру, а история не дублируется;
 *  - пока плеер открыт, виджет не пишет в хранилище сам, а отдаёт подход плееру.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyWidgetQueue, setWorkoutPlayerActive } from '../../ui/native/widget-sync';
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
});
