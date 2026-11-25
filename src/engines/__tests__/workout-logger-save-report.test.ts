/**
 * workout-logger-save-report.test.ts — честный отчёт о записи тренировки.
 *
 * Плеер и виджет-фолбэк удаляют живую сессию после завершения. Если запись в журнал
 * не легла (квота/приватный режим), удалять её нельзя: это единственная копия.
 * Здесь проверяются три шва:
 *  - finishSessionWithSave() сообщает saved: false, и живая сессия остаётся;
 *  - quota-фолбэк saveSessions() не пишет больше MAX_STORED_SESSIONS;
 *  - logSet() держит RIR в шкале 0…10 (RPE = 10 − RIR).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addExerciseToSession,
  archiveActiveSession,
  finishSessionWithSave,
  getStorageTrimWarning,
  loadActiveSession,
  loadSessions,
  logSet,
  MAX_STORED_SESSIONS,
  saveActiveSession,
  saveSessions,
  startSession,
  type WorkoutSession,
} from '../workout-logger.engine';

const LOG_KEY = 'he_workout_log_v2';

/** Сессия с реальным подходом: её можно и завершить, и положить в живые. */
function logged(): WorkoutSession {
  const withEx = addExerciseToSession(startSession('Upper', 1), {
    id: 'bench',
    name: 'Жим лёжа',
    pattern: 'horizontal_push',
    muscleGroup: 'chest',
  });
  return logSet(withEx, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8, rir: 2 }).session;
}

/** Сессия-заполнитель с уникальной датой: `i`-й день от 2020-01-01. */
function seedSession(i: number): WorkoutSession {
  const d = new Date(2020, 0, 1 + (i % 360));
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    sessionId: `seed_${i}`,
    date: iso,
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

const quotaError = () => {
  const err: any = new Error('Quota exceeded');
  err.name = 'QuotaExceededError';
  return err;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('finishSessionWithSave — отчёт о записи', () => {
  it('успешная запись сообщает saved: true и кладёт сессию в журнал', () => {
    const session = logged();
    const { session: finished, saved } = finishSessionWithSave(session, 'note', 42);

    expect(saved).toBe(true);
    expect(finished.durationMin).toBe(42);
    expect(loadSessions().some((s) => s.sessionId === finished.sessionId)).toBe(true);
  });

  it('сессия вылетела из среза истории — это тоже saved: false', () => {
    // Журнал уже забит записями с датой в будущем (сбитые часы, импорт): завершённая
    // сегодня сессия не попадает в срез MAX_STORED_SESSIONS, хотя запись «легла».
    // Без проверки членства вызывающий стёр бы живую сессию — и копии не осталось бы.
    const future = Array.from({ length: MAX_STORED_SESSIONS }, (_, i) => ({ ...seedSession(i), date: '2099-01-02' }));
    expect(saveSessions(future)).toBe(true);

    const { session: finished, saved } = finishSessionWithSave(logged(), 'note', 30);

    expect(saved).toBe(false);
    expect(loadSessions().some((s) => s.sessionId === finished.sessionId)).toBe(false);
    expect(loadSessions()).toHaveLength(MAX_STORED_SESSIONS);
  });

  it('провал записи (квота) сообщает saved: false, живая сессия не теряется', () => {
    const active = logged();
    expect(saveActiveSession(active)).toBe(true);

    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === LOG_KEY) throw quotaError();
      realSetItem(key, value);
    });

    const { saved } = finishSessionWithSave(active, 'note', 30);
    expect(saved).toBe(false);
    expect(loadSessions()).toHaveLength(0);
    // Архив не «успешен»: живая сессия остаётся единственной копией подходов.
    expect(archiveActiveSession()).toBeNull();
    expect(loadActiveSession()?.sessionId).toBe(active.sessionId);
  });
});

describe('saveSessions — quota-фолбэк держит потолок', () => {
  it('при первой ошибке квоты пишет не больше MAX_STORED_SESSIONS и помечает срез', () => {
    const sessions = Array.from({ length: MAX_STORED_SESSIONS + 3 }, (_, i) => seedSession(i));

    // Первая (полная) запись падает по квоте, фолбэк-запись должна пройти.
    let throwsLeft = 1;
    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === LOG_KEY && throwsLeft > 0) {
        throwsLeft -= 1;
        throw quotaError();
      }
      realSetItem(key, value);
    });

    expect(saveSessions(sessions)).toBe(true);

    const stored = JSON.parse(realStorageGet(LOG_KEY) || '[]') as WorkoutSession[];
    expect(stored.length).toBe(MAX_STORED_SESSIONS);
    expect(getStorageTrimWarning()?.kept).toBe(MAX_STORED_SESSIONS);
  });
});

/** Чтение в обход возможного мока setItem: getItem не подменяется. */
function realStorageGet(key: string): string | null {
  return localStorage.getItem(key);
}

describe('logSet — RIR в шкале 0…10', () => {
  it('RIR 20 клампится до 10, отрицательный — до 0', () => {
    const withEx = addExerciseToSession(startSession('Upper', 1), {
      id: 'bench',
      name: 'Жим лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
    });

    const high = logSet(withEx, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 0, rir: 20 }).session;
    expect(high.exercises[0].sets[0].rir).toBe(10);

    const low = logSet(withEx, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8, rir: -5 }).session;
    expect(low.exercises[0].sets[0].rir).toBe(0);
  });
});
