/**
 * widget-sync-serial.test.ts — контракт A1/A2/A4 «сериал синков с дожимом»:
 *
 *  - синки не гоняются параллельно: второй вызов на полёте ждёт то же обещание
 *    и видит агрегат прохода, а причина перезапускает проход после него;
 *  - подход с виджета: сессия получает дату из метки времени очереди (A1);
 *  - дрень подходов/тренировок из очереди обновляет виджеты сразу (A2);
 *  - pushTrainingWidget возвращает обещание и не гоняет параллельные вызовы (A4).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addDaysIso,
  applyWidgetQueue,
  collectWorkout,
  pushTrainingWidget,
  syncAllWidgets,
} from '../../ui/native/widget-sync';
import { drainWidgetQueue, queueWaterMl, readFallbackSnapshot } from '../widget-bridge';
import { localIsoDate } from '../local-date';
import { loadActiveSession, loadSessions } from '../../engines/workout-logger.engine';

const PLAN = {
  days: [
    {
      label: 'Верх A',
      exercises: [
        {
          name: 'Жим лёжа',
          muscleGroup: 'chest',
          restSec: 120,
          targetSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 80, reps: 8, rir: 1 },
          ],
        },
        {
          name: 'Тяга блока',
          muscleGroup: 'back',
          targetSets: [{ weight: 60, reps: 12, rir: 3 }],
        },
      ],
    },
    {
      label: 'Низ A',
      exercises: [{ name: 'Присед', muscleGroup: 'legs', targetSets: [{ weight: 100, reps: 5, rir: 2 }] }],
    },
  ],
  focus: 'upper_lower',
  week: 3,
  track: 'bb',
};

const FB_QUEUE_KEY = 'he_widget_fallback_queue';

const seedPlan = () => localStorage.setItem('he_pl_runtime', JSON.stringify(PLAN));

const seedQueue = (items: Array<Record<string, unknown>>) => localStorage.setItem(FB_QUEUE_KEY, JSON.stringify(items));

const todayRow = () => {
  const log = JSON.parse(localStorage.getItem('he_water_log') || '[]');
  return log.find((e: { date: string }) => e.date === localIsoDate());
};

beforeEach(() => {
  localStorage.clear();
  seedPlan();
});

afterEach(() => {
  localStorage.clear();
});

describe('A1 сериал синков: параллельный вызов не гоняет дрень', () => {
  it('второй вызов на полёте получает тот же результат дрена, а очередь дожимается', async () => {
    await queueWaterMl(250);
    const p1 = syncAllWidgets();
    const p2 = syncAllWidgets();
    const [r1, r2] = await Promise.all([p1, p2]);

    // Оба вызова ждали один проход: второй видит снятую воду, а не нули.
    expect(r1.drainedWaterMl).toBe(250);
    expect(r2.drainedWaterMl).toBe(250);

    // «500» прилетает после прохода: следующий синк дожимает очередь.
    await queueWaterMl(500);
    const r3 = await syncAllWidgets();
    expect(r3.drainedWaterMl).toBe(500);
    expect(todayRow()?.amountMl).toBe(750);
    expect(await drainWidgetQueue()).toHaveLength(0);
  });

  it('второй вызов на полёте не теряет set_add, поставленный во время дрена', async () => {
    seedQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 82.5, reps: 7, ts: Date.now() }]);
    const p1 = syncAllWidgets();
    const p2 = syncAllWidgets();
    // Новый подход с виджета приходит, пока первый проход в полёте.
    seedQueue([{ type: 'set_add', exerciseName: 'Тяга блока', weight: 60, reps: 12, ts: Date.now() }]);
    const [r1, r2] = await Promise.all([p1, p2]);

    // Подход, пришедший во время дрена, снят тем же общим проходом:
    // оба вызывающих видят оба подхода, а не только первый (или нули).
    expect(r1.setsAdded).toBe(2);
    expect(r2.setsAdded).toBe(2);
    // Обе записи легли в живую сессию, очередь пуста.
    expect(collectWorkout().live).toBe(true);
    expect(collectWorkout().setsDone).toBe(2);
    expect(await drainWidgetQueue()).toHaveLength(0);
  });
});

describe('A1 дата сессии из метки очереди', () => {
  it('новая сессия по set_add: дата из ts — подход после полуночи не приземляется в «вчера»', () => {
    const target = addDaysIso(localIsoDate(), -1);
    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.parse(`${target}T08:15:00`) },
    ]);
    expect(res.setsAdded).toBe(1);
    expect(loadActiveSession()?.date).toBe(target);
  });

  it('живая сессия: подход «сегодня» в ней не сдвигает дату', () => {
    const target = addDaysIso(localIsoDate(), -1);
    applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.parse(`${target}T07:00:00`) },
    ]);
    expect(loadActiveSession()?.date).toBe(target);
    applyWidgetQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 82.5, reps: 7, ts: Date.now() }]);
    expect(loadActiveSession()?.date).toBe(target);
  });
});

describe('A2 push после дрена: хранилище обновлено — виджеты живые', () => {
  it('set_add из очереди: syncAllWidgets сразу обновляет live-снапшот тренировки', async () => {
    seedQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 82.5, reps: 7, ts: Date.now() }]);
    const res = await syncAllWidgets();
    expect(res.setsAdded).toBe(1);
    const snap = collectWorkout();
    expect(snap.live).toBe(true);
    expect(snap.setsDone).toBe(1);
  });

  it('workout_start из очереди: уже идущая сессия подхватывается — виджет «Проведение» живой', async () => {
    seedQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.now() }]);
    await syncAllWidgets();
    expect(loadActiveSession()).not.toBeNull();
    expect(collectWorkout().live).toBe(true);

    seedQueue([{ type: 'workout_start', ts: Date.now() }]);
    const res = await syncAllWidgets();
    // Сессия уже идёт — запуск не повторяется.
    expect(res.workoutsStarted).toBe(0);
    expect(loadActiveSession()).not.toBeNull();
    expect(collectWorkout().live).toBe(true);
  });

  it('workout_finish без плеера: сессия в журнале, активная закрыта', async () => {
    seedQueue([{ type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, ts: Date.now() }]);
    await syncAllWidgets();
    expect(loadActiveSession()).not.toBeNull();
    seedQueue([{ type: 'workout_finish', ts: Date.now() }]);
    const res = await syncAllWidgets();
    expect(res.workoutsFinished).toBe(1);
    expect(loadActiveSession()).toBeNull();
    expect(loadSessions()).toHaveLength(1);
  });
});

describe('A4 pushTrainingWidget: коалесцирует, возвращает обещание', () => {
  it('параллельный вызов в полёте разрешается сразу (коалесцирование)', async () => {
    const a = pushTrainingWidget();
    const b = pushTrainingWidget();
    const [ra, rb] = await Promise.all([a, b]);
    // Фолбэк без native-плагина — false. Второй вызов получает результат того же
    // прохода, а не выдуманное «true» (иначе вызывающий считает отправку успешной).
    expect(ra).toBe(false);
    expect(rb).toBe(false);
  });

  it('снапшот тренировки в фолбэке получает текущий снапшот: живая сессия есть', async () => {
    await pushTrainingWidget();
    const snap = readFallbackSnapshot('training') as { live: boolean; actionLabel: string };
    expect(snap.live).toBe(false);
    expect(snap.actionLabel).toBe('▶ Начать');
  });
});
