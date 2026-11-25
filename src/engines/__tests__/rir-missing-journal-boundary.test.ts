/**
 * rir-missing-journal-boundary.test.ts — «RIR не вводили» переживает границу
 * сессия → журнал → отчёт.
 *
 * Без этого ноль-заполнитель читался как «до отказа»: средний RIR занижался,
 * failureSets рос, а экран тренировок видел `rirMissing` всегда undefined.
 */
import { describe, expect, it } from 'vitest';
import {
  addExerciseToSession,
  logSet,
  startSession,
  workoutLogToSession,
  type WorkoutSession,
} from '../workout-logger.engine';
import { sessionToWorkoutLog } from '../strength-diary.engine';
import { buildSetDetails, buildWorkoutReportText, buildWorkoutSummary } from '../workout-summary.engine';

/** Подход 1 — без оценки (rirMissing), подход 2 — измеренный RIR 2. */
function sessionWithFlag(): WorkoutSession {
  let s = addExerciseToSession(startSession('День 1 · жим', 1), {
    id: 'bench',
    name: 'Жим лёжа',
    pattern: 'horizontal_push',
    muscleGroup: 'chest',
  });
  s = logSet(s, 0, { setNumber: 1, weightKg: 100, reps: 5, rpe: 0, rir: 0, rirMissing: true, notes: '' }).session;
  s = logSet(s, 0, { setNumber: 2, weightKg: 100, reps: 5, rpe: 8, rir: 2, notes: '' }).session;
  return { ...s, date: '2026-11-24', durationMin: 50 };
}

describe('RIR «не вводили» в журнале и отчёте', () => {
  it('метка сохраняется в WorkoutLog, измеренный подход остаётся без метки', () => {
    const log = sessionToWorkoutLog(sessionWithFlag());
    const sets = log.exercises[0].sets;
    expect(sets[0].rirMissing).toBe(true);
    expect(sets[1].rirMissing).toBeUndefined();
  });

  it('средний RIR и отказы считаются только по измеренным подходам', () => {
    const summary = buildWorkoutSummary([sessionToWorkoutLog(sessionWithFlag())]);
    // С нулём-заполнителем в среднем было бы 1, а failureSets — 1.
    expect(summary.totals.avgRIR).toBe(2);
    expect(summary.totals.failureSets).toBe(0);
    expect(summary.totals.rirLoggedSets).toBe(1);
    // Тот же инвариант для RPE: ноль-заполнитель не должен занижать среднюю
    // интенсивность и глушить триггер разгрузки (avgRPE ≥ 9).
    expect(summary.totals.avgRPE).toBe(8);
  });

  it('подробности подхода печатают «@—», а не выдуманный «@0»', () => {
    const log = sessionToWorkoutLog(sessionWithFlag());
    const details = buildSetDetails([log]);
    expect(details[0].exercises[0].sets[0].rirMissing).toBe(true);
    const text = buildWorkoutReportText(buildWorkoutSummary([log]), { details });
    expect(text).toContain('100×5@—');
    expect(text).not.toContain('100×5@0');
  });

  it('обратный маппер не выдумывает RIR 2 и сохраняет метку', () => {
    const back = workoutLogToSession(sessionToWorkoutLog(sessionWithFlag()));
    const sets = back.exercises[0].sets;
    expect(sets[0].rirMissing).toBe(true);
    expect(sets[0].rir).toBe(0);
    expect(sets[1].rirMissing).toBeUndefined();
  });
});
