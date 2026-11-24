/**
 * workout-logger-undo.test.ts — отмена последнего подхода («Отменить подход»)
 * и честность PR относительно базиса (e1RM не ниже текущего максимума).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addExerciseToSession,
  logSet,
  removeLastSet,
  startSession,
  saveActiveSession,
  loadActiveSession,
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
