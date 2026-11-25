/**
 * analytics-weekly-breakdown.test.ts — корзины недельного разбива — календарные недели
 * с понедельника (локально), а не «7 суток от эпохи» и не UTC-разбор YYYY-MM-DD.
 */
import { describe, expect, it } from 'vitest';
import { computeWeeklyBreakdown, type SessionLogEntry, type SetLogEntry } from '../analytics-engine';

function mkSet(date: string, setIndex = 0, weight = 100, reps = 5): SetLogEntry {
  return {
    exerciseId: 'bench_bar',
    exerciseName: 'bench_bar',
    reps,
    weight,
    rpe: 8,
    rir: 2,
    date,
    setIndex,
  };
}

function mkSession(sessionId: string, date: string, sets: SetLogEntry[]): SessionLogEntry {
  return { sessionId, date, focus: 'fullbody', durationMin: 60, sets };
}

// Календарь: 2026-11-23 — понедельник, 2026-11-29 — воскресенье, 2026-11-30 — понедельник.
const MON = '2026-11-23';
const SUN = '2026-11-29';
const NEXT_MON = '2026-11-30';

describe('computeWeeklyBreakdown: календарные недели с понедельника', () => {
  it('Пн и Вс одной недели попадают в одну корзину', () => {
    const rows = computeWeeklyBreakdown([mkSession('mon', MON, [mkSet(MON)]), mkSession('sun', SUN, [mkSet(SUN)])]);

    expect(rows).toHaveLength(1);
    expect(rows[0].weekStart).toBe(MON);
    expect(rows[0].week).toBe(20261123);
    expect(rows[0].sessions).toBe(2);
    expect(rows[0].totalSets).toBe(2);
  });

  it('Вс и следующий Пн — разные корзины, отсортированные по weekStart', () => {
    const rows = computeWeeklyBreakdown([
      mkSession('next-mon', NEXT_MON, [mkSet(NEXT_MON)]),
      mkSession('sun', SUN, [mkSet(SUN)]),
    ]);

    expect(rows.map((r) => r.weekStart)).toEqual([MON, NEXT_MON]);
    expect(rows.map((r) => r.week)).toEqual([20261123, 20261130]);
    expect(rows.reduce((sum, r) => sum + r.sessions, 0)).toBe(2);
  });

  it('невозможная дата не превращается в соседнюю неделю', () => {
    // Разбор «2026-02-31» молча даёт 3 марта: битая дата импортированной сессии
    // попала бы в настоящую корзину и раздула объём.
    const rows = computeWeeklyBreakdown([
      mkSession('ok', MON, [mkSet(MON)]),
      mkSession('bad', '2026-02-31', [mkSet('2026-02-31')]),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].weekStart).toBe(MON);
    expect(rows[0].sessions).toBe(1);
  });

  it('сумма sessions равна числу входных записей', () => {
    const dates = [MON, '2026-11-25', SUN, NEXT_MON, '2026-12-06'];
    const rows = computeWeeklyBreakdown(dates.map((d, i) => mkSession(`s${i}`, d, [mkSet(d)])));

    expect(rows.map((r) => r.weekStart)).toEqual([MON, NEXT_MON]);
    expect(rows.reduce((sum, r) => sum + r.sessions, 0)).toBe(dates.length);
  });
});
