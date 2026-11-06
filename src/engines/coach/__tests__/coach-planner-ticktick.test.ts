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
