import { describe, it, expect, beforeEach } from 'vitest';
import { importSessionsFromCSV, logSet, startSession, finishSession, addExerciseToSession, getWorkoutStats, loadSessions, saveSessions } from '../workout-logger.engine';

// минимальный mock localStorage (движок использует localStorage для he_workout_log_v2)
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  (global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
});

describe('importSessionsFromCSV', () => {
  it('импортирует 2 даты → 2 сессии, считает сеты', () => {
    const csv = 'date,exercise,set,weight,reps,rpe,rir\n2026-06-01,Жим лёжа,1,80,5,7,2\n2026-06-01,Жим лёжа,2,80,5,7,2\n2026-06-03,Присед,1,100,5,8,2';
    const r = importSessionsFromCSV(csv);
    expect(r.importedSessions).toBe(2);
    expect(r.importedSets).toBe(3);
  });

  it('пропускает строки с плохой датой и пишет ошибку', () => {
    const csv = 'date,exercise,set,weight,reps\nbad-date,Жим,1,80,5\n2026-06-05,Жим,1,80,5';
    const r = importSessionsFromCSV(csv);
    expect(r.importedSessions).toBe(1);
    expect(r.errors.some(e => e.includes('дата'))).toBe(true);
  });

  it('пустой ввод → ошибка', () => {
    const r = importSessionsFromCSV('');
    expect(r.importedSessions).toBe(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('дедуп: повторный импорт тех же дат не дублирует', () => {
    const csv = 'date,exercise,set,weight,reps\n2026-06-07,Жим,1,80,5';
    const r1 = importSessionsFromCSV(csv);
    const r2 = importSessionsFromCSV(csv);
    expect(r1.importedSessions).toBe(1);
    expect(r2.importedSessions).toBe(0);
  });
});

describe('logSet validation', () => {
  it('ignores non-positive weight/reps', () => {
    const session = startSession('fullbody', 1);
    const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
    const modified = logSet(withEx, 0, { weightKg: 0, reps: 0, rpe: 7, rir: 2 });
    expect(modified.exercises[0].sets.length).toBe(0);
    expect(modified.totalVolume).toBe(0);
  });

  it('ignores negative weight/reps', () => {
    const session = startSession('fullbody', 1);
    const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
    const modified = logSet(withEx, 0, { weightKg: -10, reps: -5, rpe: 7, rir: 2 });
    expect(modified.exercises[0].sets.length).toBe(0);
  });

  it('clamps RPE to 0-10 and RIR to 0-20', () => {
    const session = startSession('fullbody', 1);
    const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
    const modified = logSet(withEx, 0, { weightKg: 100, reps: 5, rpe: 15, rir: 30 });
    expect(modified.exercises[0].sets[0].rpe).toBe(10);
    expect(modified.exercises[0].sets[0].rir).toBe(20);
  });

  it('returns original session for out-of-range exerciseIndex', () => {
    const session = startSession('fullbody', 1);
    const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
    const modified = logSet(withEx, 99, { weightKg: 100, reps: 5, rpe: 7, rir: 2 });
    expect(modified.exercises[0].sets.length).toBe(0);
  });

  it('rounds reps and preserves integer values', () => {
    const session = startSession('fullbody', 1);
    const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
    const modified = logSet(withEx, 0, { weightKg: 100, reps: 5.7, rpe: 7, rir: 2 });
    expect(modified.exercises[0].sets[0].reps).toBe(6);
  });
});

describe('finishSession', () => {
  it('returns session with date and notes', () => {
    const session = startSession('fullbody', 1);
    const finished = finishSession(session, 'Test notes');
    expect(finished.date).toBe(new Date().toISOString().slice(0, 10));
    expect(finished.notes).toBe('Test notes');
    expect(finished.durationMin).toBeGreaterThanOrEqual(0);
  });
});

describe('getWorkoutStats', () => {
  it('returns zero stats for empty history', () => {
    const stats = getWorkoutStats();
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalVolume).toBe(0);
    expect(stats.streak).toBe(0);
  });

  it('computes stats from localStorage sessions', () => {
    const s1 = startSession('fullbody', 1);
    const s2 = finishSession(addExerciseToSession(s1, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' }));
    s2.exercises[0].sets = [{ setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2, isPR: true, notes: '' }];
    s2.totalVolume = 500;
    saveSessions([s2]);
    const stats = getWorkoutStats();
    expect(stats.totalSessions).toBeGreaterThanOrEqual(1);
    expect(stats.totalVolume).toBeGreaterThanOrEqual(500);
  });
});

describe('loadSessions / saveSessions quota', () => {
  it('loadSessions returns empty array for corrupted storage', () => {
    (global as any).localStorage.getItem = () => 'not-json';
    const sessions = loadSessions();
    expect(sessions).toEqual([]);
  });

  it('loadSessions returns empty array for non-array storage', () => {
    (global as any).localStorage.getItem = () => '{}';
    const sessions = loadSessions();
    expect(sessions).toEqual([]);
  });
});