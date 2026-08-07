import { describe, expect, it, vi } from 'vitest';
import { recordSessionRIR, getExerciseCalibration, getAdjustedRIR, getSessionRIRFeedback, clearCalibrationData } from '../rir-calibration.engine';
import type { WorkoutSession, WorkoutExercise, WorkoutSet } from '../workout-logger.engine';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

function makeSession(sets: { rpe: number; rir: number; weightKg: number; reps: number }[]): WorkoutSession {
  const ex: WorkoutExercise = {
    exerciseId: 'squat', exerciseName: 'Присед', pattern: 'squat', muscleGroup: 'quads', order: 1,
    sets: sets.map((s, i) => ({ setNumber: i + 1, weightKg: s.weightKg, reps: s.reps, rpe: s.rpe, rir: s.rir, isPR: false, notes: '' })),
    totalVolume: 0, best1RM: 0, avgRPE: 0,
  };
  return {
    sessionId: 's1', date: '2026-07-15', startTime: '10:00', endTime: '11:00', durationMin: 60,
    focus: 'legs', exercises: [ex], totalVolume: 0, totalSets: sets.length, totalReps: 0,
    avgIntensity: 0, prCount: 0, notes: '', weekNumber: 1, mesocycleWeek: 1,
  };
}

describe('recordSessionRIR and getExerciseCalibration', () => {
  it('records calibration points and computes avgBias', () => {
    clearCalibrationData();
    const session = makeSession([
      { rpe: 7, rir: 3, weightKg: 100, reps: 5 },
      { rpe: 8, rir: 2, weightKg: 100, reps: 5 },
    ]);
    recordSessionRIR(session, { exercises: [{ name: 'Присед', targetSets: [{ rir: 2 }, { rir: 2 }] }] });

    const cal = getExerciseCalibration('squat');
    expect(cal).not.toBeNull();
    expect(cal!.totalPoints).toBe(2);
    expect(cal!.avgBias).toBeCloseTo(-0.5, 0);
  });

  it('returns null for <2 points', () => {
    clearCalibrationData();
    const session = makeSession([{ rpe: 7, rir: 3, weightKg: 100, reps: 5 }]);
    recordSessionRIR(session, { exercises: [{ name: 'Присед', targetSets: [{ rir: 2 }] }] });
    expect(getExerciseCalibration('squat')).toBeNull();
  });
});

describe('getAdjustedRIR', () => {
  it('returns planned RIR when no data', () => {
    clearCalibrationData();
    const result = getAdjustedRIR('squat', 2);
    expect(result.adjustedRIR).toBe(2);
    expect(result.bias).toBe(0);
  });
});

describe('getSessionRIRFeedback', () => {
  it('computes bias and recommendation', () => {
    clearCalibrationData();
    const session = makeSession([
      { rpe: 9, rir: 1, weightKg: 100, reps: 5 },
      { rpe: 8, rir: 2, weightKg: 100, reps: 5 },
    ]);
    const feedback = getSessionRIRFeedback(session, { exercises: [{ name: 'Присед', targetSets: [{ rir: 2 }, { rir: 2 }] }] });
    expect(feedback.exerciseFeedbacks).toHaveLength(1);
    expect(feedback.exerciseFeedbacks[0].name).toBe('Присед');
    expect(feedback.overallBias).toBeGreaterThan(0);
  });
});
