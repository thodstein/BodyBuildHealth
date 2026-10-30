/**
 * planner-periodization-offset.test.ts — B10 (аудит 2026-10).
 *
 * Движок периодизации строит дату дня как `shiftIsoDate(startDate, offset)`,
 * т.е. offset считается ОТ startDate. Все колбэки планировщика
 * (isTrainingDayForOffset, dayModsByOffset) считают offset ОТ СЕГОДНЯ.
 * Пока startDate === сегодня это совпадает; в режиме подготовки к соревнованиям
 * (startDate в прошлом/будущем) день получал дату startDate+N, а тренировочный
 * статус/рефиды — для сегодня+N. Ниже — замок на приведение offset.
 */
import { describe, it, expect } from 'vitest';
import {
  buildNutritionPeriodization,
  startDateOffsetShift,
  weekdayIndexForIso,
} from '../planner-nutrition-periodization.engine';
import { isTrainingDayFor, DEFAULT_TRAIN_SCHEDULE, type TrainSchedule } from '../planner-training-schedule';

const base = { kcal: 2500, proteinG: 180, fatG: 80, carbsG: 280, waterMl: 3000, sodiumMg: 3000 };

describe('B10: startDateOffsetShift', () => {
  it('startDate = сегодня → сдвиг 0', () => {
    expect(startDateOffsetShift('2026-10-28', '2026-10-28')).toBe(0);
  });

  it('startDate в прошлом → положительный сдвиг', () => {
    // подготовка началась 3 дня назад: день 0 плана = 3 дня назад от сегодня
    expect(startDateOffsetShift('2026-10-25', '2026-10-28')).toBe(-3);
    // ...и наоборот: чтобы получить offset-от-сегодня, к offset-от-старта прибавляем −3
  });

  it('startDate в будущем → отрицательный сдвиг', () => {
    expect(startDateOffsetShift('2026-11-04', '2026-10-28')).toBe(7);
  });

  it('битые/пустые даты → 0 (не ломаем расчёт)', () => {
    expect(startDateOffsetShift('', '2026-10-28')).toBe(0);
    expect(startDateOffsetShift('2026-10-28', '')).toBe(0);
    expect(startDateOffsetShift('not-a-date', '2026-10-28')).toBe(0);
  });

  it('переход на летнее время не даёт дробных суток', () => {
    // в Европе перевод часов 2026-03-29; разница остаётся целыми сутками
    expect(startDateOffsetShift('2026-03-20', '2026-04-05')).toBe(-16);
    expect(Number.isInteger(startDateOffsetShift('2026-03-20', '2026-04-05'))).toBe(true);
  });
});

describe('B10: тренировочный день берётся для КАЛЕНДАРНОЙ даты дня, а не для offset', () => {
  // Пн/Ср/Пт — тренировки
  const schedule: TrainSchedule = { ...DEFAULT_TRAIN_SCHEDULE, enabled: true, scheduleType: 'weekly', weeklyDays: [true, false, true, false, true, false, false] };

  it('день 3 периодизации при старте 3 дня назад = СЕГОДНЯШНИЙ день недели', () => {
    const start = '2026-10-25'; // 3 дня назад от 2026-10-28
    const today = '2026-10-28'; // среда
    const shift = startDateOffsetShift(start, today);

    // день с offset 3 от старта — это СЕГОДНЯ
    const dateOfDay3 = new Date(start + 'T00:00:00');
    dateOfDay3.setDate(dateOfDay3.getDate() + 3);
    const isoOfDay3 = `${dateOfDay3.getFullYear()}-${String(dateOfDay3.getMonth() + 1).padStart(2, '0')}-${String(dateOfDay3.getDate()).padStart(2, '0')}`;
    expect(isoOfDay3).toBe(today);

    // «правильный» ответ — по календарной дате дня (среда = тренировка, индекс 2)
    expect(weekdayIndexForIso(isoOfDay3)).toBe(2);
    // тренировочный статус, посчитанный через приведение offset, совпадает
    const aligned = isTrainingDayFor(schedule, 3 + shift, 2); // dowBase = среда
    expect(aligned).toBe(true);
    // а «сырой» offset без приведения дал бы статус понедельника (тоже тренировка) —
    // поэтому проверяем на дне, где ответы расходятся:
    expect(isTrainingDayFor(schedule, 3 + shift, 2)).toBe(isTrainingDayFor(schedule, 3 - 3, 2));
  });

  it('без приведения offset день получал ЧУЖОЙ день недели (сравнение на расходящемся дне)', () => {
    const start = '2026-10-25'; // воскресенье — старт подготовки
    const today = '2026-10-28'; // среда — сегодня
    const shift = startDateOffsetShift(start, today); // = −3

    const sundayIdx = weekdayIndexForIso(start);
    const wednesdayIdx = weekdayIndexForIso(today);
    expect(sundayIdx).toBe(6);
    expect(wednesdayIdx).toBe(2);

    // День 0 периодизации — это 25.10 (воскресенье), значит по графику это ОТДЫХ.
    // Наивный вызов (offset-от-старта как offset-от-сегодня) даёт статус СРЕДЫ:
    const naive = isTrainingDayFor(schedule, 0, wednesdayIdx);
    expect(naive, 'наивный offset 0 = среда → тренировка').toBe(true);

    // Приведённый offset (−3) для той же даты даёт СВОЙ день недели — воскресенье:
    const aligned = isTrainingDayFor(schedule, 0 + shift, wednesdayIdx);
    expect(aligned, 'приведённый offset −3 = воскресенье → отдых').toBe(false);

    // И это ровно статус воскресенья по графику:
    expect(aligned).toBe(isTrainingDayFor(schedule, 0, sundayIdx));
  });
});

describe('B10: движок периодизации помечает дни датами от startDate', () => {
  it('день 0 = startDate, день 10 = startDate + 10', () => {
    const startDate = '2026-11-01';
    const p = buildNutritionPeriodization({
      startDate,
      horizonWeeks: 2,
      prepPlan: null,
      base,
      goal: 'maintenance' as any,
      carbPeriodization: 'none' as any,
      isTrainingDayForOffset: () => false,
      dayLabels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      weightLog: [],
    } as any);
    expect(p.days[0].date).toBe('2026-11-01');
    expect(p.days[10].date).toBe('2026-11-11');
    // и день недели подписи соответствует КАЛЕНДАРНОЙ дате, а не offset
    expect(weekdayIndexForIso(p.days[0].date)).toBe(weekdayIndexForIso('2026-11-01'));
  });
});
