/**
 * workout-summary-rir-legacy.test.ts — легаси-ноль RIR в сводке и в отчёте.
 *
 * Старые сборки писали `rir: 0` как заполнитель: пара `rir: 0, rpe: 8` — это RIR 2,
 * а не работа до отказа. Настоящий отказ — только `rir: 0` при `rpe: 10`.
 */
import { describe, expect, it } from 'vitest';
import { buildSetDetails, buildWorkoutSummary } from '../workout-summary.engine';
import type { StrengthLogEntry, WorkoutLog } from '../../core/types';

type SetRow = { weight: number; reps: number; rir: number; rpe?: number };

function mkWorkout(sets: SetRow[], date = '2026-11-24'): WorkoutLog {
  const exercise: StrengthLogEntry = {
    id: `${date}_0`,
    date,
    exerciseId: 'bench_bar',
    exerciseName: 'Жим штанги лёжа',
    isCompound: true,
    weekNumber: 1,
    sets,
    totalVolume: sets.reduce((acc, s) => acc + s.weight * s.reps, 0),
    estimated1RM: 0,
  };
  return {
    id: `w_${date}`,
    date,
    duration: 50,
    exercises: [exercise],
    overallRPE: 8,
    recoveryBefore: 4,
    split: 'FullBody',
  };
}

describe('workout-summary: честный RIR легаси-записей', () => {
  it('ноль с RPE 8 — заполнитель (RIR 2), ноль с RPE 0 — «не вводили»', () => {
    const s = buildWorkoutSummary([
      mkWorkout([
        { weight: 100, reps: 5, rir: 0, rpe: 8 },
        { weight: 100, reps: 5, rir: 0, rpe: 0 },
      ]),
    ]);
    expect(s.totals.failureSets).toBe(0);
    expect(s.totals.avgRIR).toBe(2);
    expect(s.totals.rirLoggedSets).toBe(1);
  });

  it('ноль при RPE 10 — настоящий отказ', () => {
    const s = buildWorkoutSummary([mkWorkout([{ weight: 100, reps: 5, rir: 0, rpe: 10 }])]);
    expect(s.totals.failureSets).toBe(1);
    expect(s.totals.avgRIR).toBe(0);
  });

  it('строка отчёта печатает RIR 2, а не легаси-ноль', () => {
    const w = mkWorkout([{ weight: 100, reps: 5, rir: 0, rpe: 8 }]);
    const row = buildSetDetails([w])[0].exercises[0].sets[0];
    expect(row.rir).toBe(2);
  });
});
