/**
 * widget-workout-integrity.test.ts — подходы из нативного виджета не теряются и не дублируются.
 *
 *  - вес 0 для упражнения без отягощения записывается как «свой вес», а не отвергается;
 *  - вес 0 для штанги отвергается (никакого молчаливого тоннажа 0);
 *  - завершение из виджета сообщает плееру, а история не дублируется;
 *  - пока плеер открыт, виджет не пишет в хранилище сам, а отдаёт подход плееру;
 *  - подход без RPE/RIR не получает выдуманный RPE 10.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysIso,
  applyWidgetQueue,
  collectCalendar,
  collectWorkout,
  resolveWorkoutPlan,
  setWorkoutPlayerActive,
} from '../../ui/native/widget-sync';
import { localIsoDate } from '../../core/local-date';
import type { QueuedItem } from '../widget-bridge';
import {
  addExerciseToSession,
  finishSession,
  loadActiveSession,
  loadSessions,
  logSet,
  saveActiveSession,
  startSession,
  summarizeActiveSession,
} from '../../engines/workout-logger.engine';

/**
 * Живая сессия, оставшаяся со вчера: `saveActiveSession` всегда ставит `savedAt: now`,
 * а виджет отличает «продолжение» от «забытого черновика» именно по нему.
 */
const seedStaleActive = (session: Record<string, unknown>, dateIso: string) => {
  localStorage.setItem(
    'he_workout_active_v1',
    JSON.stringify({ ...session, savedAt: Date.parse(`${dateIso}T20:00:00`) }),
  );
};

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
  // День плана выбирается по дню недели (`pickPlanDayIndex`), поэтому «сегодня»
  // фиксируем на понедельнике: иначе для 2-дневного плана в другие дни недели
  // резолвится другой день и число упражнений в тесте зависит от даты прогона.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 23, 10, 0, 0)); // Пн 2026-11-23, 10:00 локального времени
  localStorage.clear();
  localStorage.setItem('he_pl_runtime', JSON.stringify(PLAN));
  setWorkoutPlayerActive(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it('живую сессию прошлого дня не дополняют сегодняшним планом (путь без плеера)', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    // Сессия вчерашнего дня с подходом — единственная копия, в архив не попала.
    const base = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'row',
      name: 'Тяга штанги',
      pattern: 'horizontal_pull',
      muscleGroup: 'back',
    });
    const withSet = logSet(base, 0, { setNumber: 1, weightKg: 60, reps: 10, rpe: 8, rir: 2 }).session;
    // savedAt тоже вчера: сессию с тех пор не трогали, это брошенный черновик.
    seedStaleActive({ ...withSet, date: yesterday }, yesterday);
    const before = loadActiveSession();
    expect(before?.date).toBe(yesterday);

    // Плеер не смонтирован — так дренится очередь виджета на главном экране.
    const res = applyWidgetQueue([{ type: 'workout_start', ts: Date.now() }]);

    const active = loadActiveSession();
    expect(res.workoutsStarted).toBe(0);
    expect(active?.sessionId).toBe(before?.sessionId);
    expect(active?.date).toBe(yesterday);
    // План сегодняшнего дня в чужую сессию не дописан: иначе подходы двух дней слиплись
    // бы в одной записи с датой вчера, а отдельной записи за вчера не появилось бы.
    expect(active?.exercises.map((e) => e.exerciseName)).toEqual(['Тяга штанги']);
  });

  it('подход с виджета не дописывается в сессию вчерашнего дня', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const base = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    const withSet = logSet(base, 0, { setNumber: 1, weightKg: 75, reps: 10, rpe: 8, rir: 2 }).session;
    seedStaleActive({ ...withSet, sessionId: 'sess_yesterday', date: yesterday }, yesterday);
    // Плеер не смонтирован — так дренится очередь виджета на главном экране.
    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 2, ts: Date.now() },
    ]);

    // Вчерашняя тренировка ушла в дневник целиком и без сегодняшнего подхода.
    const journal = loadSessions();
    expect(journal).toHaveLength(1);
    expect(journal[0].date).toBe(yesterday);
    const saved = journal[0].exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets || [];
    expect(saved).toHaveLength(1);
    expect(saved[0].weightKg).toBe(75);

    // Подход лёг в сегодняшнюю сессию.
    const active = loadActiveSession();
    expect(active?.date).toBe(localIsoDate());
    expect(active?.sessionId).not.toBe('sess_yesterday');
    expect(active?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets).toHaveLength(1);
    expect(res.setsAdded).toBe(1);
    expect(res.workoutsFinished).toBe(1);
  });

  it('пустой вчерашний черновик заменяется сегодняшним подходом', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const draft = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    seedStaleActive({ ...draft, sessionId: 'sess_yesterday_draft', date: yesterday }, yesterday);

    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 2, ts: Date.now() },
    ]);

    // Черновик без подходов — не тренировка: в журнал ничего не пишем.
    expect(res.workoutsFinished).toBe(0);
    expect(loadSessions()).toHaveLength(0);
    const active = loadActiveSession();
    expect(active?.date).toBe(localIsoDate());
    expect(active?.sessionId).not.toBe('sess_yesterday_draft');
    expect(active?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets).toHaveLength(1);
    expect(res.setsAdded).toBe(1);
  });

  it('подход без RPE и RIR не получает выдуманный RPE 10', () => {
    // Java шлёт `rirMissing: true`, когда поле RIR не трогали (`rir: 0` — заполнитель).
    applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rirMissing: true, ts: Date.now() },
    ]);
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

  it('тап старта без живой сессии создаёт сессию дня (подходов ещё нет)', () => {
    const res = applyWidgetQueue([{ type: 'workout_start', ts: Date.now() }]);

    expect(res.workoutsStarted).toBe(1);
    const active = loadActiveSession();
    expect(active).not.toBeNull();
    expect(active?.date).toBe(localIsoDate());
    // Сессия собрана из плана дня: упражнения на месте, подходов пока ноль.
    expect(active?.exercises.map((e) => e.exerciseName)).toEqual(['Жим лёжа', 'Подтягивания']);
    expect(active?.exercises.reduce((n, e) => n + e.sets.length, 0)).toBe(0);
    // Домашняя карточка/виджет должны видеть явный старт как живую тренировку:
    // иначе они продолжают предлагать «▶ Начать» при уже идущей сессии.
    // Без plannedSets — как домашняя карточка: план дня уже лежит в plannedSetsTotal.
    const live = summarizeActiveSession(active);
    expect(live).not.toBeNull();
    expect(live?.setsDone).toBe(0);
    expect(live?.setsPlanned).toBeGreaterThan(0);
  });

  it('виджет не считает идущей брошенную вчерашнюю сессию без подходов', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const draft = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    expect(
      saveActiveSession({ ...draft, sessionId: 'sess_yesterday_live', date: yesterday }, 6, { allowEmpty: true }),
    ).toBe(true);

    const snap = collectWorkout();
    // Снапшот виджета и домашняя карточка живут по одному правилу: пустой явный
    // старт идёт только в свой день, иначе «● Идёт · 0/6» висит до новой тренировки.
    expect(snap.live).toBe(false);
    expect(snap.startedAt).toBe('');
    expect(snap.setsDone).toBe(0);
    expect(summarizeActiveSession(loadActiveSession())).toBeNull();
  });

  it('пустой черновик прошлого дня заменяется сегодняшним стартом', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    // Вчерашний «старт» без единого подхода: такой черновик не тренировка.
    const draft = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'row',
      name: 'Тяга штанги',
      pattern: 'horizontal_pull',
      muscleGroup: 'back',
    });
    // sessionId явный: fake timers держат Date.now(), и startSession в том же «мгновении»
    // выдал бы тот же id, что и сегодняшний старт.
    expect(
      saveActiveSession({ ...draft, sessionId: 'sess_yesterday_draft', date: yesterday }, 0, { allowEmpty: true }),
    ).toBe(true);
    const before = loadActiveSession();
    expect(before?.date).toBe(yesterday);
    // Брошенный вчерашний старт без подходов не «идёт» на домашней карточке.
    expect(summarizeActiveSession(before)).toBeNull();

    const res = applyWidgetQueue([{ type: 'workout_start', ts: Date.now() }]);

    expect(res.workoutsStarted).toBe(1);
    const active = loadActiveSession();
    expect(active).not.toBeNull();
    expect(active?.date).toBe(localIsoDate());
    expect(active?.sessionId).not.toBe(before?.sessionId);
    expect(active?.exercises.map((e) => e.exerciseName)).toEqual(['Жим лёжа', 'Подтягивания']);
  });

  it('сессию, начатую вчера и обновлённую сегодня, «Начать» не рвёт на две записи', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const base = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'row',
      name: 'Тяга штанги',
      pattern: 'horizontal_pull',
      muscleGroup: 'back',
    });
    const withSet = logSet(base, 0, { setNumber: 1, weightKg: 60, reps: 10, rpe: 8, rir: 2 }).session;
    // saveActiveSession ставит savedAt = сейчас: запись обновлялась сегодня, хотя
    // дата старта — вчера. Это продолжение, а не брошенный черновик.
    expect(saveActiveSession({ ...withSet, sessionId: 'sess_yesterday_cont', date: yesterday }, 0)).toBe(true);

    const res = applyWidgetQueue([{ type: 'workout_start', ts: Date.now() }]);

    // Новой тренировки не начато: план дня дописан в ту же запись.
    expect(res.workoutsStarted).toBe(0);
    const active = loadActiveSession();
    expect(active?.sessionId).toBe('sess_yesterday_cont');
    expect(active?.date).toBe(yesterday);
    expect(active?.exercises.map((e) => e.exerciseName)).toEqual(
      expect.arrayContaining(['Тяга штанги', 'Жим лёжа', 'Подтягивания']),
    );
  });

  it('подход без RIR не выдаёт RIR 0 в снапшоте', () => {
    const items: QueuedItem[] = [
      {
        type: 'set_add',
        exerciseName: 'Жим лёжа',
        weight: 80,
        reps: 8,
        rpe: 0,
        rir: 0,
        rirMissing: true,
        ts: Date.now(),
      },
    ];
    applyWidgetQueue(items);

    // В снапшоте «нет данных» (null), а не 0 («до отказа»).
    expect(collectWorkout().exercises[0].rir).toBeNull();
    const set = loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets[0];
    expect(set?.rir).toBe(0); // заполнитель обязательного поля
    expect(set?.rirMissing).toBe(true);
    expect(set?.rpe).toBe(0); // RPE из несуществующего RIR не синтезируется
  });

  it('явный RIR 0 остаётся 0 и не помечен как отсутствующий', () => {
    const items: QueuedItem[] = [
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 0, rirMissing: false, ts: Date.now() },
    ];
    applyWidgetQueue(items);

    const set = loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets[0];
    expect(set?.rir).toBe(0);
    expect(set?.rirMissing).toBeUndefined();
    // Явный 0 — «до отказа»: RPE выводится как 10 − RIR, и снапшот показывает 0, а не null.
    expect(set?.rpe).toBe(10);
    expect(collectWorkout().exercises[0].rir).toBe(0);
  });

  it('элемент очереди от старой APK: rir 0 без метки — «не вводили»', () => {
    // Поле `rirMissing` появилось вместе с этой сборкой: у накопленных элементов его нет,
    // а 0 там тоже был заполнителем. Иначе подход без оценки уехал бы в sRPE как «до отказа».
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 0, ts: Date.now() }]);
    const set = loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets[0];
    expect(set?.rirMissing).toBe(true);
    expect(set?.rpe).toBe(0);
  });

  it('элемент очереди от старой APK с явным нулём: rir 0 + rpe 10 — измерение, а не «не вводили»', () => {
    // Метки `rirMissing` у старых сборок нет, но явный RIR 0 они отличали введённым
    // RPE 10: это «до отказа», и подход не должен попасть в статистику как без оценки.
    applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 0, rpe: 10, ts: Date.now() },
    ]);
    const set = loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets[0];
    expect(set?.rir).toBe(0);
    expect(set?.rpe).toBe(10);
    expect(set?.rirMissing).toBeUndefined();
  });

  it('реле подхода несёт rirMissing', () => {
    setWorkoutPlayerActive(true);
    const seen: Array<{ rirMissing?: boolean }> = [];
    const onSet = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { rirMissing?: boolean; handled: boolean };
      seen.push(detail);
      detail.handled = true;
    };
    window.addEventListener('he-workout-widget-set', onSet);

    const items: QueuedItem[] = [
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 0, rirMissing: true, ts: Date.now() },
    ];
    const res = applyWidgetQueue(items);

    window.removeEventListener('he-workout-widget-set', onSet);
    expect(res.setsAdded).toBe(1);
    expect(seen).toHaveLength(1);
    // Плеер — единственный писатель: без признака он запишет RIR 0 как «до отказа».
    expect(seen[0].rirMissing).toBe(true);
  });

  it('завершение пустой начатой сессии не пишет запись в журнал и снимает живой ключ', () => {
    const started = applyWidgetQueue([{ type: 'workout_start', ts: Date.now() }]);
    expect(started.workoutsStarted).toBe(1);
    expect(loadActiveSession()).not.toBeNull();

    let closeEvents = 0;
    const onClose = () => {
      closeEvents += 1;
    };
    window.addEventListener('he-workout-close', onClose);
    const res = applyWidgetQueue([{ type: 'workout_finish', ts: Date.now() }]);
    window.removeEventListener('he-workout-close', onClose);

    expect(res.workoutsFinished).toBe(1);
    expect(loadSessions()).toHaveLength(0);
    expect(loadActiveSession()).toBeNull();
    // Плеер закрывается, как при успешном завершении, — но записи в журнал нет.
    expect(closeEvents).toBe(1);
  });
});

/**
 * День плана на дату берётся из единого движка `training-day.engine`:
 * `he_pl_runtime.startDate` — якорь, старые payload'ы без него идут прежним путём.
 */
describe('виджет: день плана на дату по якорю startDate', () => {
  const planOf = (labels: string[]) => ({
    days: labels.map((label) => ({
      label,
      exercises: [{ name: `Упражнение ${label}`, muscleGroup: 'chest', targetSets: [{ weight: 50, reps: 8, rir: 2 }] }],
    })),
    focus: 'upper',
    week: 1,
    track: 'bb',
  });

  const seedTraining = (training: Record<string, unknown>) => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { training } }));
  };

  // 3 тренировки в неделю: Пн / Ср / Пт.
  const threePerWeek = {
    daysPerWeek: 3,
    schedule: { enabled: true, scheduleType: 'weekly', weeklyDays: [true, false, true, false, true, false, false] },
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('план из 5 дней и 3 тренировки в неделю: недели дают дни 1,2,3 затем 4,5', () => {
    localStorage.setItem(
      'he_pl_runtime',
      JSON.stringify({ ...planOf(['День 1', 'День 2', 'День 3', 'День 4', 'День 5']), startDate: '2026-01-05' }),
    );
    seedTraining(threePerWeek);

    // 2026-01-05 — понедельник, дальше Ср/Пт первой недели и Пн/Ср второй.
    const labels = ['2026-01-05', '2026-01-07', '2026-01-09', '2026-01-12', '2026-01-14'].map(
      (iso) => resolveWorkoutPlan(iso)?.label,
    );
    expect(labels).toEqual(['День 1', 'День 2', 'День 3', 'День 4', 'День 5']);
  });

  it('pattern «2 через 1»: в день отдыха цикла календарь тренировку не объявляет, план — следующая', () => {
    // 2026-01-05 (Пн) — старт: 5 и 6 января тренировки, 7 января — отдых.
    localStorage.setItem('he_pl_runtime', JSON.stringify({ ...planOf(['A', 'B', 'C']), startDate: '2026-01-05' }));
    seedTraining({
      daysPerWeek: 3,
      schedule: { enabled: true, scheduleType: 'pattern', pattern: { work: 2, off: 1 } },
    });
    vi.setSystemTime(new Date(2026, 0, 7, 10, 0, 0)); // Ср 2026-01-07, день отдыха цикла

    const cal = collectCalendar();
    expect(cal.items.some((i) => i.id === 'tr:2026-01-06')).toBe(true);
    expect(cal.items.some((i) => i.id === 'tr:2026-01-07')).toBe(false);
    expect(cal.items.some((i) => i.id === 'tr:2026-01-08')).toBe(true);

    const plan = resolveWorkoutPlan('2026-01-07');
    expect(plan?.dayIndex).toBe(2);
    expect(plan?.label).toBe('C');
  });

  it('payload без startDate: прежнее поведение по дню недели', () => {
    localStorage.setItem('he_pl_runtime', JSON.stringify(planOf(['A', 'B', 'C', 'D', 'E'])));
    seedTraining(threePerWeek);

    expect(resolveWorkoutPlan('2026-01-05')?.dayIndex).toBe(0); // Пн
    expect(resolveWorkoutPlan('2026-01-07')?.dayIndex).toBe(1); // Ср
    expect(resolveWorkoutPlan('2026-01-09')?.dayIndex).toBe(2); // Пт
    // Без якоря новая неделя снова начинается с первого дня плана.
    expect(resolveWorkoutPlan('2026-01-12')?.dayIndex).toBe(0);
  });

  it('пик-неделя: пустой день («отдых») остаётся слотом плана — индекс как у плеера', () => {
    // Так пишет SRCBBScreen: 4 слота, два из них без упражнений (тапёр пик-недели).
    localStorage.setItem(
      'he_pl_runtime',
      JSON.stringify({
        days: [
          { label: 'Д1 грудь', exercises: [{ name: 'Жим', targetSets: [{ weight: 50, reps: 8, rir: 2 }] }] },
          { label: 'Д2 отдых', exercises: [] },
          { label: 'Д3 спина', exercises: [{ name: 'Тяга', targetSets: [{ weight: 60, reps: 8, rir: 2 }] }] },
          { label: 'Д4 отдых', exercises: [] },
        ],
        focus: 'BB',
        week: 1,
        track: 'bb',
        startDate: '2026-01-05',
      }),
    );
    seedTraining(threePerWeek);
    // Раньше виджет выбрасывал пустые дни и на третьей тренировке недели
    // показывал слот 1 («спина») вместо слота 2 — индекс расходился с плеером.
    expect(resolveWorkoutPlan('2026-01-05')).toMatchObject({ dayIndex: 0, planDays: 4, label: 'Д1 грудь' });
    expect(resolveWorkoutPlan('2026-01-07')).toMatchObject({ dayIndex: 1, label: 'Д2 отдых' });
    expect(resolveWorkoutPlan('2026-01-09')).toMatchObject({ dayIndex: 2, label: 'Д3 спина' });
  });
});

describe('виджет: RPE без RIR и реле при открытом плеере', () => {
  it('введённый RPE без RIR — измерение: RIR выводится из него, метка не пишется', () => {
    // Так шлёт Android: поле RIR не трогали (rirMissing), но RPE ввели.
    applyWidgetQueue([
      {
        type: 'set_add',
        exerciseName: 'Жим лёжа',
        weight: 80,
        reps: 8,
        rpe: 8,
        rir: 0,
        rirMissing: true,
        ts: Date.now(),
      },
    ]);
    const set = loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets[0];
    expect(set?.rpe).toBe(8);
    expect(set?.rir).toBe(2);
    expect(set?.rirMissing).toBeUndefined();
  });

  it('плеер открыт: подход уходит в живую сессию, вчерашняя копия не архивируется', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const base = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    const withSet = logSet(base, 0, { setNumber: 1, weightKg: 75, reps: 10, rpe: 8, rir: 2 }).session;
    seedStaleActive({ ...withSet, sessionId: 'sess_yesterday', date: yesterday }, yesterday);
    setWorkoutPlayerActive(true);

    const relayed: Array<{ handled: boolean; rir: number; rirMissing: boolean }> = [];
    const onSet = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      relayed.push(d);
      d.handled = true;
    };
    window.addEventListener('he-workout-widget-set', onSet);
    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 2, ts: Date.now() },
    ]);
    window.removeEventListener('he-workout-widget-set', onSet);

    // Плеер — единственный писатель: подход отдан ему ДО архивации чужой сессии.
    expect(relayed).toHaveLength(1);
    expect(res.setsAdded).toBe(1);
    expect(res.workoutsFinished).toBe(0);
    expect(loadSessions()).toHaveLength(0);
    expect(loadActiveSession()?.sessionId).toBe('sess_yesterday');
  });

  it('архив вчерашней сессии не лёг (квота): подход уходит в буфер, журнал и черновик целы', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const base = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    const withSet = logSet(base, 0, { setNumber: 1, weightKg: 75, reps: 10, rpe: 8, rir: 2 }).session;
    seedStaleActive({ ...withSet, sessionId: 'sess_yesterday', date: yesterday }, yesterday);

    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === 'he_workout_log_v2') {
        const err: any = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      realSetItem(key, value);
    });

    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 2, ts: Date.now() },
    ]);

    // Вчерашний день не получил сегодняшний подход, а подход не приземлился в никуда:
    // счётчики молчат, журнал пуст, вчерашняя живая сессия не тронута.
    expect(res.setsAdded).toBe(0);
    expect(res.workoutsFinished).toBe(0);
    expect(loadSessions()).toHaveLength(0);
    const active = loadActiveSession();
    expect(active?.sessionId).toBe('sess_yesterday');
    expect(active?.exercises[0]?.sets).toHaveLength(1);

    // Ключевое: подход не выброшен. Нативная очередь уже выдрана, поэтому элемент
    // лежит в JS-буфере и повторяется на следующем синке.
    expect(JSON.parse(localStorage.getItem('he_widget_set_retry_v1') || '[]')).toHaveLength(1);
  });

  it('отложенный подход из буфера применяется, когда хранилище освободилось', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const base = addExerciseToSession(startSession('Вчерашняя', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    const withSet = logSet(base, 0, { setNumber: 1, weightKg: 75, reps: 10, rpe: 8, rir: 2 }).session;
    seedStaleActive({ ...withSet, sessionId: 'sess_yesterday', date: yesterday }, yesterday);

    const realSetItem = localStorage.setItem.bind(localStorage);
    const quota = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === 'he_workout_log_v2') {
        const err: any = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      realSetItem(key, value);
    });
    const item: QueuedItem = { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 2, ts: Date.now() };
    expect(applyWidgetQueue([item]).setsAdded).toBe(0);

    // Квота освободилась: пустая очередь тоже должна разобрать буфер повторных попыток.
    quota.mockRestore();
    const res = applyWidgetQueue([]);

    expect(res.workoutsFinished).toBe(1);
    expect(res.setsAdded).toBe(1);
    expect(loadSessions()).toHaveLength(1);
    const active = loadActiveSession();
    expect(active?.date).toBe(localIsoDate());
    expect(active?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets).toHaveLength(1);
    // Буфер пуст — повтор не задваивает подход на каждом синке.
    expect(localStorage.getItem('he_widget_set_retry_v1')).toBeNull();
  });

  it('провал записи живой сессии: подход ждёт в буфере, а не теряется', () => {
    const realSetItem = localStorage.setItem.bind(localStorage);
    const quota = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === 'he_workout_active_v1') {
        const err: any = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      realSetItem(key, value);
    });

    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 2, ts: Date.now() },
    ]);

    // Подход не записан — и «+1 подход» не врём; живой сессии нет.
    expect(res.setsAdded).toBe(0);
    expect(loadActiveSession()).toBeNull();
    expect(JSON.parse(localStorage.getItem('he_widget_set_retry_v1') || '[]')).toHaveLength(1);

    quota.mockRestore();
    const retry = applyWidgetQueue([]);
    expect(retry.setsAdded).toBe(1);
    expect(loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets).toHaveLength(1);
  });

  it('повтор из буфера и тот же элемент в очереди не задваивают подход', () => {
    const realSetItem = localStorage.setItem.bind(localStorage);
    const quota = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === 'he_workout_active_v1') {
        const err: any = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      realSetItem(key, value);
    });
    const item: QueuedItem = {
      type: 'set_add',
      exerciseName: 'Жим лёжа',
      weight: 80,
      reps: 8,
      rir: 2,
      ts: Date.now(),
    };
    expect(applyWidgetQueue([item]).setsAdded).toBe(0);

    // Тот же элемент пришёл повторно (нативная сторона не успела снять очередь) —
    // сигнатура совпала, поэтому подход один.
    quota.mockRestore();
    const res = applyWidgetQueue([item]);
    expect(res.setsAdded).toBe(1);
    expect(loadActiveSession()?.exercises.find((e) => e.exerciseName === 'Жим лёжа')?.sets).toHaveLength(1);
  });

  it('подход прошлого дня не попадает в сегодняшнюю тренировку и не трогает её', () => {
    const today = localIsoDate();
    const yesterday = addDaysIso(today, -1);
    let live = addExerciseToSession(startSession('День A', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    live = logSet(live, 0, { setNumber: 1, weightKg: 70, reps: 10, rpe: 8, rir: 2 }).session;
    saveActiveSession({ ...live, sessionId: 'sess_today', date: today, startTime: '09:00' }, 2);

    const res = applyWidgetQueue([
      {
        type: 'set_add',
        exerciseName: 'Присед',
        weight: 100,
        reps: 5,
        rpe: 8,
        rir: 2,
        ts: Date.parse(`${yesterday}T23:58:00`),
      },
    ]);

    // Сегодняшняя живая тренировка на месте: ни архива, ни лишнего подхода.
    const active = loadActiveSession();
    expect(active?.sessionId).toBe('sess_today');
    expect(active?.exercises.flatMap((e) => e.sets)).toHaveLength(1);
    expect(res.workoutsFinished).toBe(0);
    expect(res.workoutsStarted).toBe(0);
    // Подход лёг в журнал своей датой — сегодняшний тоннаж и 7-дневный объём его не видят.
    const saved = loadSessions();
    expect(saved).toHaveLength(1);
    expect(saved[0].date).toBe(yesterday);
    const withSets = saved[0].exercises.filter((e) => (e.sets || []).length > 0);
    expect(withSets).toHaveLength(1);
    expect(withSets[0].exerciseName).toBe('Присед');
    expect(withSets[0].sets).toHaveLength(1);
    expect(res.setsAdded).toBe(1);
  });

  it('повтор записи прошлого дня идемпотентен: одна запись и один подход, без «+1»', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const item: QueuedItem = {
      type: 'set_add',
      exerciseName: 'Присед',
      weight: 100,
      reps: 5,
      rir: 2,
      ts: Date.parse(`${yesterday}T23:58:00`),
    };
    expect(applyWidgetQueue([item]).setsAdded).toBe(1);
    // Тот же элемент пришёл ещё раз (буфер повтора + очередь): подход уже в журнале,
    // поэтому счётчик молчит — иначе виджет отчитался бы о втором подходе.
    expect(applyWidgetQueue([item]).setsAdded).toBe(0);
    const saved = loadSessions();
    expect(saved).toHaveLength(1);
    expect(saved[0].exercises.flatMap((e) => e.sets)).toHaveLength(1);
  });

  it('два подхода одного прошлого дня ложатся в одну запись, а не в две', () => {
    const yesterday = addDaysIso(localIsoDate(), -1);
    const at = (hhmm: string): QueuedItem => ({
      type: 'set_add',
      exerciseName: 'Присед',
      weight: 100,
      reps: 5,
      rir: 2,
      ts: Date.parse(`${yesterday}T${hhmm}:00`),
    });
    expect(applyWidgetQueue([at('23:10')]).setsAdded).toBe(1);
    expect(applyWidgetQueue([at('23:58')]).setsAdded).toBe(1);
    const saved = loadSessions();
    expect(saved).toHaveLength(1);
    expect(saved[0].date).toBe(yesterday);
    expect(saved[0].exercises.find((e) => e.exerciseName === 'Присед')?.sets).toHaveLength(2);
  });

  it('плеер открыт: прошлый подход уходит в журнал, реле не трогает живую сессию', () => {
    const today = localIsoDate();
    const yesterday = addDaysIso(today, -1);
    let live = addExerciseToSession(startSession('День A', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    live = logSet(live, 0, { setNumber: 1, weightKg: 70, reps: 10, rpe: 8, rir: 2 }).session;
    saveActiveSession({ ...live, sessionId: 'sess_today', date: today, startTime: '09:00' }, 2);

    const relayed: Array<{ handled: boolean }> = [];
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail as { handled: boolean };
      relayed.push(detail);
      detail.handled = true;
    };
    window.addEventListener('he-workout-widget-set', listener);
    setWorkoutPlayerActive(true);
    try {
      const res = applyWidgetQueue([
        {
          type: 'set_add',
          exerciseName: 'Присед',
          weight: 100,
          reps: 5,
          rpe: 8,
          rir: 2,
          ts: Date.parse(`${yesterday}T23:58:00`),
        },
      ]);
      // Реле прошлый подход не получило — он не попал в сегодняшнюю сессию.
      expect(relayed).toHaveLength(0);
      expect(res.setsAdded).toBe(1);
      const active = loadActiveSession();
      expect(active?.sessionId).toBe('sess_today');
      expect(active?.exercises.flatMap((e) => e.sets)).toHaveLength(1);
      const saved = loadSessions();
      expect(saved).toHaveLength(1);
      expect(saved[0].date).toBe(yesterday);
    } finally {
      window.removeEventListener('he-workout-widget-set', listener);
      setWorkoutPlayerActive(false);
    }
  });
});
