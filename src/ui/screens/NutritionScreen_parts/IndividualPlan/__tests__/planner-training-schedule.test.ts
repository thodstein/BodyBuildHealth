/**
 * planner-training-schedule.test.ts — Тесты плавающего графика тренировок.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TRAIN_SCHEDULE,
  normalizeTrainSchedule,
  isTrainingDayFor,
  weeklyTrainingCount,
  describeSchedule,
  buildTrainSchedule,
  type TrainSchedule,
} from '../planner-training-schedule';

const weekly = (days: boolean[]): TrainSchedule => ({ ...DEFAULT_TRAIN_SCHEDULE, enabled: true, weeklyDays: [...days], scheduleType: 'weekly' });
const eod = (): TrainSchedule => ({ ...DEFAULT_TRAIN_SCHEDULE, enabled: true, scheduleType: 'eod' });
const pattern = (work: number, off: number): TrainSchedule => ({ ...DEFAULT_TRAIN_SCHEDULE, enabled: true, scheduleType: 'pattern', pattern: { work, off } });

describe('isTrainingDayFor — weekly', () => {
  it('фиксированные дни недели: Пн/Ср/Пт = тренировка, Вт/Чт = отдых', () => {
    const s = weekly([true, false, true, false, true, false, false]);
    expect([0, 1, 2, 3, 4, 5, 6].map(d => isTrainingDayFor(s, d))).toEqual([true, false, true, false, true, false, false]);
  });

  it('повторяется каждые 7 дней (offset 7 = offset 0)', () => {
    const s = weekly([false, true, false, false, false, false, false]);
    expect(isTrainingDayFor(s, 8)).toBe(true); // 8 % 7 = 1
    expect(isTrainingDayFor(s, 0)).toBe(false);
  });

  it('отрицательные offset корректны (-1 = 6-й день)', () => {
    const s = weekly([false, false, false, false, false, false, true]);
    expect(isTrainingDayFor(s, -1)).toBe(true);
  });
});

describe('isTrainingDayFor — eod (через день)', () => {
  it('чётные offset — тренировка, нечётные — отдых', () => {
    const s = eod();
    expect([0, 1, 2, 3, 4, 5].map(d => isTrainingDayFor(s, d))).toEqual([true, false, true, false, true, false]);
  });

  it('3-4 тренировки в неделе', () => {
    expect(weeklyTrainingCount(eod())).toBe(4);
  });
});

describe('isTrainingDayFor — pattern (цикл N+M)', () => {
  it('2+1: [тр, тр, отдых, тр, тр, отдых, тр]', () => {
    const s = pattern(2, 1);
    expect([0, 1, 2, 3, 4, 5, 6].map(d => isTrainingDayFor(s, d))).toEqual([true, true, false, true, true, false, true]);
  });

  it('1+1: через день (совпадает с eod по чётности)', () => {
    const s = pattern(1, 1);
    expect(isTrainingDayFor(s, 0)).toBe(true);
    expect(isTrainingDayFor(s, 1)).toBe(false);
    expect(isTrainingDayFor(s, 2)).toBe(true);
  });

  it('3+1: 3 тренировочных, 1 отдых', () => {
    const s = pattern(3, 1);
    expect([0, 1, 2, 3, 4, 5, 6].map(d => isTrainingDayFor(s, d))).toEqual([true, true, true, false, true, true, true]);
  });

  it('отрицательные offset в pattern корректны', () => {
    const s = pattern(2, 1);
    // −1 → pos 2 (отдых); −3 → pos 0 (тренировка)
    expect(isTrainingDayFor(s, -1)).toBe(false);
    expect(isTrainingDayFor(s, -3)).toBe(true);
  });
});

describe('normalizeTrainSchedule', () => {
  it('null/мусор → дефолт', () => {
    const s = normalizeTrainSchedule(null);
    expect(s).toEqual(DEFAULT_TRAIN_SCHEDULE);
    expect(normalizeTrainSchedule(undefined).scheduleType).toBe('weekly');
    expect(normalizeTrainSchedule('garbage').weeklyDays.length).toBe(7);
  });

  it('невалидный тип → weekly; невалидный pattern → дефолт 2+1', () => {
    const s = normalizeTrainSchedule({ scheduleType: 'shift', pattern: { work: 0, off: -3 } });
    expect(s.scheduleType).toBe('weekly');
    expect(s.pattern).toEqual({ work: 2, off: 1 });
  });

  it('валидные поля сохраняются; дни усекаются/дополняются до 7', () => {
    const s = normalizeTrainSchedule({ scheduleType: 'eod', weeklyDays: [true, false], pattern: { work: 3, off: 2 } });
    expect(s.scheduleType).toBe('eod');
    expect(s.weeklyDays).toEqual([true, false, false, false, false, false, false]);
    expect(s.pattern).toEqual({ work: 3, off: 2 });
  });

  it('time валидируется (формат HH:MM)', () => {
    const s = normalizeTrainSchedule({ startTime: '7:00', endTime: 'abc' });
    expect(s.startTime).toBe('7:00'); // 1-значный час валиден
    expect(s.endTime).toBe('18:00');  // 'abc' → дефолт
    expect(normalizeTrainSchedule({ startTime: '07:00' }).startTime).toBe('07:00');
    expect(normalizeTrainSchedule({ startTime: '25:99' }).startTime).toBe('16:00');
  });
});

describe('buildTrainSchedule + describeSchedule', () => {
  it('buildTrainSchedule собирает и нормализует объект', () => {
    const s = buildTrainSchedule(true, '17:30', '19:00', [true, false, true, false, false, false, false], 'pattern', { work: 2, off: 1 });
    expect(s.enabled).toBe(true);
    expect(s.startTime).toBe('17:30');
    expect(s.scheduleType).toBe('pattern');
  });

  it('describeSchedule: описания для всех режимов', () => {
    expect(describeSchedule({ ...DEFAULT_TRAIN_SCHEDULE, enabled: false })).toContain('выключена');
    expect(describeSchedule(eod())).toContain('Через день');
    expect(describeSchedule(pattern(2, 1))).toContain('2+1');
    expect(describeSchedule(weekly([true, false, false, false, false, false, false]))).toContain('1 тр');
  });

  it('weeklyTrainingCount для eod = 4, pattern 3+1 = 6', () => {
    expect(weeklyTrainingCount(eod())).toBe(4);
    expect(weeklyTrainingCount(pattern(3, 1))).toBe(6);
  });
});
