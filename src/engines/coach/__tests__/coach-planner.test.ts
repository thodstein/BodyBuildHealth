/**
 * coach-planner.test.ts — календарь-планировщик.
 *
 * Что важно проверить:
 *  • даты только календарные, «31 февраля» не существует и не проскакивает;
 *  • «сегодня» по умолчанию — локальная дата, а не UTC (иначе в UTC+10 задача
 *    уезжает на сутки);
 *  • сетка месяца начинается с понедельника и целиком покрывает месяц;
 *  • просроченные задачи не исчезают;
 *  • лимит не вытесняет чужие задачи.
 */
import { describe, expect, it } from 'vitest';
import { localIsoDate } from '../../../core/local-date';
import {
  COACH_PLANNER_MAX,
  addCoachTask,
  buildCoachMonthGrid,
  countTasksByDate,
  emptyCoachPlanner,
  isValidCoachDate,
  overdueCoachTasks,
  parseCoachPlanner,
  readCoachPlanner,
  removeCoachTask,
  serializeCoachPlanner,
  shiftCoachMonth,
  sortCoachTasks,
  tasksForDate,
  tasksInRange,
  toggleCoachTaskDone,
  upcomingCoachTasks,
  updateCoachTask,
  writeCoachPlanner,
  type CoachTask,
} from '../coach-planner.engine';

const NOW = '2026-11-04T10:00:00.000Z';

const task = (over: Partial<CoachTask> = {}): CoachTask => ({
  id: 't1',
  title: 'Присед',
  date: '2026-11-04',
  time: null,
  athleteId: null,
  done: false,
  note: '',
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

describe('создание задачи', () => {
  it('заголовок обязателен', () => {
    const r = addCoachTask(emptyCoachPlanner(), { title: '  ' });
    expect(r.error).toBe('title');
    expect(r.task).toBeNull();
    expect(r.store.items).toHaveLength(0);
  });

  it('без даты ставим СЕГОДНЯ по локальному канону', () => {
    const r = addCoachTask(emptyCoachPlanner(), { title: 'Созвон' }, { id: 't1', now: NOW });
    expect(r.error).toBeNull();
    expect(r.task?.date).toBe(localIsoDate());
  });

  it('несуществующая дата — ошибка, а не «перекат» в другой месяц', () => {
    const r = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-02-31' });
    expect(r.error).toBe('date');
    expect(r.store.items).toHaveLength(0);
  });

  it('время проверяется: мусор → «на весь день», а не выдуманное 00:00', () => {
    const r = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-11-04', time: '25:70' }, { id: 't1', now: NOW });
    expect(r.task?.time).toBeNull();
    const ok = addCoachTask(emptyCoachPlanner(), { title: 'Y', date: '2026-11-04', time: '18:30' }, { id: 't2', now: NOW });
    expect(ok.task?.time).toBe('18:30');
  });

  it(`лимит ${COACH_PLANNER_MAX}: отказ, а не вытеснение старых задач`, () => {
    let s = emptyCoachPlanner();
    for (let i = 0; i < COACH_PLANNER_MAX; i++) {
      s = addCoachTask(s, { title: `T${i}`, date: '2026-11-04' }, { id: `t${i}`, now: NOW }).store;
    }
    const r = addCoachTask(s, { title: 'Лишняя', date: '2026-11-04' }, { id: 'extra', now: NOW });
    expect(r.error).toBe('limit');
    expect(r.store).toBe(s);
  });
});

describe('правка и статус', () => {
  it('перенос на другую дату и смена времени', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-11-04' }, { id: 't1', now: NOW }).store;
    s = updateCoachTask(s, 't1', { date: '2026-11-05', time: '09:00' }, { now: NOW });
    expect(s.items[0].date).toBe('2026-11-05');
    expect(s.items[0].time).toBe('09:00');
    // невалидный перенос отклоняется, старая дата остаётся
    expect(updateCoachTask(s, 't1', { date: '2026-13-40' })).toBe(s);
  });

  it('пустой заголовок при правке не сохраняется', () => {
    const s = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-11-04' }, { id: 't1', now: NOW }).store;
    expect(updateCoachTask(s, 't1', { title: '   ' })).toBe(s);
  });

  it('toggle done, неизвестный id — no-op, удаление', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-11-04' }, { id: 't1', now: NOW }).store;
    s = toggleCoachTaskDone(s, 't1');
    expect(s.items[0].done).toBe(true);
    s = toggleCoachTaskDone(s, 't1');
    expect(s.items[0].done).toBe(false);
    expect(toggleCoachTaskDone(s, 'nope')).toBe(s);
    expect(removeCoachTask(s, 'nope')).toBe(s);
    expect(removeCoachTask(s, 't1').items).toEqual([]);
  });
});

describe('выборки', () => {
  const store = (() => {
    let s = emptyCoachPlanner();
    const rows: Array<{ id: string; title: string; date: string; time?: string; done?: boolean }> = [
      { id: 't1', title: 'Вечер', date: '2026-11-04', time: '18:00' },
      { id: 't2', title: 'Утро', date: '2026-11-04', time: '07:30', done: true },
      { id: 't3', title: 'Весь день', date: '2026-11-04' },
      { id: 't4', title: 'Завтра', date: '2026-11-05', time: '10:00' },
      { id: 't5', title: 'Просрочено', date: '2026-11-02' },
    ];
    for (const r of rows) {
      s = addCoachTask(s, { title: r.title, date: r.date, time: r.time }, { id: r.id, now: NOW }).store;
      if (r.done) s = toggleCoachTaskDone(s, r.id);
    }
    return s;
  })();

  it('внутри дня сортировка по времени, «на весь день» — после', () => {
    expect(tasksForDate(store, '2026-11-04').map(t => t.id)).toEqual(['t2', 't1', 't3']);
    expect(sortCoachTasks(store.items).map(t => t.id)).toEqual(['t5', 't2', 't1', 't3', 't4']);
  });

  it('диапазон и счётчики по дням', () => {
    expect(tasksInRange(store, '2026-11-04', '2026-11-05').map(t => t.id)).toEqual(['t2', 't1', 't3', 't4']);
    expect(countTasksByDate(store, '2026-11-01', '2026-11-30')).toEqual({
      '2026-11-02': 1,
      '2026-11-04': 3,
      '2026-11-05': 1,
    });
  });

  it('предстоящие — с даты, без выполненных по умолчанию', () => {
    expect(upcomingCoachTasks(store, { from: '2026-11-04' }).map(t => t.id)).toEqual(['t1', 't3', 't4']);
    expect(upcomingCoachTasks(store, { from: '2026-11-04', includeDone: true }).map(t => t.id)).toEqual(['t2', 't1', 't3', 't4']);
    expect(upcomingCoachTasks(store, { from: '2026-11-04', limit: 1 }).map(t => t.id)).toEqual(['t1']);
  });

  it('просроченные не сгорают', () => {
    expect(overdueCoachTasks(store, '2026-11-04').map(t => t.id)).toEqual(['t5']);
  });
});

describe('календарная сетка', () => {
  it('ноябрь 2026: 1 ноября — воскресенье, значит первая неделя начинается 26 октября', () => {
    const grid = buildCoachMonthGrid(2026, 10, '2026-11-04');
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0].iso).toBe('2026-10-26');
    expect(grid[0][6].iso).toBe('2026-11-01');
    expect(grid[0][6].inMonth).toBe(true);
    expect(grid[0][0].inMonth).toBe(false);
    const inMonth = grid.flat().filter(c => c.inMonth);
    expect(inMonth).toHaveLength(30);
    expect(inMonth[0].iso).toBe('2026-11-01');
    expect(inMonth[29].iso).toBe('2026-11-30');
    expect(grid.flat().find(c => c.isToday)?.iso).toBe('2026-11-04');
    expect(grid.flat().find(c => c.isToday)?.weekday).toBe(2); // среда
  });

  it('все ячейки идут подряд по дню (нет пропусков на переходе месяцев)', () => {
    const grid = buildCoachMonthGrid(2026, 10, '2026-11-04');
    const isos = grid.flat().map(c => c.iso);
    for (let i = 1; i < isos.length; i++) {
      const prev = new Date(`${isos[i - 1]}T00:00:00`);
      const cur = new Date(`${isos[i]}T00:00:00`);
      expect((cur.getTime() - prev.getTime()) / 86_400_000).toBe(1);
    }
  });

  it('февраль 2024 (високосный) — 29 дней, февраль 2026 — 28', () => {
    const leap = buildCoachMonthGrid(2024, 1, '2024-02-10').flat().filter(c => c.inMonth);
    expect(leap).toHaveLength(29);
    const plain = buildCoachMonthGrid(2026, 1, '2026-02-10').flat().filter(c => c.inMonth);
    expect(plain).toHaveLength(28);
  });

  it('сдвиг месяца переходит через год', () => {
    expect(shiftCoachMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftCoachMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftCoachMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
  });

  it('даты проверяются по-настоящему (30 февраля не бывает)', () => {
    expect(isValidCoachDate('2026-02-28')).toBe(true);
    expect(isValidCoachDate('2026-02-29')).toBe(false);
    expect(isValidCoachDate('2024-02-29')).toBe(true);
    expect(isValidCoachDate('2026-04-31')).toBe(false);
    expect(isValidCoachDate('04.11.2026')).toBe(false);
    expect(isValidCoachDate(null)).toBe(false);
  });
});

describe('хранение и терпимость', () => {
  it('roundtrip; недоступное хранилище не роняет', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
    const s = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-11-04' }, { id: 't1', now: NOW }).store;
    writeCoachPlanner(storage, s);
    expect(readCoachPlanner(storage).items[0].title).toBe('X');
    expect(readCoachPlanner(null).items).toEqual([]);
    const throwing = { getItem: () => { throw new Error('boom'); }, setItem: () => { throw new Error('quota'); } };
    expect(readCoachPlanner(throwing).items).toEqual([]);
    expect(() => writeCoachPlanner(throwing, s)).not.toThrow();
  });

  it('битые записи отбрасываются, дубли id — тоже', () => {
    expect(parseCoachPlanner('{oops').items).toEqual([]);
    expect(parseCoachPlanner(JSON.stringify({ version: 9, items: [] })).items).toEqual([]);
    const raw = JSON.stringify({
      version: 1,
      items: [
        { id: 't1', title: 'A', date: '2026-11-04' },
        { id: 't1', title: 'Дубль', date: '2026-11-04' },
        { id: 't2', title: 'Плохая дата', date: '2026-02-31' },
        { id: 't3', title: '   ', date: '2026-11-04' },
        { title: 'Без id', date: '2026-11-04' },
      ],
    });
    expect(parseCoachPlanner(raw).items.map(t => t.title)).toEqual(['A']);
  });

  it('сериализация сохраняет время и привязку к атлету', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'X', date: '2026-11-04', time: '08:15', athleteId: 'a1' }, { id: 't1', now: NOW }).store;
    s = toggleCoachTaskDone(s, 't1');
    const round = parseCoachPlanner(serializeCoachPlanner(s));
    expect(round.items[0]).toMatchObject({ time: '08:15', athleteId: 'a1', done: true });
  });
});
