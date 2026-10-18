/**
 * Тесты новых фич хаба «Мастер движений» (план §13):
 *  - phaseForJointAngle (B8: угол колена из видео → каноническая фаза);
 *  - pause round-trip дневника (C1: пауза на груди сохраняется во всех слоях);
 *  - dailyReadinessCheck / rpeVbtDiscrepancy (A3/A4: сигнатуры и границы);
 *  - estimate1RMConsensus (A2: консенсус 1RM для секции «Тренировочный максимум»).
 */
import { describe, expect, it } from 'vitest';
import { phaseForJointAngle } from '../lift-diagnostics.engine';
import { logSet, startSession, addExerciseToSession, workoutLogToSession } from '../../workout-logger.engine';
import { dailyReadinessCheck, rpeVbtDiscrepancy, velocityForPct } from '../vbt.engine';
import { estimate1RMConsensus } from '../estimate1rm.engine';
import type { WorkoutLog } from '../../../core/types';

describe('B8: phaseForJointAngle — угол колена → фаза срыва', () => {
  it('присед: глубокий угол колена → bottom, средний → mid, выпрямленный → lockout', () => {
    expect(phaseForJointAngle('squat', 60)).toBe('bottom');
    expect(phaseForJointAngle('squat', 110)).toBe('mid');
    expect(phaseForJointAngle('squat', 160)).toBe('lockout');
  });
  it('тяга: диапазоны start/mid/lockout', () => {
    expect(phaseForJointAngle('deadlift', 15)).toBe('start');
    expect(phaseForJointAngle('deadlift', 60)).toBe('mid');
    expect(phaseForJointAngle('deadlift', 150)).toBe('lockout');
  });
  it('вне диапазонов или для лифта без точек — null', () => {
    expect(phaseForJointAngle('squat', 200)).toBeNull();
    expect(phaseForJointAngle('incline', 45)).toBeNull();
  });
});

describe('C1: pause round-trip дневника', () => {
  it('logSet сохраняет pause, workoutLogToSession не теряет флаг', () => {
    let s = startSession('тест', 1);
    s = addExerciseToSession(s, { id: 'bench_bar', name: 'Жим штанги лёжа', pattern: 'horizontal_push', muscleGroup: 'chest' });
    const r1 = logSet(s, 0, { setNumber: 1, weightKg: 100, reps: 3, rpe: 8, rir: 2, pause: true, notes: '' });
    expect(r1.success).toBe(true);
    const withPause = r1.session.exercises[0].sets[0];
    expect(withPause.pause).toBe(true);

    const r2 = logSet(r1.session, 0, { setNumber: 2, weightKg: 100, reps: 3, rpe: 8, rir: 2, notes: '' });
    expect(r2.session.exercises[0].sets[1].pause).toBeUndefined();

    // Зеркало: WorkoutLog → WorkoutSession, pause проходит оба слоя
    const log: WorkoutLog = {
      id: 'w1', date: '2026-10-18', duration: 40,
      exercises: [{
        id: 'w1_bench_bar', date: '2026-10-18', exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа',
        sets: [{ weight: 100, reps: 3, rir: 2, rpe: 8, pause: true }, { weight: 100, reps: 3, rir: 2, rpe: 8 }],
        totalVolume: 600, estimated1RM: 116, isCompound: true,
      }],
      overallRPE: 8, recoveryBefore: 5, split: 'quick',
    };
    const mirrored = workoutLogToSession(log);
    expect(mirrored.exercises[0].sets[0].pause).toBe(true);
    expect(mirrored.exercises[0].sets[1].pause).toBeUndefined();
  });
});

describe('A3: dailyReadinessCheck — готовность первым подходом', () => {
  it('норма → as-planned, падение 12-20% → reduce-volume-20, сильное → deload', () => {
    const expected = velocityForPct('bench', 0.75);
    expect(expected).toBeGreaterThan(0);
    expect(dailyReadinessCheck(expected, expected).action).toBe('as-planned');
    const mid = expected * 0.85;
    expect(dailyReadinessCheck(expected, mid).action).toBe('reduce-volume-20');
    const bad = expected * 0.7;
    expect(dailyReadinessCheck(expected, bad).action).toBe('deload');
  });
});

describe('A4: rpeVbtDiscrepancy — скрытая усталость / калибровка', () => {
  it('RPE 9 при быстрой скорости → скрытая усталость; согласовано → ok', () => {
    // Скорость для лёгкого процента не соответствует тяжёлому RPE
    const v = velocityForPct('squat', 0.6);
    const d = rpeVbtDiscrepancy(9.5, v, 'squat', 3);
    expect(d.flag).toBe('hidden-fatigue');
    const v2 = velocityForPct('squat', 0.85);
    const d2 = rpeVbtDiscrepancy(8.5, v2, 'squat', 2);
    expect(d2.flag).toBe('ok');
  });
});

describe('A2: estimate1RMConsensus — тренировочный максимум хаба', () => {
  it('консенсус близок к Epley и даёт разброс формул', () => {
    const c = estimate1RMConsensus(100, 5);
    expect(c.value).toBeGreaterThan(110);
    expect(c.value).toBeLessThan(130);
    expect(c.n).toBeGreaterThanOrEqual(5);
    expect(c.max).toBeGreaterThanOrEqual(c.min);
  });
});
