import { describe, expect, it } from 'vitest';
import {
  buildCoachWeek,
  planCoachReminders,
  weekDayLabel,
  weekdayIndexOf,
} from '../coach-week.engine';
import type { CoachTask } from '../coach-planner.engine';
import type { AthleteSnapshot } from '../coach-athlete-snapshot.engine';
import type { AdherenceResult, WeekAdherence } from '../coach-adherence.engine';

/** 2026-11-04 — среда; неделя 02.11–08.11. */
const TODAY = '2026-11-04';
const WEEK_START = '2026-11-02';

const task = (over: Partial<CoachTask> & { title: string; date: string }): CoachTask => ({
  id: `t_${over.date}_${over.title}`,
  time: null,
  athleteId: null,
  done: false,
  note: '',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

const snapshot = (over: Partial<AthleteSnapshot> = {}): AthleteSnapshot => ({
  spaceId: 'asp_a1',
  lastTrainingDate: null,
  daysSinceTraining: null,
  sessions7: 0,
  sessions28: 0,
  sessionDates: [],
  tonnage7: 0,
  tonnage28: 0,
  lastWeight: null,
  weightTrendKg: null,
  lastCheckin: null,
  planKeys: [],
  hasPlan: false,
  hasAnyData: false,
  attention: [],
  needsAttention: false,
  ...over,
});

const week = (over: Partial<WeekAdherence> = {}): WeekAdherence => ({
  weekStart: '2026-10-26',
  weekEnd: '2026-11-01',
  planned: 3,
  done: 1,
  percent: 33,
  state: 'behind',
  finished: true,
  ...over,
});

const adherence = (over: Partial<AdherenceResult> = {}): AdherenceResult => ({
  ...week(),
  plan: { sessionsPerWeek: 3, focus: 'Сила', track: 'pl' },
  previous: week(),
  line: 'выполнение: 1 из 3 за неделю, 33%',
  attention: 'план недели не выполнен: 1 из 3',
  ...over,
});

const athlete = (id: string, name: string, status: 'active' | 'paused' | 'archived' = 'active') => ({
  id,
  name,
  status,
});

describe('дни недели', () => {
  it('индекс дня: понедельник 0, воскресенье 6', () => {
    expect(weekdayIndexOf('2026-11-02')).toBe(0);
    expect(weekdayIndexOf('2026-11-04')).toBe(2);
    expect(weekdayIndexOf('2026-11-08')).toBe(6);
  });

  it('подпись дня короткая и с датой', () => {
    expect(weekDayLabel('2026-11-04')).toBe('Ср 04.11');
  });
});

describe('недельный вид', () => {
  it('семь дней от понедельника; сегодня помечено, прошлое помечено', () => {
    const w = buildCoachWeek({ today: TODAY, weekStart: WEEK_START, tasks: [], athletes: [], notes: [] });
    expect(w.days).toHaveLength(7);
    expect(w.days[0].date).toBe('2026-11-02');
    expect(w.days[6].date).toBe('2026-11-08');
    expect(w.days.find(d => d.date === TODAY)?.isToday).toBe(true);
    expect(w.days.find(d => d.date === '2026-11-02')?.isPast).toBe(true);
    expect(w.days.find(d => d.date === '2026-11-06')?.isPast).toBe(false);
  });

  it('задачи раскладываются по датам, со временем — раньше «на весь день»', () => {
    const w = buildCoachWeek({
      today: TODAY,
      weekStart: WEEK_START,
      tasks: [
        task({ title: 'Весь день', date: TODAY }),
        task({ title: 'В 18:00', date: TODAY, time: '18:00' }),
        task({ title: 'В 09:30', date: TODAY, time: '09:30' }),
        task({ title: 'Вне недели', date: '2026-11-20' }),
      ],
      athletes: [],
      notes: [],
    });
    const today = w.days.find(d => d.date === TODAY)!;
    expect(today.tasks.map(t => t.title)).toEqual(['В 09:30', 'В 18:00', 'Весь день']);
    expect(w.tasksTotal).toBe(3);
  });

  it('просроченные незакрытые задачи — отдельно, закрытые не считаются', () => {
    const w = buildCoachWeek({
      today: TODAY,
      weekStart: WEEK_START,
      tasks: [
        task({ title: 'Старая', date: '2026-10-30' }),
        task({ title: 'Старая закрыта', date: '2026-10-30', done: true }),
        task({ title: 'Сегодня', date: TODAY }),
      ],
      athletes: [],
      notes: [],
    });
    expect(w.overdue.map(t => t.title)).toEqual(['Старая']);
  });

  it('реальные тренировки раскладываются по дням как факт', () => {
    const w = buildCoachWeek({
      today: TODAY,
      weekStart: WEEK_START,
      tasks: [],
      athletes: [
        {
          athlete: athlete('a1', 'Иван'),
          snapshot: snapshot({ sessionDates: ['2026-11-02', '2026-11-04', '2026-11-04'] }),
        },
        {
          athlete: athlete('a2', 'Пётр'),
          snapshot: snapshot({ sessionDates: ['2026-11-04'] }),
        },
      ],
      notes: [],
    });
    expect(w.days.find(d => d.date === '2026-11-02')?.trained).toEqual([
      { athleteId: 'a1', athleteName: 'Иван' },
    ]);
    expect(w.days.find(d => d.date === TODAY)?.trained.map(f => f.athleteName)).toEqual(['Иван', 'Пётр']);
  });

  it('архив не попадает в тренировки и обзор', () => {
    const w = buildCoachWeek({
      today: TODAY,
      weekStart: WEEK_START,
      tasks: [],
      athletes: [
        {
          athlete: athlete('a1', 'Иван', 'archived'),
          snapshot: snapshot({ sessionDates: [TODAY], lastCheckin: '2026-10-01' }),
          adherence: adherence(),
        },
      ],
      notes: [],
    });
    expect(w.days.find(d => d.date === TODAY)?.trained).toEqual([]);
    expect(w.review.lastWeekMissed).toEqual([]);
  });
});

describe('обзор недели', () => {
  it('без программы, провал прошлой недели, старый чек-ин — три разных факта', () => {
    const w = buildCoachWeek({
      today: TODAY,
      weekStart: WEEK_START,
      tasks: [],
      athletes: [
        {
          athlete: athlete('a1', 'Иван'),
          snapshot: snapshot({ hasPlan: false, lastCheckin: '2026-10-20' }),
          adherence: adherence(),
        },
        {
          athlete: athlete('a2', 'Анна'),
          snapshot: snapshot({
            hasPlan: true,
            hasAnyData: true,
            lastCheckin: '2026-11-03',
            sessionDates: [TODAY],
          }),
        },
      ],
      notes: [],
    });
    expect(w.review.withoutPlan.map(a => a.athleteName)).toEqual(['Иван']);
    expect(w.review.lastWeekMissed).toEqual([
      { athleteId: 'a1', athleteName: 'Иван', done: 1, planned: 3 },
    ]);
    expect(w.review.noCheckinThisWeek).toEqual([
      { athleteId: 'a1', athleteName: 'Иван', lastCheckin: '2026-10-20' },
    ]);
  });

  it('комментарии к неделе: только эта неделя и только с известным атлетом', () => {
    const w = buildCoachWeek({
      today: TODAY,
      weekStart: WEEK_START,
      tasks: [],
      athletes: [{ athlete: athlete('a1', 'Иван') }],
      notes: [
        {
          id: 'n1',
          title: '',
          body: 'Сон 6 ч',
          athleteId: 'a1',
          week: WEEK_START,
          pinned: false,
          createdAt: '2026-11-04T10:00:00.000Z',
          updatedAt: '2026-11-04T10:00:00.000Z',
        },
        {
          id: 'n2',
          title: '',
          body: 'Прошлая неделя',
          athleteId: 'a1',
          week: '2026-10-26',
          pinned: false,
          createdAt: '2026-11-04T10:00:00.000Z',
          updatedAt: '2026-11-04T10:00:00.000Z',
        },
      ],
    });
    expect(w.review.comments).toEqual([{ athleteId: 'a1', athleteName: 'Иван', body: 'Сон 6 ч' }]);
  });

  it('счётчики задач недели считают только её дни', () => {
    const w = buildCoachWeek({
      today: TODAY,
      weekStart: WEEK_START,
      tasks: [
        task({ title: 'A', date: '2026-11-02', done: true }),
        task({ title: 'B', date: '2026-11-08' }),
        task({ title: 'C', date: '2026-11-09' }),
      ],
      athletes: [],
      notes: [],
    });
    expect(w.tasksTotal).toBe(2);
    expect(w.tasksDone).toBe(1);
  });
});

describe('напоминания', () => {
  it('только незакрытые с временем, начиная с сегодня', () => {
    const items = planCoachReminders(
      [
        task({ title: 'Сегодня 18:00', date: TODAY, time: '18:00' }),
        task({ title: 'Вчера', date: '2026-11-03', time: '18:00' }),
        task({ title: 'Без времени', date: TODAY }),
        task({ title: 'Закрыта', date: TODAY, time: '08:00', done: true }),
        task({ title: 'Завтра', date: '2026-11-05', time: '07:15' }),
      ],
      { today: TODAY },
    );
    expect(items.map(i => i.body)).toEqual(['Сегодня 18:00', 'Завтра']);
    expect(items[0]).toMatchObject({ weekdayIndex: 2, hour: 18, minute: 0 });
    expect(items[1]).toMatchObject({ weekdayIndex: 3, hour: 7, minute: 15 });
  });

  it('одинаковые день+время+заголовок не дублируются', () => {
    const items = planCoachReminders(
      [
        task({ title: 'Присед', date: TODAY, time: '18:00' }),
        task({ title: '  присед ', date: TODAY, time: '18:00' }),
      ],
      { today: TODAY },
    );
    expect(items).toHaveLength(1);
  });

  it('технический потолок соблюдается (и не раздувается больше 20 по умолчанию)', () => {
    const tasks = Array.from({ length: 40 }, (_, i) =>
      task({ title: `Задача ${i}`, date: TODAY, time: `${String(8 + (i % 10)).padStart(2, '0')}:00` }),
    );
    expect(planCoachReminders(tasks, { today: TODAY })).toHaveLength(20);
    expect(planCoachReminders(tasks, { today: TODAY, max: 3 })).toHaveLength(3);
  });
});
