import { beforeEach, describe, expect, it } from 'vitest';
import { computeHubDiagnostics } from '../hub-diagnostics';
import { localIsoDateOffset } from '../../../../core/local-date';

/** Дата N дней назад по локальному календарю (не хардкод месяца). */
const daysAgo = (n: number) => localIsoDateOffset(-n);

const workout = (date: string, sets: Array<{ rir?: number; rpe?: number; rirMissing?: boolean }>) => ({
  date,
  exercises: [{ exerciseName: 'Присед', sets: sets.map((s) => ({ weightKg: 100, reps: 5, ...s })) }],
});

beforeEach(() => {
  // sRPE-стор читает localStorage: чистим, иначе ACWR придёт из чужой записи.
  try {
    localStorage.clear();
  } catch {
    /* не в браузере — не важно */
  }
});

describe('computeHubDiagnostics: пустая история', () => {
  it('нет данных — честные нули и null, ACWR не выдумывается', () => {
    const d = computeHubDiagnostics([], 3);
    expect(d.currentRir).toBeNull();
    expect(d.currentVolume).toBe(0);
    expect(d.missedSessions).toBe(3);
    expect(d.acwr).toBeUndefined();
  });
});

describe('computeHubDiagnostics: окно RIR = 7 дней', () => {
  it('подход 10 дней назад не попадает в средний RIR', () => {
    const d = computeHubDiagnostics(
      [workout(daysAgo(10), [{ rir: 4, rpe: 6 }]), workout(daysAgo(2), [{ rir: 1, rpe: 9 }])],
      3,
    );
    expect(d.currentRir).toBe(1);
    expect(d.currentVolume).toBe(1);
  });

  it('легаси-ноль при введённом RPE 8 — заполнитель, честный RIR 2', () => {
    const d = computeHubDiagnostics([workout(daysAgo(3), [{ rir: 0, rpe: 8 }])], 3);
    expect(d.currentRir).toBe(2);
  });

  it('ноль без RPE — оценку не вводили, RIR остаётся null', () => {
    const d = computeHubDiagnostics([workout(daysAgo(3), [{ rir: 0, rpe: 0 }])], 3);
    expect(d.currentRir).toBeNull();
  });
});

describe('computeHubDiagnostics: пропуски', () => {
  it('две сессии в один день считаются одним тренировочным днём', () => {
    const d = computeHubDiagnostics(
      [workout(daysAgo(2), [{ rir: 2, rpe: 8 }]), workout(daysAgo(2), [{ rir: 2, rpe: 8 }])],
      3,
    );
    expect(d.missedSessions).toBe(2);
  });

  it('окно ровно 7 дней: подход 7 дней назад уже вне окна, 6 дней — внутри', () => {
    const d = computeHubDiagnostics(
      [workout(daysAgo(7), [{ rir: 2, rpe: 8 }]), workout(daysAgo(6), [{ rir: 2, rpe: 8 }])],
      3,
    );
    expect(d.currentVolume).toBe(1);
    // Один тренировочный день из трёх плановых — два пропуска.
    expect(d.missedSessions).toBe(2);
  });
});

describe('computeHubDiagnostics: sRPE-метрики', () => {
  const seed = (sessions: Array<{ date: string; sRPE: number; durationMin: number }>) => {
    localStorage.setItem('he_srpe_sessions', JSON.stringify(sessions));
  };

  it('три сессии с хронической базой дают посчитанный ACWR', () => {
    seed([
      { date: daysAgo(20), sRPE: 8, durationMin: 60 },
      { date: daysAgo(13), sRPE: 8, durationMin: 60 },
      { date: daysAgo(2), sRPE: 8, durationMin: 60 },
    ]);
    const d = computeHubDiagnostics([], 3);
    expect(typeof d.acwr).toBe('number');
    expect(d.acwr).toBeGreaterThan(0);
  });

  it('две сессии в одной неделе — ACWR не выдумывается (нет хронической базы)', () => {
    seed([
      { date: daysAgo(3), sRPE: 8, durationMin: 60 },
      { date: daysAgo(2), sRPE: 8, durationMin: 60 },
    ]);
    const d = computeHubDiagnostics([], 3);
    expect(d.acwr).toBeUndefined();
  });
});

describe('computeHubDiagnostics: динамика e1RM', () => {
  const wk = (date: string, weight: number) => ({
    date,
    exercises: [{ exerciseName: 'Присед', sets: [{ weightKg: weight, reps: 5 }] }],
  });

  it('разные даты дают «до/после», а не пустой список', () => {
    const d = computeHubDiagnostics([wk(daysAgo(10), 100), wk(daysAgo(2), 110)], 3);
    expect(d.exercises).toHaveLength(1);
    expect(d.exercises[0].e1rmBefore).toBeGreaterThan(0);
    expect(d.exercises[0].e1rmAfter).toBeGreaterThan(d.exercises[0].e1rmBefore);
  });

  it('две тренировки одной даты не дают ложной динамики', () => {
    const d = computeHubDiagnostics([wk(daysAgo(2), 100), wk(daysAgo(2), 120)], 3);
    expect(d.exercises).toEqual([]);
  });
});
