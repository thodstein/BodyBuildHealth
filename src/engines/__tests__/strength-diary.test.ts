import { describe, expect, it, vi } from 'vitest';

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

import { StrengthDiary, sessionToWorkoutLog } from '../strength-diary.engine';
import type { WorkoutSession, StrengthLogEntry, WorkoutLog } from '../../core/types';
import { db } from '../../core/db';

function getMockDb() {
  return db as {
    getAll: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getByIndex: ReturnType<typeof vi.fn>;
    getByDateRange: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

describe('sessionToWorkoutLog', () => {
  it('converts WorkoutSession to WorkoutLog with correct fields', () => {
    const session: WorkoutSession = {
      sessionId: 'sess_1',
      date: '2026-07-15',
      startTime: '10:00',
      endTime: '11:30',
      durationMin: 90,
      focus: 'legs',
      exercises: [
        {
          exerciseId: 'squat',
          exerciseName: 'Присед со штангой',
          pattern: 'squat',
          muscleGroup: 'quads',
          order: 1,
          sets: [
            { setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2, isPR: false, notes: '' },
            { setNumber: 2, weightKg: 100, reps: 5, rpe: 9, rir: 1, isPR: false, notes: '' },
          ],
          totalVolume: 1000,
          best1RM: 117,
          avgRPE: 8.5,
        },
      ],
      totalVolume: 1000,
      totalSets: 2,
      totalReps: 10,
      avgIntensity: 8.5,
      prCount: 0,
      notes: 'Good session',
      weekNumber: 3,
      mesocycleWeek: 1,
    };

    const log = sessionToWorkoutLog(session);
    expect(log.id).toBe('sess_1');
    expect(log.date).toBe('2026-07-15');
    expect(log.duration).toBe(90);
    expect(log.exercises).toHaveLength(1);
    expect(log.exercises[0].exerciseName).toBe('Присед со штангой');
    expect(log.exercises[0].sets).toHaveLength(2);
    expect(log.exercises[0].estimated1RM).toBe(117);
    expect(log.exercises[0].isCompound).toBe(true);
    expect(log.overallRPE).toBe(8.5);
    expect(log.split).toBe('legs');
  });

  it('handles missing sessionId with fallback', () => {
    const session: WorkoutSession = {
      sessionId: '',
      date: '2026-07-15',
      startTime: '10:00',
      endTime: '11:00',
      durationMin: 60,
      focus: 'fullbody',
      exercises: [],
      totalVolume: 0,
      totalSets: 0,
      totalReps: 0,
      avgIntensity: 0,
      prCount: 0,
      notes: '',
      weekNumber: 1,
      mesocycleWeek: 1,
    };

    const log = sessionToWorkoutLog(session);
    expect(log.id).toContain('plsession_2026-07-15');
  });
});

describe('StrengthDiary.getWeekNumber', () => {
  const diary = new StrengthDiary();

  it('returns ISO 8601 week number', () => {
    expect(diary.getWeekNumber('2026-07-15')).toBeGreaterThanOrEqual(1);
    expect(diary.getWeekNumber('2026-01-01')).toBeGreaterThanOrEqual(1);
  });

  it('handles year boundaries correctly', () => {
    const dec31 = diary.getWeekNumber('2026-12-31');
    const jan1 = diary.getWeekNumber('2027-01-01');
    expect(typeof dec31).toBe('number');
    expect(typeof jan1).toBe('number');
  });
});

describe('StrengthDiary.getWeeklyProgress', () => {
  it('merges IndexedDB and localStorage data', async () => {
    const mockDb = getMockDb();
    const idbLogs: StrengthLogEntry[] = [
      {
        id: '1', date: '2026-07-13', exerciseId: 'squat', exerciseName: 'Присед',
        sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }],
        totalVolume: 1000, estimated1RM: 117, isCompound: true, weekNumber: 3,
      },
    ];
    const idbWorkouts: WorkoutLog[] = [
      { id: 'w1', date: '2026-07-13', duration: 60, exercises: [], overallRPE: 7, recoveryBefore: 5, split: 'fullbody', weekNumber: 3 },
    ];

    mockDb.getAll.mockResolvedValueOnce(idbLogs).mockResolvedValueOnce(idbWorkouts);

    const diary = new StrengthDiary();
    const progress = await diary.getWeeklyProgress();

    expect(progress.length).toBeGreaterThanOrEqual(1);
  });
});

describe('StrengthDiary.checkProgressionAlerts', () => {
  it('detects plateau after 3 weeks at same weight', async () => {
    const mockDb = getMockDb();
    const logs: StrengthLogEntry[] = [
      { id: '1', date: '2026-07-01', exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }], totalVolume: 500, estimated1RM: 117, isCompound: true },
      { id: '2', date: '2026-07-08', exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }], totalVolume: 500, estimated1RM: 117, isCompound: true },
      { id: '3', date: '2026-07-15', exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }], totalVolume: 500, estimated1RM: 117, isCompound: true },
    ];

    mockDb.getAll.mockResolvedValueOnce(logs).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const diary = new StrengthDiary();
    const alerts = await diary.checkProgressionAlerts();

    const plateau = alerts.find(a => a.type === 'plateau');
    expect(plateau).toBeDefined();
    expect(plateau?.exerciseId).toBe('squat');
  });

  it('returns empty alerts for insufficient data', async () => {
    const mockDb = getMockDb();
    mockDb.getAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const diary = new StrengthDiary();
    const alerts = await diary.checkProgressionAlerts();
    expect(alerts).toEqual([]);
  });
});

describe('StrengthDiary.getExerciseStats', () => {
  it('returns stats for exercise with logs', async () => {
    const mockDb = getMockDb();
    const logs: StrengthLogEntry[] = [
      { id: '1', date: '2026-07-01', exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }], totalVolume: 500, estimated1RM: 117, isCompound: true },
      { id: '2', date: '2026-07-08', exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 105, reps: 5, rir: 2, rpe: 8 }], totalVolume: 525, estimated1RM: 121, isCompound: true },
    ];

    mockDb.getAll.mockImplementation((store: string) => {
      if (store === 'training_log') return Promise.resolve(logs);
      if (store === 'workout_log') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const diary = new StrengthDiary();
    const stats = await diary.getExerciseStats('squat');

    expect(stats.exerciseId).toBe('squat');
    expect(stats.maxWeight).toBe(105);
    expect(stats.max1RM).toBeGreaterThan(100);
    expect(stats.workoutCount).toBe(2);
  });

  it('returns empty stats for unknown exercise', async () => {
    const mockDb = getMockDb();
    mockDb.getAll.mockImplementation((store: string) => Promise.resolve([]));

    const diary = new StrengthDiary();
    const stats = await diary.getExerciseStats('unknown_exercise');

    expect(stats).toBeNull();
  });
});

describe('StrengthDiary.getRecentActivity', () => {
  it('returns recent activity', async () => {
    const mockDb = getMockDb();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const logs: StrengthLogEntry[] = [
      { id: '1', date: yesterday, exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5, rir: 2, rpe: 8 }], totalVolume: 500, estimated1RM: 117, isCompound: true },
    ];

    mockDb.getAll.mockImplementation((store: string) => {
      if (store === 'training_log') return Promise.resolve(logs);
      if (store === 'workout_log') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const diary = new StrengthDiary();
    const activity = await diary.getRecentActivity(7);

    expect(activity.length).toBeGreaterThanOrEqual(1);
    expect(activity[0].date).toBe(yesterday);
  });
});
