import { describe, it, expect, beforeEach } from 'vitest';
import {
  sessionToWorkoutLog,
  sessionsToWorkoutLogs,
  workoutLogToSessionLogEntry,
  workoutLogToStrengthLogEntries,
  sessionToStrengthLogEntries,
  mergeDiaryEntries,
} from '../session-mapper';
import { startSession, addExerciseToSession, logSet, finishSession, loadSessions, saveSessions } from '../workout-logger.engine';
import type { WorkoutLog, StrengthLogEntry } from '../../core/types';

describe('session-mapper', () => {
  describe('sessionToWorkoutLog', () => {
    it('converts WorkoutSession to WorkoutLog', () => {
      const session = startSession('fullbody', 1);
      const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
      const logged = logSet(withEx, 0, { setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2 }).session;
      const finished = finishSession(logged, 'Test');

      const log = sessionToWorkoutLog(finished);
      expect(log.id).toBe(finished.sessionId);
      expect(log.date).toBe(finished.date);
      expect(log.exercises).toHaveLength(1);
      expect(log.exercises[0].exerciseName).toBe('Squat');
      expect(log.exercises[0].sets).toHaveLength(1);
      expect(log.exercises[0].sets[0].weight).toBe(100);
      expect(log.overallRPE).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sessionsToWorkoutLogs', () => {
    it('converts array of sessions', () => {
      const s1 = startSession('fullbody', 1);
      const s2 = startSession('upper', 2);
      const logs = sessionsToWorkoutLogs([s1, s2]);
      expect(logs).toHaveLength(2);
      expect(logs[0].split).toBe('fullbody');
      expect(logs[1].split).toBe('upper');
    });
  });

  describe('workoutLogToSessionLogEntry', () => {
    it('converts WorkoutLog to SessionLogEntryLite', () => {
      const log: WorkoutLog = {
        id: 'test_1',
        date: '2024-01-01',
        duration: 60,
        exercises: [
          {
            id: 'ex_1',
            exerciseId: 'squat',
            exerciseName: 'Squat',
            sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }],
            totalVolume: 500,
            estimated1RM: 120,
            isCompound: true,
          }
        ],
        overallRPE: 8,
        recoveryBefore: 5,
        split: 'fullbody',
        weekNumber: 1,
      };

      const entry = workoutLogToSessionLogEntry(log);
      expect(entry.sessionId).toBe('test_1');
      expect(entry.focus).toBe('fullbody');
      expect(entry.sets).toHaveLength(1);
      expect(entry.sets[0].exerciseName).toBe('Squat');
      expect(entry.sets[0].weight).toBe(100);
    });
  });

  describe('workoutLogToStrengthLogEntries', () => {
    it('converts WorkoutLog to StrengthLogEntry[]', () => {
      const log: WorkoutLog = {
        id: 'test_1',
        date: '2024-01-01',
        duration: 60,
        exercises: [
          {
            id: 'ex_1',
            exerciseId: 'squat',
            exerciseName: 'Squat',
            sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }],
            totalVolume: 500,
            estimated1RM: 120,
            isCompound: true,
          }
        ],
        overallRPE: 8,
        recoveryBefore: 5,
        split: 'fullbody',
        weekNumber: 1,
      };

      const entries = workoutLogToStrengthLogEntries(log);
      expect(entries).toHaveLength(1);
      expect(entries[0].exerciseId).toBe('squat');
      expect(entries[0].sets[0].weight).toBe(100);
    });
  });

  describe('sessionToStrengthLogEntries', () => {
    it('converts WorkoutSession to StrengthLogEntry[]', () => {
      const session = startSession('fullbody', 1);
      const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
      const logged = logSet(withEx, 0, { setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2 }).session;

      const entries = sessionToStrengthLogEntries(logged);
      expect(entries).toHaveLength(1);
      expect(entries[0].exerciseName).toBe('Squat');
    });
  });

  describe('mergeDiaryEntries', () => {
    it('deduplicates by date|exercise|weight|reps', () => {
      const idbLogs: WorkoutLog[] = [
        {
          id: 'idb_1',
          date: '2024-01-01',
          duration: 60,
          exercises: [
            {
              id: 'ex_1',
              exerciseId: 'squat',
              exerciseName: 'Squat',
              sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }],
              totalVolume: 500,
              estimated1RM: 120,
              isCompound: true,
            }
          ],
          overallRPE: 8,
          recoveryBefore: 5,
          split: 'fullbody',
          weekNumber: 1,
        }
      ];

      const session = startSession('fullbody', 1);
      session.date = '2024-01-01';
      const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
      const logged = logSet(withEx, 0, { setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2 }).session;
      const finished = finishSession(logged);

      const merged = mergeDiaryEntries(idbLogs, [finished]);
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('idb');
    });

    it('includes localStorage entries not in IDB', () => {
      const idbLogs: WorkoutLog[] = [];

      const session = startSession('fullbody', 1);
      const withEx = addExerciseToSession(session, { id: 'bench', name: 'Bench', pattern: 'horizontal_push', muscleGroup: 'chest' });
      const logged = logSet(withEx, 0, { setNumber: 1, weightKg: 80, reps: 5, rpe: 7, rir: 2 }).session;
      const finished = finishSession(logged);

      const merged = mergeDiaryEntries(idbLogs, [finished]);
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('localStorage');
      expect(merged[0].exerciseName).toBe('Bench');
    });

    it('keeps only non-overlapping sets when sources partially overlap', () => {
      const idbLogs: WorkoutLog[] = [{
        id: 'idb_1', date: '2024-01-01', duration: 60,
        exercises: [{ id: 'ex_1', exerciseId: 'squat', exerciseName: 'Squat',
          sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }], totalVolume: 500,
          estimated1RM: 120, isCompound: true }], overallRPE: 8,
        recoveryBefore: 5, split: 'fullbody', weekNumber: 1,
      }];
      const session = startSession('fullbody', 1);
      session.date = '2024-01-01';
      const withEx = addExerciseToSession(session, { id: 'squat', name: 'Squat', pattern: 'squat', muscleGroup: 'quads' });
      const first = logSet(withEx, 0, { setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2 }).session;
      const second = logSet(first, 0, { setNumber: 2, weightKg: 95, reps: 5, rpe: 8, rir: 2 }).session;
      const merged = mergeDiaryEntries(idbLogs, [second]);
      expect(merged).toHaveLength(2);
      expect(merged.find(e => e.weight === 100)?.source).toBe('idb');
      expect(merged.find(e => e.weight === 95)?.source).toBe('localStorage');
    });

    it('sorts by date descending', () => {
      const idbLogs: WorkoutLog[] = [];
      const sessions: WorkoutSession[] = [];

      const makeSession = (date: string, name: string) => {
        const s = startSession('fullbody', 1);
        s.date = date;
        const withEx = addExerciseToSession(s, { id: name.toLowerCase(), name, pattern: 'squat', muscleGroup: 'quads' });
        const logged = logSet(withEx, 0, { setNumber: 1, weightKg: 100, reps: 5, rpe: 7, rir: 2 }).session;
        return finishSession(logged);
      };

      const s1 = makeSession('2024-01-03', 'C');
      const s2 = makeSession('2024-01-01', 'A');
      const s3 = makeSession('2024-01-02', 'B');

      const merged = mergeDiaryEntries(idbLogs, [s1, s2, s3]);
      expect(merged).toHaveLength(3);
      expect(merged[0].date).toBe('2024-01-03');
      expect(merged[1].date).toBe('2024-01-02');
      expect(merged[2].date).toBe('2024-01-01');
    });
  });
});
