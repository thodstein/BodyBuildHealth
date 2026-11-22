/**
 * coach-planner-ticktick-extended.test.ts — TickTick-паритет планёра:
 * теги, подзадачи, закрепление, ручной порядок, умные списки, фильтры,
 * группировка/сортировка, матрица, статистика и быстрый ввод.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_REPEATS,
  COACH_TAGS_MAX,
  addCoachFilter,
  addCoachSubtask,
  addCoachTask,
  applyCoachFilter,
  coachPlannerStats,
  coachQuadrant,
  coachQuickAddHints,
  coachSubtaskProgress,
  coachTaskTags,
  collectCoachTags,
  completeCoachTask,
  countSmartList,
  countTasksByDate,
  countTasksByList,
  daysBetweenIso,
  duplicateCoachTask,
  emptyCoachFilters,
  emptyCoachPlanner,
  filterCoachTasks,
  fmtCoachDateLabel,
  formatCoachTag,
  groupCoachTasks,
  moveCoachTask,
  nextRepeatDate,
  normalizeTags,
  parseCoachFilters,
  parseCoachPlanner,
  parseCoachQuickAdd,
  removeCoachFilter,
  removeCoachTask,
  reorderCoachTasks,
  restoreCoachTask,
  serializeCoachPlanner,
  setCoachTaskPinned,
  skipCoachRepeat,
  smartListTasks,
  sortCoachTasks,
  sortCoachTasksBy,
  tasksForDate,
  toggleCoachSubtask,
  removeCoachSubtask,
  updateCoachTask,
  type CoachPlannerStore,
} from '../coach-planner.engine';

const NOW = '2026-11-04T10:00:00.000Z';
const TODAY = '2026-11-04';

const seed = (): CoachPlannerStore => {
  const s = addCoachTask(
    emptyCoachPlanner(),
    {
      title: 'Присед',
      date: '2026-11-04',
      time: '10:00',
      priority: 'high',
      list: 'training',
      tags: ['зал', 'сила'],
      note: 'тяжёлая',
      subtasks: [
        { id: 's1', title: 'Разминка', done: false },
        { id: 's2', title: 'Подходы', done: false },
      ],
    },
    { id: 'a', now: NOW },
  ).store;
  return addCoachTask(
    s,
    { title: 'Сдать ферритин', date: '2026-11-05', priority: 'low', list: 'health', tags: ['анализы'] },
    { id: 'b', now: NOW },
  ).store;
};
describe('теги', () => {
  it('нормализация: без #, без пустых, без дублей по регистру, лимит', () => {
    expect(normalizeTags(['#Здоровье', ' здоровье ', 'зал', '', null, undefined])).toEqual(['Здоровье', 'зал']);
    const many = Array.from({ length: COACH_TAGS_MAX + 5 }, (_, i) => `tag${i}`);
    expect(normalizeTags(many)).toHaveLength(COACH_TAGS_MAX);
    expect(formatCoachTag('зал')).toBe('#зал');
  });

  it('теги сохраняются, читаются из JSON и ищутся фильтром (хотя бы один)', () => {
    const store = seed();
    expect(coachTaskTags(store.items[0])).toEqual(['зал', 'сила']);
    const parsed = parseCoachPlanner(serializeCoachPlanner(store));
    expect(coachTaskTags(parsed.items[0])).toEqual(['зал', 'сила']);

    expect(filterCoachTasks(store, { tags: ['анализы'] }).map(t => t.id)).toEqual(['b']);
    expect(filterCoachTasks(store, { tags: ['зал', 'анализы'] }).map(t => t.id)).toEqual(['a', 'b']);
    expect(filterCoachTasks(store, { tags: [] })).toHaveLength(2);
    expect(collectCoachTags(store).map(t => t.tag).sort()).toEqual(['анализы', 'зал', 'сила']);
  });

  it('поиск ищет по тегам и подзадачам, а не только по названию', () => {
    const store = seed();
    expect(filterCoachTasks(store, { query: 'сила' }).map(t => t.id)).toEqual(['a']);
    expect(filterCoachTasks(store, { query: 'разминка' }).map(t => t.id)).toEqual(['a']);
  });
});

describe('подзадачи', () => {
  it('добавление, отметка, прогресс и удаление', () => {
    let store = addCoachTask(emptyCoachPlanner(), { title: 'X', date: TODAY }, { id: 't', now: NOW }).store;
    store = addCoachSubtask(store, 't', 'Первый шаг', { id: 's1' });
    store = addCoachSubtask(store, 't', 'Второй шаг', { id: 's2' });
    expect(coachSubtaskProgress(store.items[0])).toEqual({ done: 0, total: 2 });

    store = toggleCoachSubtask(store, 't', 's1');
    expect(coachSubtaskProgress(store.items[0])).toEqual({ done: 1, total: 2 });

    store = removeCoachSubtask(store, 't', 's1');
    expect(coachSubtaskProgress(store.items[0])).toEqual({ done: 0, total: 1 });

    store = removeCoachSubtask(store, 't', 's2');
    expect(store.items[0].subtasks).toBeUndefined();
  });

  it('пустая подзадача и неизвестная задача — no-op', () => {
    const store = addCoachTask(emptyCoachPlanner(), { title: 'X', date: TODAY }, { id: 't', now: NOW }).store;
    expect(addCoachSubtask(store, 't', '   ')).toBe(store);
    expect(addCoachSubtask(store, 'ghost', 'Шаг')).toBe(store);
  });

  it('следующее вхождение серии начинает чеклист заново', () => {
    const r = addCoachTask(
      emptyCoachPlanner(),
      {
        title: 'Кардио',
        date: TODAY,
        repeat: 'daily',
        subtasks: [{ id: 's1', title: 'Разминка', done: true }],
        tags: ['зал'],
      },
      { id: 't', now: NOW },
    );
    const done = completeCoachTask(r.store, 't', { now: NOW });
    const next = done.items.find(t => t.id !== 't')!;
    expect(next.subtasks).toEqual([{ id: 's1', title: 'Разминка', done: false }]);
    expect(next.tags).toEqual(['зал']);
  });
});

describe('закрепление и ручной порядок', () => {
  it('закреплённая задача поднимается вверх своего дня', () => {
    let store = addCoachTask(emptyCoachPlanner(), { title: 'Утро', date: TODAY, time: '09:00' }, { id: 'a', now: NOW }).store;
    store = addCoachTask(store, { title: 'Вечер', date: TODAY, time: '20:00' }, { id: 'b', now: NOW }).store;
    expect(sortCoachTasks(store.items).map(t => t.id)).toEqual(['a', 'b']);
    store = setCoachTaskPinned(store, 'b', true);
    expect(sortCoachTasks(store.items).map(t => t.id)).toEqual(['b', 'a']);
    store = setCoachTaskPinned(store, 'b', false);
    expect(sortCoachTasks(store.items).map(t => t.id)).toEqual(['a', 'b']);
  });

  it('перенос перед задачей меняет порядок и сохраняется', () => {
    let store = addCoachTask(emptyCoachPlanner(), { title: 'A', date: TODAY }, { id: 'a', now: NOW }).store;
    store = addCoachTask(store, { title: 'B', date: TODAY }, { id: 'b', now: NOW }).store;
    store = addCoachTask(store, { title: 'C', date: TODAY }, { id: 'c', now: NOW }).store;
    store = reorderCoachTasks(store, 'c', 'a');
    expect(tasksForDate(store, TODAY).map(t => t.id)).toEqual(['c', 'a', 'b']);
    // Перенос в конец дня.
    store = reorderCoachTasks(store, 'c', null);
    expect(tasksForDate(store, TODAY).map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('новая задача в день с ручным порядком встаёт в конец', () => {
    let store = addCoachTask(emptyCoachPlanner(), { title: 'A', date: TODAY }, { id: 'a', now: NOW }).store;
    store = reorderCoachTasks(store, 'a', null);
    store = addCoachTask(store, { title: 'B', date: TODAY }, { id: 'b', now: NOW }).store;
    expect(tasksForDate(store, TODAY).map(t => t.id)).toEqual(['a', 'b']);
  });

  it('перенос на другой день сбрасывает ручной порядок', () => {
    let store = addCoachTask(emptyCoachPlanner(), { title: 'A', date: TODAY }, { id: 'a', now: NOW }).store;
    store = addCoachTask(store, { title: 'B', date: TODAY }, { id: 'b', now: NOW }).store;
    store = reorderCoachTasks(store, 'b', 'a');
    expect(store.items.find(t => t.id === 'b')?.order).toBe(0);
    store = moveCoachTask(store, 'b', '2026-11-06', { now: NOW });
    const moved = store.items.find(t => t.id === 'b')!;
    expect(moved.date).toBe('2026-11-06');
    expect(moved.order).toBeUndefined();
  });
});

describe('умные списки', () => {
  const store = (): CoachPlannerStore => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Сегодня', date: TODAY, list: 'training' }, { id: 'today', now: NOW }).store;
    s = addCoachTask(s, { title: 'Завтра', date: '2026-11-05', list: 'health' }, { id: 'tomorrow', now: NOW }).store;
    s = addCoachTask(s, { title: 'Через 5', date: '2026-11-09', list: 'work' }, { id: 'next5', now: NOW }).store;
    s = addCoachTask(s, { title: 'Через 9', date: '2026-11-13', list: 'personal' }, { id: 'next9', now: NOW }).store;
    s = addCoachTask(s, { title: 'Долг', date: '2026-10-30', list: 'health' }, { id: 'old', now: NOW }).store;
    s = addCoachTask(s, { title: 'Входящее', date: '2026-12-01', list: 'inbox' }, { id: 'inbox', now: NOW }).store;
    return s;
  };

  it('сегодня / завтра / 7 дней / просрочено / входящие / сделано', () => {
    const s = store();
    expect(smartListTasks(s, 'today', TODAY).map(t => t.id)).toEqual(['today']);
    expect(smartListTasks(s, 'tomorrow', TODAY).map(t => t.id)).toEqual(['tomorrow']);
    expect(smartListTasks(s, 'next7', TODAY).map(t => t.id)).toEqual(['today', 'tomorrow', 'next5']);
    expect(smartListTasks(s, 'overdue', TODAY).map(t => t.id)).toEqual(['old']);
    expect(smartListTasks(s, 'inbox', TODAY).map(t => t.id)).toEqual(['inbox']);
    expect(countSmartList(s, 'next7', TODAY)).toBe(3);
    expect(countSmartList(s, 'done', TODAY)).toBe(0);
  });

  it('«7 дней» — сегодня и шесть следующих, восьмой день уже нет', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Граница+6', date: '2026-11-10' }, { id: 'in', now: NOW }).store;
    s = addCoachTask(s, { title: 'Граница+7', date: '2026-11-11' }, { id: 'out', now: NOW }).store;
    expect(smartListTasks(s, 'next7', TODAY).map(t => t.id)).toEqual(['in']);
  });

  it('умный список работает через фильтр и уважает includeDone=false', () => {
    const closed = completeCoachTask(store(), 'today', { now: NOW });
    expect(filterCoachTasks(closed, { smart: 'today', today: TODAY, includeDone: false })).toHaveLength(0);
    expect(filterCoachTasks(closed, { smart: 'today', today: TODAY }).map(t => t.id)).toEqual(['today']);
    expect(filterCoachTasks(closed, { smart: 'done', today: TODAY }).map(t => t.id)).toEqual(['today']);
  });

  it('закреплённые и незакрытые фильтруются отдельно', () => {
    let s = store();
    s = setCoachTaskPinned(s, 'old', true);
    expect(filterCoachTasks(s, { pinnedOnly: true }).map(t => t.id)).toEqual(['old']);
  });

  it('счётчик чипа уважает includeDone', () => {
    const s = completeCoachTask(store(), 'today', { now: NOW });
    expect(countSmartList(s, 'today', TODAY)).toBe(1);
    expect(countSmartList(s, 'today', TODAY, { includeDone: false })).toBe(0);
  });
});

describe('группировка и сортировка', () => {
  const store = (): CoachPlannerStore => {
    let s = addCoachTask(
      emptyCoachPlanner(),
      { title: 'Б', date: TODAY, priority: 'low', list: 'work', tags: ['работа'] },
      { id: 'b', now: NOW },
    ).store;
    s = addCoachTask(
      s,
      { title: 'А', date: TODAY, priority: 'high', list: 'health', tags: ['здоровье', 'работа'] },
      { id: 'a', now: NOW },
    ).store;
    return addCoachTask(s, { title: 'В', date: TODAY, list: 'inbox' }, { id: 'c', now: NOW }).store;
  };

  it('группы по списку, приоритету, дате и тегу', () => {
    const s = store();
    expect(groupCoachTasks(s.items, 'list').map(g => g.key)).toEqual(['inbox', 'health', 'work']);
    expect(groupCoachTasks(s.items, 'priority').map(g => g.key)).toEqual(['high', 'low', 'none']);
    expect(groupCoachTasks(s.items, 'date')).toHaveLength(1);
    const tags = groupCoachTasks(s.items, 'tag');
    expect(tags.map(g => g.label).sort()).toEqual(['#здоровье', '#работа', 'Без тегов']);
    // Задача с двумя тегами попадает в две группы — это ожидаемо.
    expect(tags.find(g => g.label === '#работа')?.items).toHaveLength(2);
  });

  it('группа тега сохраняет исходный регистр, а не ключ в нижнем', () => {
    const s = addCoachTask(emptyCoachPlanner(), { title: 'X', date: TODAY, tags: ['Здоровье'] }, { id: 'x', now: NOW }).store;
    expect(groupCoachTasks(s.items, 'tag')[0].label).toBe('#Здоровье');
  });

  it('сортировка по названию/приоритету/ручному порядку', () => {
    const s = store();
    expect(sortCoachTasksBy(s.items, 'title').map(t => t.title)).toEqual(['А', 'Б', 'В']);
    expect(sortCoachTasksBy(s.items, 'priority').map(t => t.title)).toEqual(['А', 'Б', 'В']);
    const manual = reorderCoachTasks(s, 'c', 'a');
    expect(sortCoachTasksBy(manual.items, 'manual').map(t => t.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('матрица Эйзенхауэра', () => {
  it('срочность — по дате, важность — по среднему/высокому приоритету', () => {
    const base = { time: null, athleteId: null, done: false, note: '', createdAt: NOW, updatedAt: NOW, id: 'x', title: 'X' };
    expect(coachQuadrant({ ...base, date: TODAY, priority: 'high' }, TODAY)).toBe('do');
    expect(coachQuadrant({ ...base, date: '2026-12-01', priority: 'medium' }, TODAY)).toBe('plan');
    expect(coachQuadrant({ ...base, date: TODAY, priority: 'low' }, TODAY)).toBe('delegate');
    expect(coachQuadrant({ ...base, date: '2026-12-01' }, TODAY)).toBe('drop');
  });
});

describe('статистика', () => {
  // Локальные 9:00 — чтобы «день закрытия» не зависел от таймзоны машины.
  const atLocal = (y: number, m: number, d: number, h = 9): string => new Date(y, m - 1, d, h).toISOString();

  it('считает закрытые по времени отметки, а не по дате задачи', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'A', date: '2026-11-01' }, { id: 'a', now: NOW }).store;
    s = addCoachTask(s, { title: 'B', date: TODAY }, { id: 'b', now: NOW }).store;
    s = completeCoachTask(s, 'a', { now: atLocal(2026, 11, 3) });
    s = completeCoachTask(s, 'b', { now: atLocal(2026, 11, 4) });

    const stats = coachPlannerStats(s, TODAY);
    expect(stats.total).toBe(2);
    expect(stats.done).toBe(2);
    expect(stats.open).toBe(0);
    expect(stats.todayDone).toBe(1);
    expect(stats.completedToday).toBe(1);
    expect(stats.completed7).toBe(2);
    // A закрыта 3-го при сроке 1-го — с опозданием; B — день в день.
    expect(stats.onTimeRate).toBe(0.5);
  });

  it('«вовремя» не судит задачи без времени закрытия', () => {
    const s = addCoachTask(emptyCoachPlanner(), { title: 'A', date: TODAY }, { id: 'a', now: NOW }).store;
    const done = { version: 1 as const, items: s.items.map(t => ({ ...t, done: true })) };
    expect(coachPlannerStats(done, TODAY).onTimeRate).toBe(0);
  });

  it('старые задачи без completedAt не попадают в «закрыто сегодня»', () => {
    const s = addCoachTask(emptyCoachPlanner(), { title: 'A', date: TODAY }, { id: 'a', now: NOW }).store;
    const done = { version: 1 as const, items: s.items.map(t => ({ ...t, done: true })) };
    const stats = coachPlannerStats(done, TODAY);
    expect(stats.done).toBe(1);
    expect(stats.completedToday).toBe(0);
    expect(stats.overdue).toBe(0);
  });
});

describe('повторы: месяц и год', () => {
  it('31 января + месяц = 28 февраля, а не 3 марта', () => {
    expect(nextRepeatDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextRepeatDate('2026-02-28', 'yearly')).toBe('2027-02-28');
    // 29 февраля в невисокосный год — 28 февраля.
    expect(nextRepeatDate('2024-02-29', 'yearly')).toBe('2025-02-28');
  });

  it('«каждый год» доступен в списке повторов', () => {
    expect(COACH_REPEATS).toContain('yearly');
  });
});

describe('серия и снятая галочка', () => {
  it('снятая галочка убирает только что созданное вхождение', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Кардио', date: TODAY, repeat: 'daily' }, { id: 't', now: NOW }).store;
    s = completeCoachTask(s, 't', { now: NOW });
    expect(s.items).toHaveLength(2);
    const spawned = s.items.find(t => t.id !== 't')!;
    expect(spawned).toMatchObject({ date: '2026-11-05', done: false, spawnedFrom: 't' });

    s = completeCoachTask(s, 't', { now: NOW });
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ id: 't', done: false });
    expect(s.items[0].completedAt).toBeUndefined();
  });

  it('изменённое человеком вхождение серия не стирает', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Кардио', date: TODAY, repeat: 'daily' }, { id: 't', now: NOW }).store;
    s = completeCoachTask(s, 't', { now: NOW });
    const childId = s.items.find(t => t.id !== 't')!.id;
    s = updateCoachTask(s, childId, { title: 'Кардио (важное)' }, { now: NOW });
    s = completeCoachTask(s, 't', { now: NOW });
    expect(s.items).toHaveLength(2);
    expect(s.items.find(t => t.id === childId)?.title).toBe('Кардио (важное)');
  });

  it('сдвинутое вхождение тоже остаётся', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Кардио', date: TODAY, repeat: 'daily' }, { id: 't', now: NOW }).store;
    s = completeCoachTask(s, 't', { now: NOW });
    const childId = s.items.find(t => t.id !== 't')!.id;
    s = moveCoachTask(s, childId, '2026-11-10', { now: NOW });
    s = completeCoachTask(s, 't', { now: NOW });
    expect(s.items).toHaveLength(2);
  });

  it('вхождение с отключённым повтором больше не считается хвостом серии', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Кардио', date: TODAY, repeat: 'daily' }, { id: 't', now: NOW }).store;
    s = completeCoachTask(s, 't', { now: NOW });
    const childId = s.items.find(t => t.id !== 't')!.id;
    s = updateCoachTask(s, childId, { repeat: 'none' }, { now: NOW });
    expect(s.items.find(t => t.id === childId)?.spawnedFrom).toBeUndefined();
    s = completeCoachTask(s, 't', { now: NOW });
    expect(s.items).toHaveLength(2);
  });
});

describe('быстрый ввод', () => {
  it('разбирает дату, время, тег, список и приоритет', () => {
    const q = parseCoachQuickAdd('присед завтра 18:30 #здоровье !высокий @тренировки', '2026-11-22');
    expect(q.title).toBe('присед');
    expect(q.date).toBe('2026-11-23');
    expect(q.time).toBe('18:30');
    expect(q.tags).toEqual(['здоровье']);
    expect(q.list).toBe('training');
    expect(q.priority).toBe('high');
    expect(q.matched.length).toBeGreaterThan(0);
    expect(coachQuickAddHints(q, '2026-11-22')).toContain('завтра');
  });

  it('понимает «через 3 дня», «в 9», дни недели и заметку', () => {
    const q = parseCoachQuickAdd('сдать через 3 дня в 9 // врач', '2026-11-22');
    expect(q.title).toBe('сдать');
    expect(q.date).toBe('2026-11-25');
    expect(q.time).toBe('09:00');
    expect(q.note).toBe('врач');

    const monday = parseCoachQuickAdd('тренировка пн', '2026-11-22');
    expect(monday.date).toBe('2026-11-23');

    const wednesday = parseCoachQuickAdd('созвон в среду', '2026-11-22');
    expect(wednesday.date).toBe('2026-11-25');
    expect(wednesday.title).toBe('созвон');
  });

  it('понимает числовую дату, повтор и «каждые N дней»', () => {
    const q = parseCoachQuickAdd('отчёт 22.11', '2026-11-22');
    expect(q.date).toBe('2026-11-22');
    expect(q.title).toBe('отчёт');

    const repeat = parseCoachQuickAdd('зарядка каждый день', '2026-11-22');
    expect(repeat.repeat).toBe('daily');
    expect(repeat.title).toBe('зарядка');

    const custom = parseCoachQuickAdd('созвон каждые 3 дня', '2026-11-22');
    expect(custom.repeat).toBe('custom');
    expect(custom.repeatInterval).toBe(3);
    expect(custom.title).toBe('созвон');
  });

  it('понимает время суток и «к 18:30»', () => {
    const evening = parseCoachQuickAdd('созвон в 8 вечера', '2026-11-22');
    expect(evening.time).toBe('20:00');
    expect(evening.title).toBe('созвон');

    const combined = parseCoachQuickAdd('созвон завтра в 8 вечера', '2026-11-22');
    expect(combined.date).toBe('2026-11-23');
    expect(combined.time).toBe('20:00');
    expect(combined.title).toBe('созвон');

    const morning = parseCoachQuickAdd('пробежка в 9 часов утра', '2026-11-22');
    expect(morning.time).toBe('09:00');
    expect(morning.title).toBe('пробежка');

    const noon = parseCoachQuickAdd('обед в полдень', '2026-11-22');
    expect(noon.time).toBe('12:00');
    expect(noon.title).toBe('обед');

    const midnight = parseCoachQuickAdd('отбой в полночь', '2026-11-22');
    expect(midnight.time).toBe('00:00');

    const by = parseCoachQuickAdd('сдать к 18:30', '2026-11-22');
    expect(by.time).toBe('18:30');
    expect(by.title).toBe('сдать');
  });

  it('«каждый вторник» и «по понедельникам» — повтор по дням, а не разовая дата', () => {
    const tue = parseCoachQuickAdd('тренировка каждый вторник', '2026-11-22');
    expect(tue.repeat).toBe('weekdays');
    expect(tue.repeatDays).toEqual([1]);
    expect(tue.date).toBe('2026-11-24');
    expect(tue.title).toBe('тренировка');
    expect(coachQuickAddHints(tue, '2026-11-22')).toContain('Дни: Вт');

    const mon = parseCoachQuickAdd('созвон по понедельникам', '2026-11-22');
    expect(mon.repeat).toBe('weekdays');
    expect(mon.repeatDays).toEqual([0]);
    expect(mon.date).toBe('2026-11-23');
    expect(mon.title).toBe('созвон');

    const timed = parseCoachQuickAdd('зал каждый вторник в 19:00', '2026-11-22');
    expect(timed.repeat).toBe('weekdays');
    expect(timed.date).toBe('2026-11-24');
    expect(timed.time).toBe('19:00');
    expect(timed.title).toBe('зал');
  });

  it('«через 2 дня» остаётся датой, а не временем суток', () => {
    const q = parseCoachQuickAdd('отчёт через 2 дня', '2026-11-22');
    expect(q.date).toBe('2026-11-24');
    expect(q.time).toBeNull();
  });

  it('не выдумывает несуществующую дату и не понимает лишнего', () => {
    const bad = parseCoachQuickAdd('отчёт 31.02', '2026-11-22');
    expect(bad.date).toBeNull();
    expect(bad.title).toBe('отчёт 31.02');

    const plain = parseCoachQuickAdd('Купить продукты', '2026-11-22');
    expect(plain.title).toBe('Купить продукты');
    expect(plain.date).toBeNull();
    expect(plain.time).toBeNull();
    expect(plain.tags).toEqual([]);
    expect(plain.matched).toEqual([]);
  });

  it('теги/подзадачи/напоминание правятся через updateCoachTask', () => {
    const r = addCoachTask(emptyCoachPlanner(), { title: 'X', date: TODAY }, { id: 't', now: NOW });
    const next = updateCoachTask(
      r.store,
      't',
      { tags: ['#зал', 'зал'], reminder: '08:30', pinned: true, subtasks: [{ id: 's', title: 'Шаг', done: false }] },
      { now: NOW },
    );
    expect(next.items[0].tags).toEqual(['зал']);
    expect(next.items[0].reminder).toBe('08:30');
    expect(next.items[0].pinned).toBe(true);
    expect(next.items[0].subtasks).toHaveLength(1);

    const cleared = updateCoachTask(next, 't', { tags: [], reminder: null, pinned: false, subtasks: [] }, { now: NOW });
    expect(cleared.items[0].tags).toBeUndefined();
    expect(cleared.items[0].reminder).toBeUndefined();
    expect(cleared.items[0].pinned).toBeUndefined();
    expect(cleared.items[0].subtasks).toBeUndefined();
  });
});

describe('сохранённые фильтры', () => {
  it('создаёт фильтр, применяет его и удаляет', () => {
    const store = seed();
    const empty = emptyCoachFilters();
    expect(addCoachFilter(empty, { name: '   ' }).error).toBe('name');

    const created = addCoachFilter(
      empty,
      { name: 'Анализы', smart: 'next7', list: 'health', tags: ['анализы'] },
      { id: 'f1' },
    );
    expect(created.error).toBeNull();
    expect(created.filter).toMatchObject({ id: 'f1', name: 'Анализы', list: 'health', smart: 'next7' });

    expect(applyCoachFilter(store, created.filter!, TODAY).map(t => t.id)).toEqual(['b']);
    expect(removeCoachFilter(created.store, 'f1').items).toHaveLength(0);
  });

  it('лимит фильтров не вытесняет старые', () => {
    let filters = emptyCoachFilters();
    for (let i = 0; i < 30; i++) {
      filters = addCoachFilter(filters, { name: `F${i}` }).store;
    }
    expect(filters.items).toHaveLength(30);
    expect(addCoachFilter(filters, { name: 'Лишний' }).error).toBe('limit');
  });

  it('запоминает вид/группировку/сортировку, а старые и битые значения не ломает', () => {
    const created = addCoachFilter(
      emptyCoachFilters(),
      { name: 'Канбан', view: 'kanban', groupBy: 'list', sortBy: 'title' },
      { id: 'f2' },
    );
    expect(created.filter).toMatchObject({ view: 'kanban', groupBy: 'list', sortBy: 'title' });

    const parsed = parseCoachFilters(JSON.stringify({ version: 1, items: created.store.items }));
    expect(parsed.items[0]).toMatchObject({ id: 'f2', view: 'kanban', groupBy: 'list', sortBy: 'title' });

    // Старый формат без этих полей читается и не притворяется, что вид запомнен.
    const legacy = parseCoachFilters(
      JSON.stringify({
        version: 1,
        items: [{ id: 'old', name: 'Старый', smart: 'all', list: 'all', priority: 'all', tags: [], query: '', includeDone: true }],
      }),
    );
    expect(legacy.items[0].view).toBeUndefined();
    expect(legacy.items[0].groupBy).toBeUndefined();
    expect(legacy.items[0].sortBy).toBeUndefined();

    // Неизвестные значения просто не запоминаются, фильтр остаётся рабочим.
    const junk = parseCoachFilters(
      JSON.stringify({ version: 1, items: [{ ...legacy.items[0], id: 'j', view: 'grid', sortBy: 'random' }] }),
    );
    expect(junk.items[0]).toMatchObject({ id: 'j', smart: 'all' });
    expect(junk.items[0].view).toBeUndefined();
    expect(junk.items[0].sortBy).toBeUndefined();
  });
});

describe('счётчики подчиняются «скрыть сделанные»', () => {
  it('списки и теги учитывают только видимые задачи', () => {
    let s = seed();
    s = completeCoachTask(s, 'a', { now: NOW });
    expect(countTasksByList(s)).toMatchObject({ training: 1, health: 1 });
    expect(countTasksByList(s, { includeDone: false })).toMatchObject({ training: 0, health: 1 });
    expect(collectCoachTags(s).map(t => t.tag)).toEqual(['анализы', 'зал', 'сила']);
    expect(collectCoachTags(s, { includeDone: false }).map(t => t.tag)).toEqual(['анализы']);
  });

  it('теги ограничиваются диапазоном дат', () => {
    const s = seed();
    expect(collectCoachTags(s, { from: '2026-11-05', to: '2026-11-05' }).map(t => t.tag)).toEqual(['анализы']);
    expect(collectCoachTags(s, { from: '2026-11-10' })).toEqual([]);
  });

  it('точки календаря не считают скрытые сделанные', () => {
    let s = seed();
    expect(countTasksByDate(s, TODAY, '2026-11-05')).toEqual({ [TODAY]: 1, '2026-11-05': 1 });
    s = completeCoachTask(s, 'a', { now: NOW });
    expect(countTasksByDate(s, TODAY, '2026-11-05', { includeDone: false })).toEqual({ '2026-11-05': 1 });
  });
});

describe('честная статистика и подписи дат', () => {
  it('«Вовремя» судит только задачи с известным временем закрытия', () => {
    const done = completeCoachTask(seed(), 'a', { now: NOW });
    expect(coachPlannerStats(done, TODAY).onTimeKnown).toBe(1);
    expect(coachPlannerStats(done, TODAY).completedToday).toBe(1);
    expect(coachPlannerStats(done, TODAY).completed7).toBe(1);

    // Старая запись: галочка есть, completedAt нет — её нечем судить.
    const legacy: CoachPlannerStore = { version: 1, items: [{ ...seed().items[0], done: true }] };
    const stats = coachPlannerStats(legacy, TODAY);
    expect(stats.onTimeKnown).toBe(0);
    expect(stats.onTimeRate).toBe(0);
    expect(stats.completedToday).toBe(0);
    expect(stats.done).toBe(1);
  });

  it('подпись даты добавляет год только для другого года', () => {
    expect(fmtCoachDateLabel('2026-11-04', '2026-11-22')).toBe('Ср, 04.11');
    expect(fmtCoachDateLabel('2027-01-05', '2026-11-22')).toBe('Вт, 05.01.2027');
  });

  it('разница дней терпит битую дату', () => {
    expect(daysBetweenIso('2026-11-01', '2026-11-04')).toBe(3);
    expect(daysBetweenIso('не-дата', '2026-11-04')).toBeNull();
  });
});

describe('пропуск вхождения серии', () => {
  it('переносит на следующую дату, не закрывая задачу', () => {
    const s = addCoachTask(emptyCoachPlanner(), { title: 'Кардио', date: TODAY, repeat: 'daily' }, { id: 't', now: NOW }).store;
    const skipped = skipCoachRepeat(s, 't', { now: NOW });
    expect(skipped.items).toHaveLength(1);
    expect(skipped.items[0]).toMatchObject({ date: '2026-11-05', done: false });
    expect(skipped.items[0].completedAt).toBeUndefined();
    // Второй пропуск — ещё дальше: можно «догнать» отставшую серию.
    expect(skipCoachRepeat(skipped, 't', { now: NOW }).items[0].date).toBe('2026-11-06');
    expect(skipCoachRepeat(s, 't', { now: NOW, times: 2 }).items[0].date).toBe('2026-11-06');
  });

  it('по дням недели берёт следующий выбранный день', () => {
    const s = addCoachTask(
      emptyCoachPlanner(),
      { title: 'Зал', date: TODAY, repeat: 'weekdays', repeatDays: [4] },
      { id: 't', now: NOW },
    ).store;
    // TODAY — среда; ближайшая пятница — 6 ноября.
    expect(skipCoachRepeat(s, 't', { now: NOW }).items[0].date).toBe('2026-11-06');
  });

  it('новое вхождение начинает чеклист заново и не тащит ручной порядок', () => {
    let s = addCoachTask(
      emptyCoachPlanner(),
      { title: 'Зал', date: TODAY, repeat: 'daily' },
      { id: 't', now: NOW },
    ).store;
    s = addCoachSubtask(s, 't', 'Разминка', { id: 's1' });
    s = addCoachSubtask(s, 't', 'Подходы', { id: 's2' });
    s = toggleCoachSubtask(s, 't', 's1');
    s = addCoachTask(s, { title: 'Второй', date: TODAY }, { id: 'u', now: NOW }).store;
    s = reorderCoachTasks(s, 't', 'u');
    expect(coachSubtaskProgress(s.items.find(t => t.id === 't')!)).toMatchObject({ done: 1, total: 2 });
    expect(s.items.find(t => t.id === 't')?.order).toBe(0);

    const skipped = skipCoachRepeat(s, 't', { now: NOW });
    const moved = skipped.items.find(t => t.id === 't')!;
    expect(moved.date).toBe('2026-11-05');
    expect(moved.done).toBe(false);
    // Чеклист как у нового вхождения серии: галочки сняты, шаги сохранены.
    expect(coachSubtaskProgress(moved)).toMatchObject({ done: 0, total: 2 });
    // Порядок принадлежал прошлому дню.
    expect(moved.order).toBeUndefined();
    // Вторая задача осталась на месте.
    expect(skipped.items.find(t => t.id === 'u')).toMatchObject({ date: TODAY });
  });

  it('без повтора и для закрытой задачи — no-op', () => {
    const plain = addCoachTask(emptyCoachPlanner(), { title: 'X', date: TODAY }, { id: 'p', now: NOW }).store;
    expect(skipCoachRepeat(plain, 'p')).toBe(plain);

    const started = addCoachTask(emptyCoachPlanner(), { title: 'Кардио', date: TODAY, repeat: 'daily' }, { id: 't', now: NOW }).store;
    const done = completeCoachTask(started, 't', { now: NOW });
    expect(skipCoachRepeat(done, 't')).toBe(done);
  });
});

describe('отмена удаления', () => {
  it('возвращает задачу с тем же id и полями, но не дублирует', () => {
    const s = seed();
    const task = s.items[0];
    const removed = removeCoachTask(s, task.id);
    expect(removed.items).toHaveLength(1);

    const back = restoreCoachTask(removed, task);
    expect(back.items).toHaveLength(2);
    expect(back.items.find(t => t.id === task.id)).toEqual(task);
    // Повторное «вернуть» не плодит копию.
    expect(restoreCoachTask(back, task)).toBe(back);
  });
});

describe('дублирование задачи', () => {
  it('копирует поля, но не галочки, порядок и «хвост» серии', () => {
    let s = seed();
    s = completeCoachTask(s, 'a', { now: NOW });
    s = setCoachTaskPinned(s, 'a', true);
    s = toggleCoachSubtask(s, 'a', 's1');
    s = reorderCoachTasks(s, 'a', 'b');
    const src = s.items.find(t => t.id === 'a')!;

    const next = duplicateCoachTask(s, 'a', { id: 'copy', now: NOW });
    expect(next.items).toHaveLength(3);
    const copy = next.items.find(t => t.id === 'copy')!;
    expect(copy).toMatchObject({
      title: 'Присед',
      date: TODAY,
      priority: 'high',
      list: 'training',
      note: 'тяжёлая',
      pinned: true,
    });
    expect(copy.tags).toEqual(['зал', 'сила']);
    // Копия — это «сделать ещё раз»: галочки нет.
    expect(copy.done).toBe(false);
    expect(copy.completedAt).toBeUndefined();
    expect(copy.spawnedFrom).toBeUndefined();
    expect(copy.order).toBeUndefined();
    // Чеклист начинается заново, шаги сохраняются.
    expect(coachSubtaskProgress(copy)).toMatchObject({ done: 0, total: 2 });
    // Оригинал не тронут.
    expect(next.items.find(t => t.id === 'a')).toEqual(src);
  });

  it('несуществующий id — no-op', () => {
    const s = seed();
    expect(duplicateCoachTask(s, 'nope')).toBe(s);
  });
});
