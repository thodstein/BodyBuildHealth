/**
 * workout-logger-undo.test.ts — отмена последнего подхода («Отменить подход»)
 * и честность PR относительно базиса (e1RM не ниже текущего максимума).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addExerciseToSession,
  archiveActiveSession,
  finishSession,
  loadActiveSession,
  loadSessions,
  localIsoDate,
  logSet,
  MAX_SESSION_DURATION_MIN,
  removeLastSet,
  startSession,
  saveActiveSession,
} from '../workout-logger.engine';

const mkSession = () => {
  const s = startSession('Test');
  return addExerciseToSession(s, { id: 'A', name: 'A', pattern: 'chest', muscleGroup: 'chest' });
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('removeLastSet', () => {
  it('удаляет подход с максимальным setNumber и возвращает его', () => {
    let s = mkSession();
    s = logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8, rir: 2 }).session;
    s = logSet(s, 0, { setNumber: 2, weightKg: 85, reps: 8, rpe: 8, rir: 2 }).session;
    s = logSet(s, 0, { setNumber: 3, weightKg: 85, reps: 6, rpe: 8, rir: 2 }).session;

    const res = removeLastSet(s, 0);
    expect(res.success).toBe(true);
    expect(res.removed?.setNumber).toBe(3);
    expect(res.session.exercises[0].sets.map((x) => x.setNumber)).toEqual([1, 2]);
    expect(res.session.totalSets).toBe(2);
    expect(res.session.exercises[0].totalVolume).toBeCloseTo(80 * 8 + 85 * 8, 5);
  });

  it('счётчики упражнения и сессии честные и до, и после отмены', () => {
    let s = mkSession();
    s = logSet(s, 0, { setNumber: 1, weightKg: 100, reps: 5, rpe: 9 }).session;
    // Запись подхода сразу заполняет счётчики упражнения (раньше это делала только отмена).
    expect(s.exercises[0].totalSets).toBe(1);
    expect(s.exercises[0].totalReps).toBe(5);
    expect(s.exercises[0].prCount).toBe(0);
    expect(s.avgIntensity).toBe(9);

    const after = removeLastSet(s, 0).session;
    // Ни PR, ни интенсивности от удалённого подхода в сессии не остаётся.
    expect(after.totalSets).toBe(0);
    expect(after.totalReps).toBe(0);
    expect(after.prCount).toBe(0);
    expect(after.avgIntensity).toBe(0);
    expect(after.exercises[0].totalSets).toBe(0);
    expect(after.exercises[0].avgRPE).toBe(0);
  });

  it('best1RM уменьшается, если выброшен подход с рекордом', () => {
    let s = mkSession();
    s = logSet(s, 0, { setNumber: 1, weightKg: 60, reps: 5, rpe: 8, rir: 1 }).session;
    s = logSet(s, 0, { setNumber: 2, weightKg: 90, reps: 1, rpe: 10, rir: 1 }).session;
    expect(s.exercises[0].best1RM).toBeGreaterThan(0);
    const res = removeLastSet(s, 0);
    expect(res.success).toBe(true);
    // 90 кг x 1 — самый мощный записанный; после удаления базис = 60 x 5 (Epley 70).
    expect(res.session.exercises[0].best1RM).toBeCloseTo(70, 5);
    // Первый подход всё ещё здесь и сохраняет базис.
    expect(res.session.exercises[0].sets).toHaveLength(1);
  });

  it('не мутирует входную сессию', () => {
    let s = mkSession();
    s = logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8 }).session;
    const before = s.exercises[0].sets.length;
    removeLastSet(s, 0);
    expect(s.exercises[0].sets.length).toBe(before);
  });

  it('out of range / пустое упражнение — success:false', () => {
    let s = mkSession();
    s = logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8 }).session;
    expect(removeLastSet(s, -1).success).toBe(false);
    expect(removeLastSet(s, 5).success).toBe(false);
    const empty = mkSession();
    expect(removeLastSet(empty, 0).success).toBe(false);
  });
});

describe('saveActiveSession plannedTotalMax', () => {
  it('не уменьшает записанный план вниз', () => {
    let s = mkSession();
    s = logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8 }).session;
    expect(saveActiveSession(s, 12)).toBe(true);
    expect(loadActiveSession()?.plannedSetsTotal).toBe(12);
    saveActiveSession(s, 3, { plannedTotalMax: true });
    expect(loadActiveSession()?.plannedSetsTotal).toBe(12);
    saveActiveSession(s, 15);
    expect(loadActiveSession()?.plannedSetsTotal).toBe(15);
  });

  it('не переданный план не стирает уже записанный у той же сессии', () => {
    let s = mkSession();
    s = logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8 }).session;
    saveActiveSession(s, 10);
    saveActiveSession(s);
    expect(loadActiveSession()?.plannedSetsTotal).toBe(10);
  });
});

describe('архив незавершённой живой сессии', () => {
  const ACTIVE_KEY = 'he_workout_active_v1';

  /** Живая сессия с одним подходом и заданными date/startTime/savedAt. */
  const putActive = (startedMinutesAgo: number, extra: Record<string, unknown> = {}) => {
    let s = mkSession();
    s = logSet(s, 0, { setNumber: 1, weightKg: 85, reps: 6, rpe: 8, rir: 2 }).session;
    const start = new Date();
    start.setSeconds(0, 0);
    start.setTime(start.getTime() - startedMinutesAgo * 60000);
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    localStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify({ ...s, date: localIsoDate(start), startTime, savedAt: start.getTime() + 90 * 60000, ...extra }),
    );
    return s;
  };

  it('прошлый день уходит в историю с реальной длительностью «старт → автосейв»', () => {
    // Старт 26 часов назад (вчера), автосейв через 90 минут — длительность берётся из них,
    // а не из «стенных» часов до текущего момента.
    putActive(26 * 60);
    const archived = archiveActiveSession();
    expect(archived).not.toBeNull();
    const sessions = loadSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationMin).toBe(90);
    expect(sessions[0].date).toBe(localIsoDate(new Date(Date.now() - 26 * 3600 * 1000)));
    expect(sessions[0].exercises[0].sets[0].weightKg).toBe(85);
    // Живая сессия снята, чтобы автосейв новой её не перезаписал.
    expect(loadActiveSession()).toBeNull();
  });

  it('сессия другого плана сегодня архивируется, а не затирается', () => {
    putActive(40);
    const archived = archiveActiveSession();
    expect(archived).not.toBeNull();
    expect(loadSessions()).toHaveLength(1);
    expect(loadActiveSession()).toBeNull();
  });

  it('битый startTime даёт длительность 0, а не «стенные» часы через полночь', () => {
    putActive(90, { startTime: '' });
    const archived = archiveActiveSession();
    expect(archived?.durationMin).toBe(0);
  });

  it('пустая живая сессия (без подходов) не попадает в историю', () => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ ...mkSession(), savedAt: Date.now() }));
    expect(archiveActiveSession()).toBeNull();
    expect(loadSessions()).toHaveLength(0);
  });

  it('длительность архива сверх потолка сессии обрезается', () => {
    // Старт 20 часов назад, автосейв только что: в дневник не должно уехать 1200 минут.
    putActive(20 * 60, { savedAt: Date.now() });
    const archived = archiveActiveSession();
    expect(archived?.durationMin).toBe(MAX_SESSION_DURATION_MIN);
  });

  it('если историю записать не удалось, живая сессия остаётся', () => {
    putActive(40);
    // Квота: любая запись в storage падает, включая каскад обрезки истории.
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    let archived: ReturnType<typeof archiveActiveSession> = null;
    try {
      archived = archiveActiveSession();
    } finally {
      spy.mockRestore();
    }
    expect(archived).toBeNull();
    // Подходы не исчезли вместе с «успешным» архивом.
    expect(loadActiveSession()).not.toBeNull();
  });
});

describe('finishSession: границы длительности', () => {
  it('явная длительность сверх потолка обрезается, конец = старт + длительность', () => {
    const fin = finishSession({ ...mkSession(), startTime: '18:30' }, '', 870);
    expect(fin.durationMin).toBe(MAX_SESSION_DURATION_MIN);
    // Продолжение вчерашней сессии не должно выглядеть как «18:30–09:05».
    expect(fin.endTime).toBe('00:30');
  });

  it('явный 0 остаётся нулём, а не «стенными» часами', () => {
    const fin = finishSession({ ...mkSession(), startTime: '18:30' }, '', 0);
    expect(fin.durationMin).toBe(0);
  });
});
