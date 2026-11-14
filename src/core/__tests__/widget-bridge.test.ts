/**
 * widget-bridge.test.ts — JS-фасад виджетов APK.
 * Вне native (jsdom = web) плагин недоступен: проверяем фолбэк-пути
 * (снапшоты/очередь в localStorage), чистые хелперы и разбор очереди
 * виджет -> дневники. Ни один вызов не бросает наружу.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  formatTimer,
  clampPct,
  clampMl,
  parseQueueItems,
  queueWaterMl,
  queueFood,
  queueWidgetSize,
  drainWidgetQueue,
  syncTrainingWidget,
  syncComplianceWidget,
  syncNutritionWidget,
  consumeWidgetLaunchTarget,
  requestPinWidget,
  widgetTimerCommand,
  getWidgetTimerState,
  readFallbackSnapshot,
  resetWidgetBridgeCache,
} from '../widget-bridge';
import { applyWidgetQueue } from '../../ui/native/widget-sync';
import { localIsoDate } from '../local-date';

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  resetWidgetBridgeCache();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  resetWidgetBridgeCache();
});

describe('чистые хелперы', () => {
  it('1. formatTimer MM:SS', () => {
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(90)).toBe('01:30');
    expect(formatTimer(65)).toBe('01:05');
    expect(formatTimer(3600)).toBe('60:00');
    expect(formatTimer(-5)).toBe('00:00');
    expect(formatTimer(NaN)).toBe('00:00');
  });

  it('2. clampPct/clampMl', () => {
    expect(clampPct(150)).toBe(100);
    expect(clampPct(-3)).toBe(0);
    expect(clampPct(72.4)).toBe(72);
    expect(clampPct(NaN)).toBe(0);
    expect(clampMl(0)).toBe(250);
    expect(clampMl(-10)).toBe(250);
    expect(clampMl(5000)).toBe(2000);
    expect(clampMl(330)).toBe(330);
  });

  it('3. parseQueueItems фильтрует мусор', () => {
    expect(parseQueueItems('not-json')).toEqual([]);
    expect(parseQueueItems('{"a":1}')).toEqual([]);
    expect(
      parseQueueItems(
        JSON.stringify([
          { type: 'water', ml: 250, ts: 1 },
          { type: 'food', name: 'X', ts: 2 },
          { type: 'unknown' },
          null,
          42,
        ]),
      ),
    ).toEqual([
      { type: 'water', ml: 250, ts: 1 },
      { type: 'food', name: 'X', ts: 2 },
    ]);
  });
});

describe('фолбэк вне native', () => {
  it('4. очередь воды копится и дренируется с очисткой', async () => {
    expect(await queueWidgetSize()).toBe(0);
    expect(await queueWaterMl(250)).toBe(1);
    expect(await queueWaterMl(500)).toBe(2);
    expect(await queueWidgetSize()).toBe(2);
    const items = await drainWidgetQueue();
    expect(items.length).toBe(2);
    expect(items[0].type).toBe('water');
    expect(await queueWidgetSize()).toBe(0);
    expect(await drainWidgetQueue()).toEqual([]);
  });

  it('5. очередь еды режет невалидные значения', async () => {
    await queueFood({ name: 'Творог', kcal: 240, p: 34, f: 10, c: 6, meal: 'snack' });
    await queueFood({ name: '', kcal: NaN, p: -1, f: 0, c: 0, meal: 'lunch' });
    const items = await drainWidgetQueue();
    expect(items.length).toBe(2);
    expect(items[1].kcal).toBe(0);
    expect(items[1].p).toBe(0);
  });

  it('6. снапшоты пишутся в фолбэк и читаются', async () => {
    expect(await syncTrainingWidget({ title: 'A', subtitle: 'B', meta: 'C' })).toBe(false);
    expect(await syncComplianceWidget({ pct: 142, label: 'L', detail: 'D' })).toBe(false);
    expect(await syncNutritionWidget({
      kcal: 1, targetKcal: 2, protein: 3, fat: 4, carbs: 5,
      targetProtein: 6, targetFat: 7, targetCarbs: 8,
      waterMl: 9, waterTargetMl: 10,
    })).toBe(false);
    const n = readFallbackSnapshot('nutrition') as {
      kcal: number; protein: number; fat: number; carbs: number; waterMl: number;
      targetProtein: number; targetFat: number; targetCarbs: number; waterTargetMl: number;
    };
    expect(n.kcal).toBe(1);
    expect(n.fat).toBe(4);
    expect(n.carbs).toBe(5);
    expect(n.targetProtein).toBe(6);
    expect(n.targetCarbs).toBe(8);
    expect(n.waterTargetMl).toBe(10);
    const t = readFallbackSnapshot('training') as { title: string };
    expect(t.title).toBe('A');
    const c = readFallbackSnapshot('compliance') as { pct: number };
    expect(c.pct).toBe(100);
  });

  it('7. launch target и pin вне native — безопасные no-op', async () => {
    expect(await consumeWidgetLaunchTarget()).toBeNull();
    expect(await requestPinWidget('timer')).toEqual({ requested: false, reason: 'not-native' });
  });

  it('8. таймер вне native возвращает фолбэк без бросков', async () => {
    expect(await widgetTimerCommand('preset', 60)).toEqual({
      running: true,
      remainingSec: 60,
      durationSec: 60,
    });
    expect(await getWidgetTimerState()).toEqual({
      running: false,
      remainingSec: 90,
      durationSec: 90,
    });
  });
});

describe('очередь -> дневники', () => {
  it('9. вода из виджета падает в he_water_log', async () => {
    await queueWaterMl(250);
    await queueWaterMl(500);
    const applied = applyWidgetQueue(await drainWidgetQueue());
    expect(applied).toEqual({ waterMl: 750, foods: 0, tasks: 0, tasksAdded: 0, notesAdded: 0 });
    const log = JSON.parse(localStorage.getItem('he_water_log') || '[]');
    // Канон даты — локальный календарь (`local-date`), а не UTC: `toISOString()`
    // в UTC+10 до 10:00 утра отдаёт «вчера», и тест падал только по утрам.
    const today = localIsoDate();
    const row = log.find((e: { date: string }) => e.date === today);
    expect(row.amountMl).toBe(750);
  });

  it('10. еда из виджета падает в nutrition_diary_v2', async () => {
    await queueFood({ name: 'Овсянка', kcal: 300, p: 10, f: 6, c: 55, meal: 'breakfast' });
    const applied = applyWidgetQueue(await drainWidgetQueue());
    expect(applied).toEqual({ waterMl: 0, foods: 1, tasks: 0, tasksAdded: 0, notesAdded: 0 });
    const diary = JSON.parse(localStorage.getItem('nutrition_diary_v2') || '{}');
    const dates = Object.keys(diary).filter((k) => k !== '__version');
    expect(dates.length).toBe(1);
    expect(diary[dates[0]].meals.breakfast[0].name).toBe('Овсянка');
    expect(diary[dates[0]].meals.breakfast[0].kcal).toBe(300);
  });

  it('11. битый элемент не роняет остальные', async () => {
    await queueWaterMl(250);
    const applied = applyWidgetQueue([
      { type: 'water', ml: 100, ts: Date.now() },
      { type: 'food', name: '', ts: Date.now() },
      null as never,
    ]);
    expect(applied.waterMl).toBe(100);
    expect(applied.foods).toBe(0);
  });

  it('12. задача из виджета отмечается в планшете', async () => {
    const { addCoachTask, readCoachPlanner, writeCoachPlanner, emptyCoachPlanner } = await import(
      '../../engines/coach/coach-planner.engine'
    );
    const added = addCoachTask(emptyCoachPlanner(), { title: 'Сдать ферритин', date: localIsoDate() });
    writeCoachPlanner(localStorage, added.store);
    const applied = applyWidgetQueue([
      { type: 'task', id: added.task!.id, done: true, ts: Date.now() },
    ]);
    expect(applied.tasks).toBe(1);
    const stored = readCoachPlanner(localStorage);
    expect(stored.items.find(t => t.id === added.task!.id)?.done).toBe(true);
  });

  it('13. быстрая задача из виджета создаётся с нативным id', async () => {
    const { readCoachPlanner } = await import('../../engines/coach/coach-planner.engine');
    const applied = applyWidgetQueue([
      {
        type: 'task_add',
        id: 'w_task_1',
        title: 'Позвонить тренеру',
        date: localIsoDate(),
        time: '18:00',
        priority: 'high',
        ts: Date.now(),
      },
    ]);
    expect(applied.tasksAdded).toBe(1);
    const stored = readCoachPlanner(localStorage);
    const task = stored.items.find(t => t.id === 'w_task_1');
    expect(task?.title).toBe('Позвонить тренеру');
    expect(task?.time).toBe('18:00');
    expect(task?.priority).toBe('high');
  });

  it('14. быстрая заметка из виджета создаётся с чек-листом', async () => {
    const { readCoachNotes } = await import('../../engines/coach/coach-notes.engine');
    const applied = applyWidgetQueue([
      {
        type: 'note_add',
        id: 'w_note_1',
        title: 'После тренировки',
        checklist: [
          { id: 'c_1', text: 'Растяжка', done: false },
          { id: 'c_2', text: 'Протеин', done: false },
        ],
        ts: Date.now(),
      },
    ]);
    expect(applied.notesAdded).toBe(1);
    const note = readCoachNotes(localStorage).items.find(n => n.id === 'w_note_1');
    expect(note?.title).toBe('После тренировки');
    expect(note?.checklist?.length).toBe(2);
  });

  it('15. отметка «сделано» у только что добавленной с виджета задачи не теряется', async () => {
    const { readCoachPlanner } = await import('../../engines/coach/coach-planner.engine');
    // Порядок как в очереди: сначала задача, потом её отметка.
    const applied = applyWidgetQueue([
      { type: 'task', id: 'w_task_2', done: true, ts: Date.now() },
      {
        type: 'task_add',
        id: 'w_task_2',
        title: 'Выпить креатин',
        date: localIsoDate(),
        ts: Date.now(),
      },
    ]);
    expect(applied.tasksAdded).toBe(1);
    const stored = readCoachPlanner(localStorage);
    const task = stored.items.find(t => t.id === 'w_task_2');
    expect(task?.title).toBe('Выпить креатин');
    expect(task?.done).toBe(true);
  });
});
