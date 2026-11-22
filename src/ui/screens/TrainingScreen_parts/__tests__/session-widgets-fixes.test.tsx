/** session-widgets-fixes: пульт считает план (а не сделанное), пустые состояния,
 *  строки нативного виджета и подход по упражнению вне плана. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { saveActiveSession, loadActiveSession, type WorkoutSession } from '../../../../engines/workout-logger.engine';
import { WorkoutMiniPult } from '../WorkoutSessionWidgets';
import { WORKOUT_WIDGET_ROWS, applyWidgetQueue, collectWorkout, pushWorkoutWidget } from '../../../native/widget-sync';

function liveSession(exerciseName = 'Жим лёжа', sets = 1): WorkoutSession {
  return {
    sessionId: 'sess_widget',
    date: '2026-11-23',
    startTime: '10:00',
    endTime: '',
    durationMin: 0,
    focus: 'Верх A',
    exercises: [
      {
        exerciseId: 'bench',
        exerciseName,
        pattern: 'horizontal_push',
        muscleGroup: 'chest',
        order: 1,
        sets: Array.from({ length: sets }, (_, i) => ({
          setNumber: i + 1,
          weightKg: 80,
          reps: 8,
          rpe: 8,
          rir: 2,
          isPR: false,
          notes: '',
        })),
        totalVolume: sets * 640,
        best1RM: 100,
        avgRPE: 8,
      },
    ],
    totalVolume: sets * 640,
    totalSets: sets,
    totalReps: sets * 8,
    avgIntensity: 8,
    prCount: 0,
    notes: '',
    weekNumber: 3,
    mesocycleWeek: 3,
  };
}

/** План из N упражнений в каждом дне: первое — «Жим лёжа» на 2 подхода. */
function seedPlan(exerciseCount = 2, targetDays = 1) {
  const days = Array.from({ length: targetDays }, (_, d) => ({
    label: `День ${d + 1}`,
    exercises: Array.from({ length: exerciseCount }, (_, i) => ({
      name: i === 0 ? 'Жим лёжа' : `Упражнение ${i + 1}`,
      muscleGroup: 'chest',
      targetSets:
        i === 0
          ? [
              { weight: 80, reps: 8, rir: 2 },
              { weight: 80, reps: 8, rir: 1 },
            ]
          : [{ weight: 60, reps: 10, rir: 3 }],
    })),
  }));
  localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: 'upper_lower', week: 3, track: 'bb' }));
}

const emptyApply = {
  waterMl: 0,
  waterRemovedMl: 0,
  foods: 0,
  foodsRemoved: 0,
  foodsEdited: 0,
  tasks: 0,
  tasksAdded: 0,
  notesAdded: 0,
};

describe('пульт: прогресс по плану, а не по сделанному', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('живая сессия без plannedSetsTotal делит на подходы плана, а не на сделанные', () => {
    seedPlan(2);
    // Сессия сохранена без планового числа (как бывает после старых сборок).
    saveActiveSession(liveSession('Жим лёжа', 1));
    expect(loadActiveSession()?.plannedSetsTotal).toBeUndefined();

    const { container, unmount } = render(<WorkoutMiniPult />);
    const pult = container.querySelector('[data-widget="workout-pult"]') as HTMLElement;
    expect(pult).not.toBeNull();
    const bar = pult.querySelector('[role="progressbar"]') as HTMLElement;
    // 1 подход из 2 плановых = 50%; раньше делили на сделанное (1/1 = 100%).
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(pult.getAttribute('aria-label')).toContain('50');
    unmount();
  });

  it('без сессии и истории: «Готов к тренировке» + рабочая кнопка старта', () => {
    const { container, unmount } = render(<WorkoutMiniPult />);
    const pult = container.querySelector('[data-widget="workout-pult"]') as HTMLElement;
    expect(pult.textContent).toContain('Готов к тренировке');
    expect(pult.textContent).toContain('Сессия не начата');
    expect(pult.textContent).not.toContain('Тренировки пока нет');
    expect(pult.textContent).not.toContain('0/0');
    expect(pult.querySelector('[data-act="pult-start"]')).not.toBeNull();
    unmount();
  });
});

describe('нативный виджет проведения: строки и живой пуш', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('лимит строк — 5, как ROW_IDS 1..5 на Android', () => {
    seedPlan(7);
    expect(WORKOUT_WIDGET_ROWS).toBe(5);
    expect(collectWorkout().exercises).toHaveLength(WORKOUT_WIDGET_ROWS);
  });

  it('pushWorkoutWidget пересобирает только workout-снапшот и не гоняет параллельные вызовы', async () => {
    seedPlan(7);
    const real = globalThis.localStorage;
    let writes = 0;
    const fake = {
      getItem: (key: string) => real.getItem(key),
      setItem: (key: string, value: string) => {
        if (key === 'he_widget_fallback_workout') writes += 1;
        real.setItem(key, value);
      },
      removeItem: (key: string) => real.removeItem(key),
      clear: () => real.clear(),
      key: (i: number) => real.key(i),
      get length() {
        return real.length;
      },
    } as unknown as Storage;
    const spy = vi.spyOn(globalThis, 'localStorage', 'get').mockReturnValue(fake);
    try {
      const [a, b] = await Promise.all([pushWorkoutWidget(), pushWorkoutWidget()]);
      expect(typeof a).toBe('boolean');
      expect(typeof b).toBe('boolean');
      // Второй вызов отсечён флагом in-flight: снапшот записан один раз.
      expect(writes).toBe(1);
    } finally {
      spy.mockRestore();
    }
    // Флаг снят после завершения — следующий пуш снова доходит до моста.
    const snapshot = JSON.parse(localStorage.getItem('he_widget_fallback_workout') || 'null');
    expect(snapshot.exercises).toHaveLength(WORKOUT_WIDGET_ROWS);
    await expect(pushWorkoutWidget()).resolves.toBe(false);
  });
});

describe('подход с виджета по упражнению вне плана', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('упражнения нет в плане — добавляется в сессию и подход записывается', () => {
    seedPlan(2);
    const applied = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Тяга в наклоне', weight: 60, reps: 10, rir: 2, ts: Date.now() },
    ]);
    expect(applied).toMatchObject({ ...emptyApply, setsAdded: 1, workoutsStarted: 1 });

    const active = loadActiveSession();
    expect(active).not.toBeNull();
    const added = active!.exercises.find((e) => e.exerciseName === 'Тяга в наклоне');
    expect(added).toBeDefined();
    expect(added!.sets).toHaveLength(1);
    expect(added!.sets[0].weightKg).toBe(60);
    expect(added!.sets[0].reps).toBe(10);
    // План дня по-прежнему в сессии: подход не вытеснил упражнения плана.
    expect(active!.exercises.length).toBe(3);
  });

  it('сессии нет вовсе и плана нет — создаётся сессия с этим упражнением', () => {
    const applied = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Приседания', weight: 100, reps: 5, rir: 1, ts: Date.now() },
    ]);
    expect(applied).toMatchObject({ ...emptyApply, setsAdded: 1, workoutsStarted: 1 });

    const active = loadActiveSession();
    expect(active).not.toBeNull();
    expect(active!.exercises).toHaveLength(1);
    expect(active!.exercises[0].exerciseName).toBe('Приседания');
    expect(active!.exercises[0].sets[0].weightKg).toBe(100);
    expect(active!.totalSets).toBe(1);
  });

  it('невалидный подход не мутирует: ни сессии, ни подхода', () => {
    const applied = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Приседания', weight: 0, reps: 5, ts: Date.now() },
    ]);
    expect(applied).toMatchObject({ ...emptyApply, setsAdded: 0, workoutsStarted: 0 });
    expect(localStorage.getItem('he_workout_active_v1')).toBeNull();
  });

  it('живая сессия уже идёт — упражнение добавляется в неё, сессия не перезапускается', () => {
    saveActiveSession(liveSession('Жим лёжа', 1), 2);
    const before = loadActiveSession()!;
    const applied = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Бицепс', weight: 20, reps: 12, rir: 1, ts: Date.now() },
    ]);
    expect(applied).toMatchObject({ ...emptyApply, setsAdded: 1, workoutsStarted: 0 });

    const after = loadActiveSession();
    expect(after!.sessionId).toBe(before.sessionId);
    expect(after!.exercises.map((e) => e.exerciseName)).toEqual(['Жим лёжа', 'Бицепс']);
  });
});
