import { describe, expect, it } from 'vitest';
import { buildCoachInbox, inboxSummary } from '../coach-inbox.engine';
import type { AthleteSnapshot } from '../coach-athlete-snapshot.engine';
import type { AdherenceResult, WeekAdherence } from '../coach-adherence.engine';

const athlete = (id: string, name: string, status: 'active' | 'paused' | 'archived' = 'active') => ({
  id,
  name,
  status,
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

describe('инбокс: поводы из данных', () => {
  it('пустые строки — пустой инбокс и честная подпись', () => {
    expect(buildCoachInbox([])).toEqual([]);
    expect(inboxSummary([])).toBe('Всё под контролем — поводов нет.');
  });

  it('прошлая неделя не выполнена → пункт с цифрами', () => {
    const items = buildCoachInbox([{ athlete: athlete('a1', 'Иван'), adherence: adherence() }]);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('a1:week-plan-missed');
    expect(items[0].text).toContain('1 из 3');
  });

  it('неделя выполнена или идёт — пункта нет', () => {
    const done = buildCoachInbox([
      { athlete: athlete('a1', 'Иван'), adherence: adherence({ previous: week({ state: 'done', done: 3 }) }) },
    ]);
    expect(done).toEqual([]);
    const running = buildCoachInbox([
      { athlete: athlete('a1', 'Иван'), adherence: adherence({ previous: week({ state: 'in-progress', finished: false }) }) },
    ]);
    expect(running).toEqual([]);
  });

  it('архивный атлет не попадает в инбокс', () => {
    const items = buildCoachInbox([
      { athlete: athlete('a1', 'Иван', 'archived'), snapshot: snapshot(), adherence: adherence() },
    ]);
    expect(items).toEqual([]);
  });

  it('один повод на атлета не дублируется, даже если строки повторяются', () => {
    const items = buildCoachInbox([
      { athlete: athlete('a1', 'Иван'), snapshot: snapshot() },
      { athlete: athlete('a1', 'Иван'), snapshot: snapshot() },
    ]);
    expect(items.map(i => i.key)).toEqual(['a1:no-plan', 'a1:no-training']);
  });

  it('нет программы и нет данных — два разных повода', () => {
    const items = buildCoachInbox([{ athlete: athlete('a1', 'Иван'), snapshot: snapshot() }]);
    expect(items.map(i => i.kind)).toEqual(['no-plan', 'no-training']);
  });

  it('есть данные и программа — поводов нет', () => {
    const items = buildCoachInbox([
      {
        athlete: athlete('a1', 'Иван'),
        snapshot: snapshot({
          hasPlan: true,
          hasAnyData: true,
          planKeys: ['he_pl_macro'],
          sessionDates: ['2026-11-03'],
          lastTrainingDate: '2026-11-03',
        }),
      },
    ]);
    expect(items).toEqual([]);
  });

  it('порядок: сначала провал недели, потом отсутствие плана', () => {
    const items = buildCoachInbox([
      { athlete: athlete('b2', 'Борис'), snapshot: snapshot() },
      { athlete: athlete('a1', 'Анна'), adherence: adherence(), snapshot: snapshot({ hasPlan: true, hasAnyData: true }) },
    ]);
    expect(items.map(i => i.kind)).toEqual(['week-plan-missed', 'no-plan', 'no-training']);
  });

  it('подпись: люди и поводы считаются отдельно', () => {
    const items = buildCoachInbox([
      { athlete: athlete('a1', 'Иван'), snapshot: snapshot() },
      { athlete: athlete('a2', 'Пётр'), snapshot: snapshot() },
    ]);
    expect(inboxSummary(items)).toBe('2 атлета, 4 повода');
  });
});
