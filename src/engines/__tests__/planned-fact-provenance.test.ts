import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/db', () => ({
  db: {
    getAll: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    getByIndex: vi.fn(),
    getByDateRange: vi.fn(),
    clear: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '../../core/db';
import {
  addExerciseToSession,
  finishSession,
  loadSessions,
  logSet,
  startSession,
  workoutLogToSession,
} from '../workout-logger.engine';
import { StrengthDiary } from '../strength-diary.engine';
import {
  mergeDiaryEntries,
  workoutLogToSessionLogEntry,
  workoutLogToStrengthLogEntries,
} from '../session-mapper';

describe('planned-fact provenance', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (db.getAll as any).mockResolvedValue([]);
    (db.put as any).mockResolvedValue(undefined);
  });

  it('keeps planned targets and session provenance through localStorage and IDB', async () => {
    let session = startSession('BB', 4, {
      source: 'BB',
      provenanceSource: 'BB',
      planSnapshotId: 'plan-1',
      plannedSessionId: 'planned-1',
    });
    session = addExerciseToSession(session, {
      id: 'bench',
      name: 'Жим',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });
    const logged = logSet(session, 0, {
      setNumber: 1,
      weightKg: 82.5,
      reps: 8,
      rpe: 8,
      rir: 2,
      notes: '',
      plannedWeight: 80,
      plannedReps: 10,
      plannedRir: 3,
      plannedTempo: '3-1-1-0',
      actualTempo: '3-0-1-0',
    });
    const finished = finishSession(logged.session, 'fact');

    expect(finished.planSnapshotId).toBe('plan-1');
    expect(loadSessions()[0].exercises[0].sets[0].plannedReps).toBe(10);

    const diary = new StrengthDiary();
    const logs = await diary.getWorkoutLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].source).toBe('BB');
    expect(logs[0].provenanceSource).toBe('BB');
    expect(logs[0].planSnapshotId).toBe('plan-1');
    expect(logs[0].plannedSessionId).toBe('planned-1');
    expect(logs[0].exercises[0].sets[0].plannedWeight).toBe(80);
    expect(logs[0].exercises[0].sets[0].plannedRir).toBe(3);

    const restored = workoutLogToSession(logs[0]);
    expect(restored.planSnapshotId).toBe('plan-1');
    expect(restored.exercises[0].sets[0].plannedReps).toBe(10);
  });

  it('keeps provenance in strength, analytics, and unified diary adapters', () => {
    const log = {
      id: 'session-1',
      date: '2026-09-25',
      duration: 45,
      source: 'ARM',
      provenanceSource: 'ARM',
      planSnapshotId: 'plan-2',
      plannedSessionId: 'planned-2',
      weekNumber: 7,
      split: 'ARM',
      exercises: [{
        id: 'ex-1',
        date: '2026-09-25',
        exerciseId: 'press',
        exerciseName: 'Жим',
        sets: [{
          weight: 80,
          reps: 8,
          rir: 2,
          rpe: 8,
          plannedWeight: 82.5,
          plannedReps: 6,
          plannedRir: 3,
        }],
        totalVolume: 640,
        estimated1RM: 101,
        isCompound: true,
      }],
    } as any;

    const strength = workoutLogToStrengthLogEntries(log)[0];
    const analytics = workoutLogToSessionLogEntry(log);
    const unified = mergeDiaryEntries([log], [])[0];

    expect(strength.planSnapshotId).toBe('plan-2');
    expect(strength.sets[0].plannedReps).toBe(6);
    expect(analytics.source).toBe('ARM');
    expect(analytics.weekNumber).toBe(7);
    expect(analytics.sets[0].plannedRir).toBe(3);
    expect(unified.provenanceSource).toBe('ARM');
    expect(unified.plannedSessionId).toBe('planned-2');
    expect(unified.plannedWeight).toBe(82.5);
  });
});
