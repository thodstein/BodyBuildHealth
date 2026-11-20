/**
 * coach-planner-ticktick.test.ts — расширения планера «как в TickTick»:
 * приоритеты, списки, повторы и перенос задач.
 */
import { describe, expect, it } from 'vitest';
import {
  addCoachTask,
  coachTaskList,
  coachTaskPriority,
  completeCoachTask,
  countTasksByList,
  emptyCoachPlanner,
  filterCoachTasks,
  moveCoachTask,
  nextRepeatDate,
  readCoachPlanner,
  writeCoachPlanner,
} from '../coach-planner.engine';

const NOW = '2026-11-04T10:00:00.000Z';

describe('TickTick-поля задачи', () => {
  it('приоритет и список сохраняются и читаются с дефолтами', () => {
    const r = addCoachTask(
      emptyCoachPlanner(),
      { title: 'Сдать ферритин', date: '2026-11-04', priority: 'high', list: 'health' },
      { id: 't1', now: NOW },
    );
    expect(r.task?.priority).toBe('high');
    expect(r.task?.list).toBe('health');
    expect(coachTaskPriority(r.task!)).toBe('high');
    expect(coachTaskList(r.task!)).toBe('health');

    const plain = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-11-04' }, { id: 't2', now: NOW });
    expect(coachTaskPriority(plain.task!)).toBe('none');
    expect(coachTaskList(plain.task!)).toBe('inbox');
  });

  it('фильтр по списку и поиск по заметке', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Присед', date: '2026-11-04', list: 'training' }, { id: 'a', now: NOW }).store;
    s = addCoachTask(s, { title: 'Созвон', date: '2026-11-05', list: 'work', note: 'с тренером' }, { id: 'b', now: NOW }).store;
    expect(filterCoachTasks(s, { list: 'training' }).map(t => t.id)).toEqual(['a']);
    expect(filterCoachTasks(s, { query: 'тренер' }).map(t => t.id)).toEqual(['b']);
    expect(countTasksByList(s).training).toBe(1);
    expect(countTasksByList(s).work).toBe(1);
  });
});

describe('повторы', () => {
  it('nextRepeatDate считает день/неделю/месяц по локальному канону', () => {
    expect(nextRepeatDate('2026-11-04', 'daily')).toBe('2026-11-05');
    expect(nextRepeatDate('2026-11-04', 'weekly')).toBe('2026-11-11');
    expect(nextRepeatDate('2026-11-04', 'monthly')).toBe('2026-12-04');
    expect(nextRepeatDate('2026-11-04', 'none')).toBeNull();
  });

  it('через день, каждые 2 недели и свой интервал', () => {
    expect(nextRepeatDate('2026-11-04', 'eod')).toBe('2026-11-06');
    expect(nextRepeatDate('2026-11-04', 'biweekly')).toBe('2026-11-18');
    expect(nextRepeatDate('2026-11-04', 'custom', { interval: 3 })).toBe('2026-11-07');
    // Интервал вне границ нормализуется, а не ломает серию.
    expect(nextRepeatDate('2026-11-04', 'custom', { interval: 0 })).toBe('2026-11-06');
    expect(nextRepeatDate('2026-11-04', 'custom', { interval: 9999 })).toBe('2027-11-04');
  });

  it('дни недели: ближайший выбранный день после текущего', () => {
    // 2026-11-04 — среда; выбран понедельник/пятница → пятница.
    expect(nextRepeatDate('2026-11-04', 'weekdays', { days: [0, 4] })).toBe('2026-11-06');
    // Понедельник при тех же днях → пятница той же недели.
    expect(nextRepeatDate('2026-11-02', 'weekdays', { days: [0, 4] })).toBe('2026-11-06');
    // Пустой набор — тот же день недели через неделю (не «каждый день»).
    expect(nextRepeatDate('2026-11-04', 'weekdays')).toBe('2026-11-11');
  });

  it('серия «по дням» сохраняет дни в следующем вхождении', () => {
    const r = addCoachTask(
      emptyCoachPlanner(),
      { title: 'Кардио', date: '2026-11-02', repeat: 'weekdays', repeatDays: [4, 0] },
      { id: 't1', now: NOW },
    );
    expect(r.task?.repeatDays).toEqual([0, 4]);
    const done = completeCoachTask(r.store, 't1', { now: NOW });
    const next = done.items.find(t => t.id !== 't1');
    expect(next?.date).toBe('2026-11-06');
    expect(next?.repeat).toBe('weekdays');
    expect(next?.repeatDays).toEqual([0, 4]);
  });

  it('свой интервал переносится в следующее вхождение', () => {
    const r = addCoachTask(
      emptyCoachPlanner(),
      { title: 'Готовка', date: '2026-11-04', repeat: 'custom', repeatInterval: 10 },
      { id: 't1', now: NOW },
    );
    const done = completeCoachTask(r.store, 't1', { now: NOW });
    expect(done.items.find(t => t.id !== 't1')?.date).toBe('2026-11-14');
  });

  it('закрытие повторяющейся задачи создаёт следующее вхождение без дублей', () => {
    const r = addCoachTask(
      emptyCoachPlanner(),
      { title: 'Присед', date: '2026-11-04', repeat: 'weekly' },
      { id: 't1', now: NOW },
    );
    const done = completeCoachTask(r.store, 't1', { now: NOW });
    expect(done.items.find(t => t.id === 't1')?.done).toBe(true);
    expect(done.items).toHaveLength(2);
    expect(done.items[1].date).toBe('2026-11-11');
    expect(done.items[1].done).toBe(false);

    // Повторное закрытие не плодит третье вхождение.
    const again = completeCoachTask({ version: 1, items: done.items.map(t => (t.id === 't1' ? { ...t, done: false } : t)) }, 't1', { now: NOW });
    expect(again.items).toHaveLength(2);
  });

  it('перенос двигает задачу на другой день', () => {
    const r = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-11-04' }, { id: 't1', now: NOW });
    const moved = moveCoachTask(r.store, 't1', '2026-11-05', { now: NOW });
    expect(moved.items[0].date).toBe('2026-11-05');
    // Битая дата — без изменений.
    expect(moveCoachTask(moved, 't1', '2026-02-31')).toBe(moved);
  });
});

describe('совместимость хранилища', () => {
  it('старый JSON без priority/list читается с дефолтами', () => {
    localStorage.setItem(
      'he_coach_planner',
      JSON.stringify({
        version: 1,
        items: [
          {
            id: 'old',
            title: 'Старая задача',
            date: '2026-11-04',
            time: null,
            athleteId: null,
            done: false,
            note: '',
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      }),
    );
    const store = readCoachPlanner(localStorage);
    expect(store.items).toHaveLength(1);
    expect(coachTaskPriority(store.items[0])).toBe('none');
    expect(coachTaskList(store.items[0])).toBe('inbox');
    writeCoachPlanner(localStorage, store);
  });
});
