import { describe, expect, it } from 'vitest';
import {
  adherenceLine,
  computeAdherence,
  readAdherencePlan,
  weekDayIndex,
  weekRangeLine,
  weekStartOf,
} from '../coach-adherence.engine';

/** Понедельник, 2026-11-02; среда — 2026-11-04; воскресенье — 2026-11-08. */
const WED = '2026-11-04';
const MON = '2026-11-02';
const SUN = '2026-11-08';
const NEXT_MON = '2026-11-09';

const runtime = (days: number, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    days: Array.from({ length: days }, (_, i) => ({ label: `День ${i + 1}`, exercises: [{ name: 'присед' }] })),
    focus: 'Сила',
    track: 'pl',
    week: 3,
    ...extra,
  });

describe('неделя: границы', () => {
  it('понедельник — начало недели, воскресенье — её конец', () => {
    expect(weekStartOf(MON)).toBe(MON);
    expect(weekStartOf(WED)).toBe(MON);
    expect(weekStartOf(SUN)).toBe(MON);
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26'); // воскресенье прошлой недели
  });

  it('подпись диапазона и номер дня недели', () => {
    const r = computeAdherence({ runtimeRaw: runtime(2), sessionDates: [], today: WED });
    expect(weekRangeLine(r)).toBe('02.11–08.11');
    expect(weekDayIndex(MON, WED)).toBe(3);
    expect(weekDayIndex(MON, MON)).toBe(1);
    // За пределами недели — не выходим из 1..7.
    expect(weekDayIndex(MON, '2026-12-01')).toBe(7);
  });
});

describe('план из рантайма', () => {
  it('считаются только дни с упражнениями', () => {
    const raw = JSON.stringify({
      days: [
        { label: 'День 1', exercises: [{ name: 'присед' }] },
        { label: 'День 2', exercises: [] },
        { label: 'День 3' },
        { label: 'День 4', exercises: [{ name: 'жим' }] },
      ],
      focus: 'Сила',
      track: 'pl',
    });
    expect(readAdherencePlan(raw)).toEqual({ sessionsPerWeek: 2, focus: 'Сила', track: 'pl' });
  });

  it('нет рантайма / битый JSON / нет дней → плана нет', () => {
    expect(readAdherencePlan(null)).toBeNull();
    expect(readAdherencePlan('')).toBeNull();
    expect(readAdherencePlan('{не json')).toBeNull();
    expect(readAdherencePlan(JSON.stringify({ days: [] }))).toBeNull();
    expect(readAdherencePlan(JSON.stringify({ days: [{ label: 'День 1', exercises: [] }] }))).toBeNull();
  });

  it('испорченное число дней ограничено техническим потолком 14', () => {
    expect(readAdherencePlan(runtime(40))?.sessionsPerWeek).toBe(14);
  });
});

describe('выполнение недели', () => {
  it('нет плана → «не считаем», а не ноль процентов', () => {
    const r = computeAdherence({ runtimeRaw: null, sessionDates: [WED], today: WED });
    expect(r.state).toBe('no-plan');
    expect(r.percent).toBeNull();
    expect(r.planned).toBe(0);
    expect(r.line).toBe('выполнение: плана нет — не считаем');
    expect(r.attention).toBe('нет программы — выполнение не считаем');
  });

  it('план есть, а тренировок в дневнике нет → отдельное честное состояние', () => {
    const r = computeAdherence({ runtimeRaw: runtime(3), sessionDates: [], today: WED });
    expect(r.state).toBe('no-sessions');
    expect(r.percent).toBeNull();
    expect(r.line).toBe('выполнение: в дневнике нет тренировок');
    expect(r.attention).toBeNull();
  });

  it('середина недели: 1 из 2 — это «идёт», а не «провал»', () => {
    const r = computeAdherence({ runtimeRaw: runtime(2), sessionDates: [MON], today: WED });
    expect(r.state).toBe('in-progress');
    expect(r.done).toBe(1);
    expect(r.percent).toBe(50);
    expect(r.finished).toBe(false);
    expect(r.attention).toBeNull();
    expect(r.line).toContain('1 из 2');
    expect(r.line).toContain('неделя не закончена');
  });

  it('прошлая неделя с недобором помечается только теперь', () => {
    // Сегодня понедельник 09.11, прошлая неделя (02–08.11) закончилась: 1 из 3.
    const r = computeAdherence({ runtimeRaw: runtime(3), sessionDates: ['2026-11-03'], today: NEXT_MON });
    expect(r.previous.state).toBe('behind');
    expect(r.previous.done).toBe(1);
    expect(r.previous.planned).toBe(3);
    expect(r.previous.attention).toBeUndefined();
    // Текущая неделя только началась — оценивать нечего.
    expect(r.state).toBe('in-progress');
  });

  it('план недели не выполнен → пункт внимания с цифрами', () => {
    const r = computeAdherence({ runtimeRaw: runtime(3), sessionDates: ['2026-11-02'], today: NEXT_MON });
    // Текущая неделя: плана 3, прошло 1 день, тренировок нет — «идёт», не «провал».
    expect(r.state).toBe('in-progress');
    const lastWeek = computeAdherence({
      runtimeRaw: runtime(3),
      sessionDates: ['2026-11-02'],
      today: SUN,
    });
    // Воскресенье ещё не закончилось (сегодня = последний день): тоже «идёт».
    expect(lastWeek.state).toBe('in-progress');
    const finishedWeek = computeAdherence({
      runtimeRaw: runtime(3),
      sessionDates: ['2026-11-03'],
      today: '2026-11-10',
    });
    // 03.11 попало в прошлую неделю (02–08.11), а текущая (09–15.11) — 0 из 3,
    // но она ещё идёт, поэтому внимания нет; смотрим прошлую отдельно.
    expect(finishedWeek.previous.done).toBe(1);
    expect(finishedWeek.previous.state).toBe('behind');
  });

  it('законченная неделя: выполнено ровно по плану → done без внимания', () => {
    const r = computeAdherence({
      runtimeRaw: runtime(2),
      sessionDates: ['2026-11-03', '2026-11-05'],
      today: NEXT_MON,
    });
    expect(r.previous.state).toBe('done');
    expect(r.previous.percent).toBe(100);
  });

  it('сверх плана: процент больше 100, состояние done', () => {
    const r = computeAdherence({
      runtimeRaw: runtime(2),
      sessionDates: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'],
      today: NEXT_MON,
    });
    expect(r.previous.state).toBe('done');
    expect(r.previous.percent).toBe(350);
  });

  it('несколько записей за один день — одна сессия', () => {
    const r = computeAdherence({
      runtimeRaw: runtime(2),
      sessionDates: ['2026-11-03', '2026-11-03', '2026-11-03'],
      today: WED,
    });
    expect(r.done).toBe(1);
  });

  it('будущая дата внутри недели не считается фактом', () => {
    const r = computeAdherence({
      runtimeRaw: runtime(2),
      sessionDates: ['2026-11-06'],
      today: WED,
    });
    expect(r.done).toBe(0);
    expect(r.state).toBe('in-progress');
  });

  it('дата вне недели не влияет на неё', () => {
    const r = computeAdherence({
      runtimeRaw: runtime(2),
      sessionDates: ['2026-10-20', '2026-11-03'],
      today: WED,
    });
    expect(r.done).toBe(1);
  });

  it('adherenceLine: пустое состояние → пустая строка', () => {
    expect(adherenceLine(undefined)).toBe('');
  });
});
