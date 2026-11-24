import { describe, expect, it } from 'vitest';

import {
  daysBetween,
  isTrainingDayFor,
  mondayIndex,
  patternCycle,
  pickPlanDayIndex,
  planDatesForIndexes,
  weeklyTrainingDays,
  type TrainingSettingsLike,
} from '../training-day.engine';

/**
 * Замок на правило «день плана ↔ дата». Раньше копий было три (агенда, виджет,
 * календарь) и они расходились: виджет не показывал дни 4–5 плана при трёх
 * тренировках в неделю, а `pattern` объявлял тренировку в день отдыха.
 *
 * 2026-11-23 — понедельник (Пн=0).
 */
const MON = '2026-11-23';

const weekly = (days: number[]): TrainingSettingsLike => ({
  schedule: {
    enabled: true,
    scheduleType: 'weekly',
    weeklyDays: Array.from({ length: 7 }, (_, i) => days.includes(i)),
  },
});

const pattern = (work: number, off: number): TrainingSettingsLike => ({
  schedule: { enabled: true, scheduleType: 'pattern', pattern: { work, off } },
});

/** Пн/Ср/Пт — график «три раза в неделю». */
const MWF = weekly([0, 2, 4]);

describe('training-day: базовые правила календаря', () => {
  it('mondayIndex считает Пн=0 по локальной дате', () => {
    expect(mondayIndex(MON)).toBe(0);
    expect(mondayIndex('2026-11-24')).toBe(1);
    expect(mondayIndex('2026-11-29')).toBe(6);
  });

  it('daysBetween не зависит от часового пояса перехода', () => {
    expect(daysBetween(MON, '2026-11-25')).toBe(2);
    expect(daysBetween('2026-11-25', MON)).toBe(-2);
    // Переход на летнее время в Европе (2026-03-29) — сутки всё равно одни.
    expect(daysBetween('2026-03-28', '2026-03-29')).toBe(1);
  });

  it('weeklyTrainingDays берёт явный график, eod и раскладку по daysPerWeek', () => {
    expect(weeklyTrainingDays(MWF)).toEqual([true, false, true, false, true, false, false]);
    expect(weeklyTrainingDays({ schedule: { enabled: true, scheduleType: 'eod' } })).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(weeklyTrainingDays({ daysPerWeek: 2 })).toEqual([true, false, false, true, false, false, false]);
    // Мусор в профиле не должен давать «каждый день тренировка».
    expect(weeklyTrainingDays({ daysPerWeek: 99 })).toEqual([true, true, true, true, true, true, true]);
    expect(weeklyTrainingDays({ daysPerWeek: 0 })).toEqual([true, false, true, false, true, false, false]);
  });

  it('patternCycle берёт work/off с границами', () => {
    expect(patternCycle(pattern(2, 1))).toEqual({ work: 2, off: 1 });
    expect(patternCycle(pattern(0, 0))).toEqual({ work: 1, off: 0 });
    expect(patternCycle({})).toEqual({ work: 2, off: 1 });
  });
});

describe('training-day: isTrainingDayFor', () => {
  it('weekly — по дню недели', () => {
    expect(isTrainingDayFor(MWF, MON)).toBe(true);
    expect(isTrainingDayFor(MWF, '2026-11-24')).toBe(false);
    expect(isTrainingDayFor(MWF, '2026-11-25')).toBe(true);
  });

  it('pattern без якоря — прежний канон агенды (фаза от 2024-01-01)', () => {
    // 2024-01-01 — понедельник, фаза «2 через 1» начинается с работы.
    expect(isTrainingDayFor(pattern(2, 1), '2024-01-01')).toBe(true);
    expect(isTrainingDayFor(pattern(2, 1), '2024-01-02')).toBe(true);
    expect(isTrainingDayFor(pattern(2, 1), '2024-01-03')).toBe(false);
  });

  it('pattern с якорем плана — фаза от старта плана', () => {
    expect(isTrainingDayFor(pattern(2, 1), MON, MON)).toBe(true);
    expect(isTrainingDayFor(pattern(2, 1), '2026-11-24', MON)).toBe(true);
    expect(isTrainingDayFor(pattern(2, 1), '2026-11-25', MON)).toBe(false);
    expect(isTrainingDayFor(pattern(2, 1), '2026-11-26', MON)).toBe(true);
  });

  it('off=0 — тренировка каждый день; отсутствие профиля — не выдумываем день', () => {
    expect(isTrainingDayFor(pattern(3, 0), '2026-11-25')).toBe(true);
    expect(isTrainingDayFor(null, MON)).toBe(false);
    expect(isTrainingDayFor(MWF, 'не дата')).toBe(false);
  });
});

describe('training-day: pickPlanDayIndex по якорю плана', () => {
  it('день плана — N-й тренировочный день от startDate', () => {
    const args = { training: MWF, planDays: 5, startDate: MON };
    expect(pickPlanDayIndex({ ...args, iso: MON })).toBe(0);
    expect(pickPlanDayIndex({ ...args, iso: '2026-11-25' })).toBe(1);
    expect(pickPlanDayIndex({ ...args, iso: '2026-11-27' })).toBe(2);
    expect(pickPlanDayIndex({ ...args, iso: '2026-11-30' })).toBe(3);
    expect(pickPlanDayIndex({ ...args, iso: '2026-12-02' })).toBe(4);
    // План кончился — начинается заново (ротация), а не «пустой день».
    expect(pickPlanDayIndex({ ...args, iso: '2026-12-04' })).toBe(0);
  });

  it('дни 4–5 плана достижимы при трёх тренировках в неделю (старый расчёт давал 0..2)', () => {
    const indexes = ['2026-11-23', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-02'].map((iso) =>
      pickPlanDayIndex({ iso, training: MWF, planDays: 5, startDate: MON }),
    );
    expect(indexes).toEqual([0, 1, 2, 3, 4]);
  });

  it('день отдыха показывает следующую тренировку', () => {
    // Вторник и четверг — отдых; в виджете должно быть «что делать дальше».
    expect(pickPlanDayIndex({ iso: '2026-11-24', training: MWF, planDays: 5, startDate: MON })).toBe(1);
    expect(pickPlanDayIndex({ iso: '2026-11-26', training: MWF, planDays: 5, startDate: MON })).toBe(2);
    // Суббота/воскресенье — следующая по кругу, понедельник.
    expect(pickPlanDayIndex({ iso: '2026-11-28', training: MWF, planDays: 5, startDate: MON })).toBe(3);
  });

  it('pattern: индекс растёт только на тренировочных днях цикла', () => {
    const args = { training: pattern(2, 1), planDays: 4, startDate: MON };
    expect(pickPlanDayIndex({ ...args, iso: MON })).toBe(0); // Пн — работа, день 1
    expect(pickPlanDayIndex({ ...args, iso: '2026-11-24' })).toBe(1); // Вт — работа, день 2
    expect(pickPlanDayIndex({ ...args, iso: '2026-11-25' })).toBe(2); // Ср — отдых → следующий
    expect(pickPlanDayIndex({ ...args, iso: '2026-11-26' })).toBe(2); // Чт — работа, день 3
    // Вс 29-го — уже первый день следующей фазы работы: 5-й тренировочный день,
    // при плане из 4 дней это снова день 1.
    expect(pickPlanDayIndex({ ...args, iso: '2026-11-29' })).toBe(0);
  });

  it('дата раньше старта плана — первый день, а не выдуманный индекс', () => {
    expect(pickPlanDayIndex({ iso: '2026-11-01', training: MWF, planDays: 5, startDate: MON })).toBe(0);
  });

  it('eod: через день', () => {
    const training: TrainingSettingsLike = { schedule: { enabled: true, scheduleType: 'eod' } };
    expect(pickPlanDayIndex({ iso: MON, training, planDays: 4, startDate: MON })).toBe(0);
    // Вторник — отдых, следующая тренировка в среду.
    expect(pickPlanDayIndex({ iso: '2026-11-24', training, planDays: 4, startDate: MON })).toBe(1);
    expect(pickPlanDayIndex({ iso: '2026-11-25', training, planDays: 4, startDate: MON })).toBe(1);
  });

  it('без startDate — прежнее поведение по дню недели', () => {
    expect(pickPlanDayIndex({ iso: '2026-11-25', training: MWF, planDays: 3 })).toBe(1);
    expect(pickPlanDayIndex({ iso: '2026-11-24', training: MWF, planDays: 3 })).toBe(1);
    // pattern без якоря и без числа сессий — ротация с нуля.
    expect(pickPlanDayIndex({ iso: MON, training: pattern(2, 1), planDays: 4 })).toBe(0);
    expect(pickPlanDayIndex({ iso: MON, training: pattern(2, 1), planDays: 4, sessionsThisWeek: 5 })).toBe(1);
  });

  it('план из нуля дней и битые даты не падают', () => {
    expect(pickPlanDayIndex({ iso: MON, training: MWF, planDays: 0, startDate: MON })).toBe(0);
    // Битая дата — как отсутствие якоря: результат тот же, что без `startDate`.
    expect(pickPlanDayIndex({ iso: MON, training: MWF, planDays: 3, startDate: '2026-13-99' })).toBe(0);
    expect(pickPlanDayIndex({ iso: MON, training: MWF, planDays: 3, startDate: '2026-02-31' })).toBe(0);
    // Мусорная дата запроса не роняет расчёт: берётся сегодняшний день.
    const idx = pickPlanDayIndex({ iso: 'мусор', training: MWF, planDays: 3, startDate: MON });
    expect(Number.isInteger(idx)).toBe(true);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(3);
  });
});

describe('training-day: planDatesForIndexes (календарь)', () => {
  it('даёт ровно те даты, что и pickPlanDayIndex', () => {
    const dates = planDatesForIndexes({ planDays: 5, startDate: MON, training: MWF });
    expect(dates).toEqual(['2026-11-23', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-02']);
    dates!.forEach((iso, index) => {
      expect(pickPlanDayIndex({ iso, training: MWF, planDays: 5, startDate: MON })).toBe(index);
    });
  });

  it('pattern: даты идут по циклу «работа/отдых»', () => {
    expect(planDatesForIndexes({ planDays: 4, startDate: MON, training: pattern(2, 1) })).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-26',
      '2026-11-27',
    ]);
  });

  it('без якоря или без профиля — null (выдуманных дат нет)', () => {
    expect(planDatesForIndexes({ planDays: 5, training: MWF })).toBeNull();
    expect(planDatesForIndexes({ planDays: 5, startDate: MON })).toBeNull();
    expect(planDatesForIndexes({ planDays: 0, startDate: MON, training: MWF })).toBeNull();
  });
});
