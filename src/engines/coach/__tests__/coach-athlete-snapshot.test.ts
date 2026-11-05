/**
 * coach-athlete-snapshot.test.ts — сводка по атлету из ЕГО данных.
 *
 * Проверяем честность цифр, а не наличие полей:
 *  • окна 7/28 дней считаются по календарю, будущее не считается фактом;
 *  • одна тренировка не превращается в две из-за двух упражнений;
 *  • нет данных → «нет данных», а не нули и не «0 дней»;
 *  • пустой план (`{}`/`[]`) — это «плана нет», а не «есть»;
 *  • старая форма `workout_log` читается, только если `training_log` пуст.
 */
import { describe, expect, it } from 'vitest';
import {
  buildAthleteSnapshot,
  formatKg,
  readSessions,
  readWeights,
  snapshotLine,
} from '../coach-athlete-snapshot.engine';

const TODAY = '2026-11-05';

function makeInput(stores: Record<string, unknown[]> = {}, local: Record<string, string> = {}) {
  return {
    spaceId: 'asp_a1',
    stores,
    readKey: (k: string) => local[k] ?? null,
    today: TODAY,
  };
}

const log = (date: string, weight: number, reps: number) => ({
  id: `${date}-${Math.random()}`,
  date,
  exerciseId: 'squat',
  exerciseName: 'Присед',
  sets: [{ weight, reps, rir: 2 }],
});

describe('тренировки', () => {
  it('окна 7/28 дней и «сколько дней назад» считаются по календарю', () => {
    const stores = {
      training_log: [
        log('2026-11-05', 100, 5), // сегодня
        log('2026-10-30', 100, 5), // 6 дней назад → в 7-дневном окне
        log('2026-10-29', 100, 5), // 7 дней назад → только в 28
        log('2026-10-09', 100, 5), // 27 дней назад → в 28
        log('2026-10-08', 100, 5), // 28 дней назад → вне окон
      ],
    };
    const s = buildAthleteSnapshot(makeInput(stores));
    expect(s.lastTrainingDate).toBe('2026-11-05');
    expect(s.daysSinceTraining).toBe(0);
    expect(s.sessions7).toBe(2);
    expect(s.sessions28).toBe(4);
    expect(s.tonnage7).toBe(1000);
    expect(s.tonnage28).toBe(2000);
    // Даты для недельного выполнения: по возрастанию, день — один раз.
    expect(s.sessionDates).toEqual(['2026-10-08', '2026-10-09', '2026-10-29', '2026-10-30', '2026-11-05']);
  });

  it('два упражнения в один день — одна тренировка, тоннаж суммарный', () => {
    const stores = {
      training_log: [
        log('2026-11-04', 100, 5),
        log('2026-11-04', 50, 10),
      ],
    };
    const s = buildAthleteSnapshot(makeInput(stores));
    expect(s.sessions7).toBe(1);
    expect(s.tonnage7).toBe(1000);
  });

  it('totalVolume используется, если есть; иначе считается по подходам', () => {
    const stores = {
      training_log: [
        { date: '2026-11-04', totalVolume: 4321, sets: [{ weight: 1, reps: 1 }] },
        { date: '2026-11-03', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 7 }] },
        // мусорный подход не ломает подсчёт
        { date: '2026-11-02', sets: [{ weight: 'abc', reps: 5 }, { weight: -10, reps: 5 }] },
      ],
    };
    const s = buildAthleteSnapshot(makeInput(stores));
    expect(s.tonnage7).toBe(4321 + 80 * 8 + 80 * 7);
  });

  it('будущая дата не считается тренировкой «сегодня»', () => {
    const stores = { training_log: [log('2026-12-01', 100, 5)] };
    const s = buildAthleteSnapshot(makeInput(stores));
    expect(s.sessions7).toBe(0);
    // сама дата видна, но «дней назад» не отрицательное
    expect(s.daysSinceTraining).toBe(0);
  });

  it('workout_log читается только когда training_log пуст (без двойного счёта)', () => {
    const session = {
      date: '2026-11-04',
      exercises: [{ sets: [{ weight: 100, reps: 5 }] }, { totalVolume: 500 }],
    };
    const onlyOld = buildAthleteSnapshot(makeInput({ workout_log: [session] }));
    expect(onlyOld.sessions7).toBe(1);
    expect(onlyOld.tonnage7).toBe(1000);

    const both = buildAthleteSnapshot(makeInput({ training_log: [log('2026-11-04', 60, 10)], workout_log: [session] }));
    expect(both.sessions7).toBe(1);
    expect(both.tonnage7).toBe(600);
  });

  it('readSessions терпим к мусору', () => {
    expect(readSessions({ training_log: [null, 'x', { date: 'мусор' }, { date: '2026-11-01' }] })).toHaveLength(1);
  });
});

describe('вес и чек-ин', () => {
  it('последнее взвешивание и тренд к предыдущему', () => {
    const local = {
      he_weight_log: JSON.stringify([
        { date: '2026-11-05', weight: 82.5 },
        { date: '2026-10-29', weight: 83.2 },
        { date: 'мусор', weight: 1 },
      ]),
    };
    const s = buildAthleteSnapshot(makeInput({}, local));
    expect(s.lastWeight).toEqual({ date: '2026-11-05', kg: 82.5 });
    expect(s.weightTrendKg).toBe(-0.7);
    expect(s.hasAnyData).toBe(true);
    // данные есть, но плана и тренировок нет — обе причины внимания честные
    expect(s.attention).toContain('нет сохранённой программы');
    expect(s.attention).toContain('нет тренировок в дневнике');
  });

  it('одно взвешивание — тренда нет (не выдумываем ноль)', () => {
    const s = buildAthleteSnapshot(makeInput({}, { he_weight_log: JSON.stringify([{ date: '2026-11-05', weight: 80 }]) }));
    expect(s.lastWeight).toEqual({ date: '2026-11-05', kg: 80 });
    expect(s.weightTrendKg).toBeNull();
  });

  it('битый JSON веса не роняет сводку', () => {
    expect(readWeights(() => '{oops')).toEqual([]);
    expect(readWeights(() => '"строка"')).toEqual([]);
    expect(readWeights(() => null)).toEqual([]);
  });

  it('чек-ин берётся из he_checkin_latest', () => {
    const s = buildAthleteSnapshot(makeInput({}, { he_checkin_latest: JSON.stringify({ date: '2026-11-03', sleepHours: 7 }) }));
    expect(s.lastCheckin).toBe('2026-11-03');
    expect(s.hasAnyData).toBe(true);
  });
});

describe('план и пустое пространство', () => {
  it('заполненный макрос — план есть', () => {
    const s = buildAthleteSnapshot(makeInput({}, { he_pl_macro: JSON.stringify({ v: 7, b: ['присед'], t: 12 }) }));
    expect(s.hasPlan).toBe(true);
    expect(s.planKeys).toEqual(['he_pl_macro']);
    expect(s.needsAttention).toBe(true); // тренировок всё равно нет
    expect(s.attention).not.toContain('нет сохранённой программы');
  });

  it('пустые {} и [] — плана нет', () => {
    const s = buildAthleteSnapshot(makeInput({}, {
      he_pl_macro: '{}',
      he_macrocycle_designs: '[]',
      he_user_programs: 'null',
      he_bb_macro: 'не json',
    }));
    expect(s.hasPlan).toBe(false);
    expect(s.planKeys).toEqual([]);
  });

  it('пустое пространство: «нет данных», а не нули', () => {
    const s = buildAthleteSnapshot(makeInput());
    expect(s.hasAnyData).toBe(false);
    expect(s.daysSinceTraining).toBeNull();
    expect(s.lastWeight).toBeNull();
    expect(snapshotLine(s)).toBe('нет данных в приложении');
    expect(snapshotLine(undefined)).toBe('');
  });

  it('строка карточки читается человеком и не врёт про «0 дней»', () => {
    const s = buildAthleteSnapshot(makeInput(
      { training_log: [log('2026-11-05', 100, 10), log('2026-10-30', 100, 10)] },
      { he_weight_log: JSON.stringify([{ date: '2026-11-04', weight: 82.5 }]), he_bb_macro: '{"a":1}' },
    ));
    const line = snapshotLine(s);
    expect(line).toContain('тренировка сегодня');
    expect(line).toContain('2 за 7 дн. / 2 за 28 дн.');
    expect(line).toContain('вес 82,5 кг');
    expect(line).toContain('план есть');
  });

  it('formatKg переводит большие объёмы в тонны', () => {
    expect(formatKg(935)).toBe('935 кг');
    expect(formatKg(12_400)).toBe('12,4 т');
    expect(formatKg(0)).toBe('0');
  });
});
