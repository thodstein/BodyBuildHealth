/**
 * pl-session-logging-2026-11.test.ts — регрессы P0-3 из аудита 2026-11:
 *
 *  • повторное «✓» по тому же подходу в плеере — это ПРАВКА, а не второй подход
 *    (без withoutSetNumber подход дублировался: объём/1ПМ/PR считались дважды);
 *  • отказ движка logSet (success=false, вес 0 / сверх лимита) больше не глотается:
 *    подход не помечается выполненным, причина видна пользователю.
 */
import { describe, expect, it } from 'vitest';
import { withoutSetNumber } from '../SessionPlayer';
import { startSession, addExerciseToSession, logSet } from '../../../../engines/workout-logger.engine';

function sessionWithSquat() {
  let s = startSession('PL', 1);
  s = addExerciseToSession(s, { id: 'squat', name: 'Присед', pattern: 'squat', muscleGroup: 'legs' });
  return s;
}

const set = (weightKg: number, overrides: Record<string, unknown> = {}) => ({
  setNumber: 1, weightKg, reps: 5, rpe: 8, rir: 2, notes: '', ...overrides,
});

describe('P0-3: запись подходов в плеере', () => {
  it('withoutSetNumber убирает подход с тем же setNumber и пересчитывает производные', () => {
    const s1 = logSet(sessionWithSquat(), 0, set(100)).session;
    const cleaned = withoutSetNumber(s1, 0, 1);
    expect(cleaned.exercises[0].sets.length).toBe(0);
    expect(cleaned.exercises[0].totalVolume).toBe(0);
    expect(cleaned.exercises[0].best1RM).toBe(0);
  });

  it('повторная запись того же сета не удваивает подход и объём', () => {
    const r1 = logSet(sessionWithSquat(), 0, set(100));
    expect(r1.success).toBe(true);
    const r2 = logSet(withoutSetNumber(r1.session, 0, 1), 0, set(110));
    expect(r2.success).toBe(true);
    const sets = r2.session.exercises[0].sets;
    expect(sets.length).toBe(1);
    expect(sets[0].weightKg).toBe(110);
    expect(r2.session.exercises[0].totalVolume).toBe(550);
  });

  it('правка веса ВНИЗ не оставляет завышенный 1ПМ упражнения', () => {
    const r1 = logSet(sessionWithSquat(), 0, set(120));
    const best1 = r1.session.exercises[0].best1RM;
    const r2 = logSet(withoutSetNumber(r1.session, 0, 1), 0, set(80));
    expect(r2.session.exercises[0].best1RM).toBeLessThan(best1);
  });

  it('отказ движка (вес 0) возвращает success:false + причину и не пишет подход', () => {
    const r = logSet(sessionWithSquat(), 0, set(0));
    expect(r.success).toBe(false);
    expect(r.reason).toBeTruthy();
    expect(r.session.exercises[0].sets.length).toBe(0);
  });
});
