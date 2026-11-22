/**
 * workout-logger-bodyweight.test.ts — подходы с собственным весом.
 *
 * Подтягивания/отжимания приходят из плана с `weight = 0`, и до этого движок
 * отклонял любой такой подход («вес и повторения должны быть больше 0»), то есть
 * день с турником нельзя было записать вообще. Теперь вес 0 допустим только с
 * явным флагом `bodyweight`, а нулевой вес без флага по-прежнему отклоняется.
 */
import { describe, expect, it } from 'vitest';
import { addExerciseToSession, loadSessions, logSet, startSession } from '../workout-logger.engine';

const fresh = () => {
  const s = startSession('День 2 · турник', 1);
  return addExerciseToSession(s, {
    id: 'pullup',
    name: 'Подтягивания',
    pattern: 'vertical_pull',
    muscleGroup: 'back',
  });
};

const setOf = (setNumber: number, weightKg: number, reps: number) => ({
  setNumber,
  weightKg,
  reps,
  rpe: 8,
  rir: 2,
  notes: '',
});

describe('logSet — собственный вес', () => {
  it('вес 0 с флагом bodyweight записывается: подход учтён, тоннаж 0, PR не выдуман', () => {
    const res = logSet(fresh(), 0, { ...setOf(1, 0, 10), bodyweight: true });
    expect(res.success).toBe(true);
    const sets = res.session.exercises[0].sets;
    expect(sets.length).toBe(1);
    expect(sets[0].weightKg).toBe(0);
    expect(sets[0].reps).toBe(10);
    expect(sets[0].bodyweight).toBe(true);
    expect(sets[0].isPR).toBe(false);
    expect(res.session.totalVolume).toBe(0);
    expect(res.session.totalSets).toBe(1);
    expect(res.session.prCount).toBe(0);
  });

  it('вес 0 без флага по-прежнему отклоняется', () => {
    const res = logSet(fresh(), 0, setOf(1, 0, 10));
    expect(res.success).toBe(false);
    expect(res.session.exercises[0].sets.length).toBe(0);
  });

  it('с отягощением флаг не превращает подход в собственный вес', () => {
    const res = logSet(fresh(), 0, { ...setOf(1, 20, 6), bodyweight: true });
    expect(res.success).toBe(true);
    const set = res.session.exercises[0].sets[0];
    expect(set.bodyweight).toBeUndefined();
    expect(set.weightKg).toBe(20);
    expect(res.session.totalVolume).toBe(120);
  });

  it('дневник хранит флаг: после сохранения подход остаётся «своим весом»', () => {
    const res = logSet(fresh(), 0, { ...setOf(1, 0, 12), bodyweight: true });
    const stored = res.session;
    expect(stored.exercises[0].sets[0].bodyweight).toBe(true);
    // и сессия не «пустая» для автосейва: в ней есть подход
    expect(stored.exercises[0].sets.length).toBe(1);
    expect(loadSessions().length).toBe(0);
  });
});
