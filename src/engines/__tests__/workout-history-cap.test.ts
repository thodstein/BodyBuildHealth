/**
 * workout-history-cap.test.ts — потолок истории тренировок применяется на ЗАПИСИ,
 * а не молча на чтении: свежая/архивируемая сессия не теряется, а фактический срез
 * виден UI через getStorageTrimWarning().
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addExerciseToSession,
  archiveActiveSession,
  clearStorageTrimWarning,
  finishSession,
  getStorageTrimWarning,
  loadActiveSession,
  loadSessions,
  localIsoDate,
  logSet,
  MAX_STORED_SESSIONS,
  saveActiveSession,
  saveSessions,
  startSession,
  type WorkoutSession,
} from '../workout-logger.engine';

/** Сессия-заполнитель: дата 2020 года, заведомо старше «сегодня». */
function seedSession(i: number): WorkoutSession {
  const d = new Date(2020, 0, 1 + (i % 360));
  return {
    sessionId: `seed_${i}`,
    date: localIsoDate(d),
    startTime: '10:00',
    endTime: '11:00',
    durationMin: 60,
    focus: 'Seed',
    exercises: [],
    totalVolume: 0,
    totalSets: 0,
    totalReps: 0,
    avgIntensity: 0,
    prCount: 0,
    notes: '',
    mesocycleWeek: 1,
  };
}

/** Полноценная сессия с одним подходом — годится и для живой, и для завершённой. */
function mkSession(): WorkoutSession {
  const s = startSession('Test');
  const withEx = addExerciseToSession(s, { id: 'bench_bar', name: 'Bench', pattern: 'push', muscleGroup: 'chest' });
  return logSet(withEx, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8, rir: 2 }).session;
}

const fullHistory = () => Array.from({ length: MAX_STORED_SESSIONS }, (_, i) => seedSession(i));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('потолок истории тренировок', () => {
  it('архивируемая живая сессия не теряется при полном журнале, срез виден UI', () => {
    expect(saveSessions(fullHistory())).toBe(true);
    // Ровно потолок — отбрасывать нечего, предупреждения ещё нет.
    expect(getStorageTrimWarning()).toBeNull();

    const active = mkSession();
    expect(saveActiveSession(active)).toBe(true);
    expect(loadActiveSession()).not.toBeNull();

    const archived = archiveActiveSession();
    expect(archived).not.toBeNull();

    const sessions = loadSessions();
    // Свежая по дате сессия остаётся в журнале, а не отрезается вместе со старыми.
    expect(sessions.some((s) => s.sessionId === archived!.sessionId)).toBe(true);
    expect(sessions.length).toBeLessThanOrEqual(MAX_STORED_SESSIONS);
    expect(getStorageTrimWarning()?.kept).toBe(MAX_STORED_SESSIONS);
  });

  it('сессия, только что записанная в полный журнал, читается обратно', () => {
    expect(saveSessions(fullHistory())).toBe(true);

    const fresh = finishSession(mkSession(), 'свежая', 60);
    const sessions = loadSessions();

    expect(sessions.some((s) => s.sessionId === fresh.sessionId)).toBe(true);
    expect(sessions.length).toBe(MAX_STORED_SESSIONS);
  });

  it('закрытое предупреждение о срезе не возвращается после следующей тренировки', () => {
    saveSessions(fullHistory());
    finishSession(mkSession(), 'первая', 60);
    expect(getStorageTrimWarning()?.kept).toBe(MAX_STORED_SESSIONS);

    // Пользователь закрыл баннер (DiaryHistoryView → clearStorageTrimWarning).
    clearStorageTrimWarning();
    expect(getStorageTrimWarning()).toBeNull();

    // Следующая запись снова режет историю до того же потолка — но закрытое
    // уведомление не воскресает (раньше markTrimmed звался на каждой записи).
    finishSession(mkSession(), 'вторая', 60);
    expect(getStorageTrimWarning()).toBeNull();
  });
});
