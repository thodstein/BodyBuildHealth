/**
 * workout-logger-quota-ladder.test.ts — лестница среза при QuotaExceededError.
 *
 * `saveSessions` при первой ошибке квоты пробует всё более короткие срезы:
 * потолок MAX_STORED_SESSIONS → 500 → 100 → 50 (самые новые по дате). Здесь
 * проверяется, что лестница реально доходит до конца, что отказ на последней
 * ступени возвращает false без частичной записи, и что успех на 500 не
 * помечается как более глубокий срез.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStorageTrimWarning,
  MAX_STORED_SESSIONS,
  saveSessions,
  type WorkoutSession,
} from '../workout-logger.engine';

const LOG_KEY = 'he_workout_log_v2';

const quotaError = () => {
  const err: any = new Error('Quota exceeded');
  err.name = 'QuotaExceededError';
  return err;
};

/** Сессия-заполнитель с уникальной возрастающей датой: `i`-й день от 2020-01-01. */
function seedSession(i: number): WorkoutSession {
  const d = new Date(2020, 0, 1 + i);
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

/**
 * Мок записи журнала: `setItem` для LOG_KEY бросает QuotaExceededError, если в
 * массиве больше `maxLength` сессий. Остальные ключи (в т.ч. markTrimmed) проходят.
 */
function quotaAbove(maxLength: number) {
  const realSetItem = localStorage.setItem.bind(localStorage);
  vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
    if (key === LOG_KEY) {
      let length = 0;
      try {
        const parsed = JSON.parse(value);
        length = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        length = 0;
      }
      if (length > maxLength) throw quotaError();
    }
    realSetItem(key, value);
  });
}

/** Запись в обход мока: getItem не подменяется, читаем реальное состояние. */
function storedLog(): WorkoutSession[] {
  return JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as WorkoutSession[];
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('saveSessions — лестница quota-фолбэка', () => {
  it('лестница доходит до 50: запись проходит только когда в массиве ≤50 сессий', () => {
    // 600 < MAX_STORED_SESSIONS, поэтому ступень «потолок» ничего не срезает:
    // лестница обязана дойти до последнего шага, иначе запись не ляжет вовсе.
    expect(MAX_STORED_SESSIONS).toBeGreaterThan(600);
    const sessions = Array.from({ length: 600 }, (_, i) => seedSession(i));
    quotaAbove(50);

    expect(saveSessions(sessions)).toBe(true);

    const stored = storedLog();
    expect(stored).toHaveLength(50);
    // Остались ровно 50 самых новых по дате (даты строго возрастают с i).
    expect(stored.map((s) => s.sessionId)).toEqual(Array.from({ length: 50 }, (_, k) => `seed_${550 + k}`));
    expect(getStorageTrimWarning()?.kept).toBe(50);
  });

  it('если не проходит и 50 — возвращается false, прежний журнал не тронут', () => {
    // Прежнее состояние: три сессии, которые обязаны пережить неудачную запись.
    const prior = [seedSession(0), seedSession(1), seedSession(2)];
    localStorage.setItem(LOG_KEY, JSON.stringify(prior));

    const sessions = Array.from({ length: 600 }, (_, i) => seedSession(i));
    quotaAbove(10);

    expect(saveSessions(sessions)).toBe(false);

    // Ни одна ступень (включая 50) не легла — частичной записи нет.
    expect(storedLog().map((s) => s.sessionId)).toEqual(['seed_0', 'seed_1', 'seed_2']);
    // Срез не состоялся: предупреждения о срезе быть не должно.
    expect(getStorageTrimWarning()).toBeNull();
  });

  it('успех на 500 не помечает срез как 100/50', () => {
    const sessions = Array.from({ length: 600 }, (_, i) => seedSession(i));
    // 600 не проходит (полная запись и ступень потолка), 500 — проходит.
    quotaAbove(500);

    expect(saveSessions(sessions)).toBe(true);

    const stored = storedLog();
    expect(stored).toHaveLength(500);
    // Остались 500 самых новых: i = 100…599.
    expect(stored[0].sessionId).toBe('seed_100');
    expect(stored[stored.length - 1].sessionId).toBe('seed_599');
    expect(getStorageTrimWarning()?.kept).toBe(500);
  });
});
