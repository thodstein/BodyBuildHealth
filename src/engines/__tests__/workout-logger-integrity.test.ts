/**
 * workout-logger-integrity.test.ts — целостность истории тренировок.
 *
 * Проверяем три инварианта, на которых держится статистика:
 *  - завершение одной сессии не пишется в историю дважды (виджет + плеер);
 *  - длительность сессии уважает таймер плеера и не превращается в «10 часов»,
 *    если тренировку начали вчера, а завершили утром;
 *  - первый подход в истории не является PR «по определению».
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { addExerciseToSession, finishSession, loadSessions, logSet, startSession } from '../workout-logger.engine';

const fresh = () =>
  addExerciseToSession(startSession('Upper', 1), {
    id: 'bench',
    name: 'Жим лёжа',
    pattern: 'horizontal_push',
    muscleGroup: 'chest',
  });

const setOf = (setNumber: number, weightKg: number, reps: number) => ({
  setNumber,
  weightKg,
  reps,
  rpe: 8,
  rir: 2,
  notes: '',
});

beforeEach(() => {
  localStorage.clear();
});

describe('finishSession — идемпотентность и длительность', () => {
  it('повторное завершение той же сессии не дублирует историю', () => {
    const logged = logSet(fresh(), 0, setOf(1, 80, 8)).session;
    const finished = finishSession(logged, 'note');
    finishSession(finished, 'note');
    finishSession(logged, 'note');
    expect(loadSessions()).toHaveLength(1);
    expect(loadSessions()[0].sessionId).toBe(finished.sessionId);
  });

  it('явная длительность из таймера плеера перекрывает «стенные» часы', () => {
    const finished = finishSession(fresh(), '', 42);
    expect(finished.durationMin).toBe(42);
  });

  it('немыслимая длительность клампится до 6 часов', () => {
    const now = new Date();
    const endMin = now.getHours() * 60 + now.getMinutes();
    // start на минуту позже end ⇒ «стенная» разница почти сутки.
    const startMin = (endMin + 1) % 1440;
    const hh = String(Math.floor(startMin / 60)).padStart(2, '0');
    const mm = String(startMin % 60).padStart(2, '0');
    const finished = finishSession({ ...fresh(), startTime: `${hh}:${mm}` }, '');
    expect(finished.durationMin).toBeLessThanOrEqual(360);
  });
});

describe('isPR — только против реального базиса', () => {
  it('первый подход не PR, более тяжёлый подход в той же сессии — PR', () => {
    const first = logSet(fresh(), 0, setOf(1, 80, 8));
    expect(first.session.exercises[0].sets[0].isPR).toBe(false);

    const second = logSet(first.session, 0, setOf(2, 85, 8));
    expect(second.session.exercises[0].sets[1].isPR).toBe(true);
    expect(second.session.prCount).toBe(1);
  });

  it('реальный прошлый вес даёт PR, даже если это первый подход сессии', () => {
    const res = logSet(fresh(), 0, setOf(1, 90, 1), 85);
    expect(res.session.exercises[0].sets[0].isPR).toBe(true);
  });
});
