/**
 * coach-week-view.test.tsx — «Неделя» в режиме тренера.
 *
 * Проверяем обещания, которые видит тренер:
 *  • дни недели и задачи по датам (не «магическая» раскладка);
 *  • тренировки — только факт («тренировался»), а не выдуманный план по дням;
 *  • обзор недели ведёт к нужному атлету;
 *  • напоминания ставятся ТОЛЬКО по нажатию, и если устройство не приняло —
 *    это сказано прямо, а не «включено» впустую.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

const bridge = vi.hoisted(() => ({
  scheduled: [] as unknown[],
  cancelled: [] as number[][],
  result: 2,
}));

vi.mock('../../../../core/native-bridge', () => ({
  jsDayToCapacitorWeekday: (jsMon0: number) => ((jsMon0 + 1) % 7) + 1,
  scheduleWeeklyReminders: vi.fn(async (items: unknown[]) => {
    bridge.scheduled.push(items);
    return bridge.result;
  }),
  cancelScheduledReminders: vi.fn(async (ids: number[]) => {
    bridge.cancelled.push(ids);
  }),
}));

import { CoachWeekView } from '../CoachWeekView';
import { buildCoachWeek } from '../../../../engines/coach/coach-week.engine';
import type { CoachTask } from '../../../../engines/coach/coach-planner.engine';
import type { AthleteSnapshot } from '../../../../engines/coach/coach-athlete-snapshot.engine';
import type { AdherenceResult, WeekAdherence } from '../../../../engines/coach/coach-adherence.engine';
import { readCoachReminderSettings } from '../../../../engines/coach/coach-reminders.engine';

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

const adherence = (): AdherenceResult => ({
  ...week(),
  plan: { sessionsPerWeek: 3, focus: 'Сила', track: 'pl' },
  previous: week(),
  line: 'выполнение: 1 из 3',
  attention: 'план недели не выполнен: 1 из 3',
});

const makeWeek = (over: {
  tasks?: CoachTask[];
  athletes?: Parameters<typeof buildCoachWeek>[0]['athletes'];
} = {}) =>
  buildCoachWeek({
    today: TODAY,
    weekStart: WEEK_START,
    tasks: over.tasks ?? [],
    athletes: over.athletes ?? [],
    notes: [],
  });

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  bridge.scheduled = [];
  bridge.cancelled = [];
  bridge.result = 2;
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('неделя: дни и задачи', () => {
  it('семь дней, «сегодня» подсвечено, задачи — по своим датам', () => {
    const w = makeWeek({
      tasks: [
        task({ title: 'Созвон', date: TODAY, time: '18:00' }),
        task({ title: 'Сдать анализы', date: '2026-11-06' }),
      ],
    });
    const { container } = render(<CoachWeekView week={w} tasks={[]} />);
    const days = container.querySelectorAll('[data-coach="week-day"]');
    expect(days).toHaveLength(7);
    expect(days[2].getAttribute('data-today')).toBe('true');
    expect(days[2].textContent).toContain('Созвон');
    expect(days[4].textContent).toContain('Сдать анализы');
    expect(container.textContent).toContain('задач: 2');
  });

  it('тренировка показана как факт, а не как план на будущее', () => {
    const w = makeWeek({
      athletes: [
        {
          athlete: { id: 'a1', name: 'Иван', status: 'active' },
          snapshot: snapshot({ hasPlan: true, hasAnyData: true, sessionDates: [TODAY] }),
        },
      ],
    });
    const { container } = render(<CoachWeekView week={w} tasks={[]} />);
    const today = container.querySelectorAll('[data-coach="week-day"]')[2];
    expect(today.textContent).toContain('тренировался: Иван');
    // В будущих днях ничего не «запланировано» — там прочерк.
    expect(container.querySelectorAll('[data-coach="week-day"]')[4].textContent).toContain('—');
  });

  it('просроченные задачи видны отдельным блоком с датами', () => {
    const w = makeWeek({ tasks: [task({ title: 'Старое дело', date: '2026-10-30' })] });
    const { container } = render(<CoachWeekView week={w} tasks={[]} />);
    expect(container.querySelector('[data-coach="week-overdue"]')?.textContent).toContain('Старое дело (30.10)');
  });
});

describe('обзор недели', () => {
  it('перечисляет поводы и ведёт к атлету по нажатию', () => {
    const w = makeWeek({
      athletes: [
        {
          athlete: { id: 'a1', name: 'Иван', status: 'active' },
          snapshot: snapshot({ hasPlan: false, hasAnyData: true, lastCheckin: '2026-10-20' }),
          adherence: adherence(),
        },
      ],
    });
    const picked: string[] = [];
    const { container } = render(
      <CoachWeekView week={w} tasks={[]} onSelectAthlete={(_id, name) => picked.push(name)} />,
    );
    expect(container.querySelector('[data-coach="week-review"]')?.textContent).toContain('Прошлая неделя не выполнена');
    expect(container.textContent).toContain('Нет программы');
    expect(container.textContent).toContain('Чек-ина нет на этой неделе');

    fireEvent.click(container.querySelector('[data-coach="review-athlete"]') as HTMLElement);
    expect(picked).toEqual(['Иван']);
  });

  it('без поводов честно пишет «Поводов нет»', () => {
    const w = makeWeek();
    const { container } = render(<CoachWeekView week={w} tasks={[]} />);
    expect(container.querySelector('[data-coach="week-review"]')?.textContent).toContain('Поводов нет');
  });
});

describe('напоминания: только по нажатию', () => {
  it('до нажатия ничего не ставится и настройка выключена', () => {
    const w = makeWeek({ tasks: [task({ title: 'Созвон', date: TODAY, time: '18:00' })] });
    render(<CoachWeekView week={w} tasks={[{ ...task({ title: 'Созвон', date: TODAY, time: '18:00' }) }]} />);
    expect(bridge.scheduled).toHaveLength(0);
    expect(readCoachReminderSettings(localStorage).enabled).toBe(false);
  });

  it('включение ставит еженедельные напоминания и сохраняет настройку', async () => {
    const tasks = [
      task({ title: 'Созвон', date: TODAY, time: '18:00' }),
      task({ title: 'Присед', date: '2026-11-05', time: '07:30' }),
    ];
    const w = makeWeek({ tasks });
    const { container } = render(<CoachWeekView week={w} tasks={tasks} />);

    fireEvent.click(container.querySelector('[data-coach="reminders-toggle"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-coach="reminders-status"]')?.textContent).toContain('Поставлено напоминаний: 2'),
    );
    expect(readCoachReminderSettings(localStorage).enabled).toBe(true);
    const sent = bridge.scheduled[0] as Array<Record<string, unknown>>;
    expect(sent).toHaveLength(2);
    // 04.11 — среда (Mon0 = 2) → Capacitor 4; 05.11 — четверг → 5.
    expect(sent[0]).toMatchObject({ weekday: 4, hour: 18, minute: 0, body: 'Созвон' });
    expect(sent[1]).toMatchObject({ weekday: 5, hour: 7, minute: 30, body: 'Присед' });
  });

  it('выключение снимает поставленные напоминания', async () => {
    const tasks = [task({ title: 'Созвон', date: TODAY, time: '18:00' })];
    const w = makeWeek({ tasks });
    const { container } = render(<CoachWeekView week={w} tasks={tasks} />);

    fireEvent.click(container.querySelector('[data-coach="reminders-toggle"]') as HTMLElement);
    await waitFor(() => expect(readCoachReminderSettings(localStorage).enabled).toBe(true));
    fireEvent.click(container.querySelector('[data-coach="reminders-toggle"]') as HTMLElement);
    await waitFor(() => expect(readCoachReminderSettings(localStorage).enabled).toBe(false));
    expect(bridge.cancelled.length).toBeGreaterThan(0);
    expect(container.querySelector('[data-coach="reminders-status"]')?.textContent).toContain('выключены');
  });

  it('задачи без времени — нечего напоминать, это сказано текстом', async () => {
    const tasks = [task({ title: 'Без времени', date: TODAY })];
    const w = makeWeek({ tasks });
    const { container } = render(<CoachWeekView week={w} tasks={tasks} />);
    fireEvent.click(container.querySelector('[data-coach="reminders-toggle"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-coach="reminders-status"]')?.textContent).toContain('нет времени'),
    );
    expect(bridge.scheduled).toHaveLength(0);
  });

  it('устройство не приняло напоминания — честно, задачи остаются', async () => {
    bridge.result = 0;
    const tasks = [task({ title: 'Созвон', date: TODAY, time: '18:00' })];
    const w = makeWeek({ tasks });
    const { container } = render(<CoachWeekView week={w} tasks={tasks} />);
    fireEvent.click(container.querySelector('[data-coach="reminders-toggle"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-coach="reminders-status"]')?.textContent).toContain('Ничего не потеряно'),
    );
  });
});
