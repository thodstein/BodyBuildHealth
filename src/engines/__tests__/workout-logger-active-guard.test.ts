/**
 * workout-logger-active-guard.test.ts — контракт живой сессии и «нет данных» по RIR.
 *
 * Закрывает три запаркованных дефекта:
 *  1. явный старт тренировки (тап «Начать» с виджета) не переживал запись: сессия без
 *     подходов отбрасывалась и на чтении, поэтому тап оставался без последствий;
 *  2. `clearActiveSession()` стирал ключ целиком, даже если там уже лежал черновик
 *     ДРУГОЙ сессии (вторая вкладка/виджет);
 *  3. завершение пустой сессии писалось в журнал как тренировка (0 подходов).
 *
 * Отдельно: `rirMissing` — «оценку не вводили», чтобы 0 («до отказа») не подменялся
 * выдуманным отсутствием и наоборот.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addExerciseToSession,
  archiveActiveSession,
  clearActiveSession,
  finishSessionWithSave,
  isActiveSessionWorthSaving,
  loadActiveSession,
  loadSessions,
  logSet,
  saveActiveSession,
  startSession,
  type WorkoutSession,
} from '../workout-logger.engine';

const ACTIVE_KEY = 'he_workout_active_v1';

function withExercise(focus = 'Upper'): WorkoutSession {
  return addExerciseToSession(startSession(focus, 1), {
    id: 'bench',
    name: 'Жим лёжа',
    pattern: 'horizontal_push',
    muscleGroup: 'chest',
  });
}

/** Сессия с одним реальным подходом. */
function logged(): WorkoutSession {
  return logSet(withExercise(), 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8, rir: 2, notes: '' }).session;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('явный старт: живая сессия без подходов', () => {
  it('автосейв пустую сессию не пишет, явный старт — пишет и метит', () => {
    const session = withExercise();

    expect(saveActiveSession(session)).toBe(false);
    expect(localStorage.getItem(ACTIVE_KEY)).toBeNull();

    expect(saveActiveSession(session, 12, { allowEmpty: true })).toBe(true);
    const active = loadActiveSession();
    expect(active?.sessionId).toBe(session.sessionId);
    expect(active?.startedWithoutSets).toBe(true);
    expect(active?.plannedSetsTotal).toBe(12);
  });

  it('пустая сессия без метки по-прежнему не читается (мусор из старых версий)', () => {
    localStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify({ ...withExercise(), exercises: [{ exerciseName: 'Жим', sets: [] }] }),
    );
    expect(loadActiveSession()).toBeNull();
  });

  it('с первым подходом метка снимается: дальше это обычная живая сессия', () => {
    const started = withExercise();
    expect(saveActiveSession(started, 12, { allowEmpty: true })).toBe(true);

    const active = loadActiveSession()!;
    const res = logSet(active, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 8, rir: 2, notes: '' });
    expect(res.success).toBe(true);
    expect(saveActiveSession(res.session, 12, { plannedTotalMax: true })).toBe(true);

    const stored = JSON.parse(localStorage.getItem(ACTIVE_KEY) || '{}');
    expect(stored.startedWithoutSets).toBeUndefined();
    expect(loadActiveSession()?.exercises[0].sets).toHaveLength(1);
  });
});

describe('clearActiveSession — только своя запись', () => {
  it('чужой черновик не стирается', () => {
    expect(saveActiveSession(logged(), 12)).toBe(true);
    const stored = loadActiveSession()!;

    // Между чтением и очисткой в ключ лёг черновик другой сессии.
    clearActiveSession('sess_другая');
    expect(loadActiveSession()?.sessionId).toBe(stored.sessionId);

    clearActiveSession(stored.sessionId);
    expect(loadActiveSession()).toBeNull();
  });

  it('без id чистит ключ как раньше', () => {
    expect(saveActiveSession(logged(), 12)).toBe(true);
    clearActiveSession();
    expect(localStorage.getItem(ACTIVE_KEY)).toBeNull();
  });

  it('битый JSON считается мусором и удаляется', () => {
    localStorage.setItem(ACTIVE_KEY, '{oops');
    clearActiveSession('sess_любая');
    expect(localStorage.getItem(ACTIVE_KEY)).toBeNull();
  });
});

describe('finishSessionWithSave — пустую тренировку в журнал не пишет', () => {
  it('пустая сессия: empty, saved false, журнал не тронут', () => {
    const { saved, empty, session: finished } = finishSessionWithSave(withExercise(), 'note', 30);

    expect(empty).toBe(true);
    expect(saved).toBe(false);
    expect(loadSessions()).toHaveLength(0);
    expect(finished.durationMin).toBe(30);
  });

  it('сессия без подходов в живом ключе (явный старт) не архивируется как тренировка', () => {
    expect(saveActiveSession(withExercise(), 8, { allowEmpty: true })).toBe(true);
    expect(archiveActiveSession()).toBeNull();
    expect(loadSessions()).toHaveLength(0);
    // Живую копию архивирование пустой сессии не снимает: её снимает вызывающий по id.
    expect(loadActiveSession()).not.toBeNull();
  });

  it('служебная метка не протекает в историю', () => {
    // Метка + подход одновременно — состояние гонки (старт и подход в одной вкладке).
    const payload = { ...logged(), startedWithoutSets: true, savedAt: Date.now(), plannedSetsTotal: 12 };
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(payload));

    const archived = archiveActiveSession();
    expect(archived).not.toBeNull();
    const stored = loadSessions()[0] as any;
    expect(stored.startedWithoutSets).toBeUndefined();
    expect(stored.savedAt).toBeUndefined();
    expect(stored.plannedSetsTotal).toBeUndefined();
    expect(stored.totalSets).toBe(1);
  });
});

describe('WorkoutSet.rirMissing — «оценку не вводили»', () => {
  it('rirMissing кладёт 0 и метку, ноль без метки остаётся «до отказа»', () => {
    const base = withExercise();
    const missing = logSet(base, 0, {
      setNumber: 1,
      weightKg: 80,
      reps: 8,
      rpe: 0,
      rir: 0,
      notes: '',
      rirMissing: true,
    }).session;
    expect(missing.exercises[0].sets[0].rir).toBe(0);
    expect(missing.exercises[0].sets[0].rirMissing).toBe(true);

    const given = logSet(base, 0, { setNumber: 1, weightKg: 80, reps: 8, rpe: 10, rir: 0, notes: '' }).session;
    expect(given.exercises[0].sets[0].rir).toBe(0);
    expect(given.exercises[0].sets[0].rirMissing).toBeUndefined();
  });

  it('rirMissing не пропускает выдуманный RIR', () => {
    const base = withExercise();
    const res = logSet(base, 0, {
      setNumber: 1,
      weightKg: 80,
      reps: 8,
      rpe: 0,
      rir: 4,
      notes: '',
      rirMissing: true,
    }).session;
    expect(res.exercises[0].sets[0].rir).toBe(0);
    expect(res.exercises[0].sets[0].rirMissing).toBe(true);
  });

  it('isActiveSessionWorthSaving не считает метку подходом', () => {
    const started = { ...withExercise(), startedWithoutSets: true };
    expect(isActiveSessionWorthSaving(started)).toBe(false);
    expect(isActiveSessionWorthSaving({ ...started, exercises: logged().exercises })).toBe(true);
  });
});
