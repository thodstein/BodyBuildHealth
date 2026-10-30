/**
 * planner-train-type.test.ts — B22 (аудит 2026-10).
 *
 * Находка: `trainType` не сохранялся в профиль, а при загрузке выводился из
 * `daysPerWeek`. Пользователь выбирал «силовые», сохранял профиль, открывал
 * экран снова — и получал «mixed» (3 тренировки в неделю). Тип тренинга влияет
 * на PAL и рекомендации, поэтому ошибка попадала в цифры.
 */
import { describe, it, expect } from 'vitest';
import { resolveTrainType, isTrainType } from '../planner-train-type';

describe('B22: тип тренинга сохраняется, а не выводится из числа дней', () => {
  it('сохранённый «strength» не превращается в «mixed» при 3 днях', () => {
    // ГЛАВНЫЙ КЕЙС: старая логика давала 'mixed' для daysPerWeek = 3.
    expect(resolveTrainType('strength', 3)).toBe('strength');
  });

  it('сохранённый «cardio» не превращается в «strength» при 5 днях', () => {
    expect(resolveTrainType('cardio', 5)).toBe('cardio');
  });

  it('сохранённый «hiit» сохраняется при любом числе дней', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      expect(resolveTrainType('hiit', n)).toBe('hiit');
    }
  });

  it('старый профиль без trainType — работает прежняя эвристика (совместимость)', () => {
    expect(resolveTrainType(undefined, 6)).toBe('strength');
    expect(resolveTrainType(undefined, 3)).toBe('mixed');
    expect(resolveTrainType(undefined, 2)).toBe('cardio');
    expect(resolveTrainType(undefined, 0)).toBe('mixed');
    expect(resolveTrainType(undefined, undefined)).toBe('mixed');
  });

  it('мусор в сохранённом поле игнорируется и не ломает загрузку', () => {
    expect(resolveTrainType('бодибилдинг', 3)).toBe('mixed');
    expect(resolveTrainType(null, 5)).toBe('strength');
    expect(resolveTrainType(42, 2)).toBe('cardio');
    expect(resolveTrainType({}, 4)).toBe('mixed');
  });

  it('isTrainType пропускает только известные значения', () => {
    expect(isTrainType('strength')).toBe(true);
    expect(isTrainType('hiit')).toBe(true);
    expect(isTrainType('STRENGTH')).toBe(false);
    expect(isTrainType('')).toBe(false);
    expect(isTrainType(undefined)).toBe(false);
  });

  it('round-trip сохранения: значение, прошедшее isTrainType, читается обратно без изменений', () => {
    for (const tt of ['strength', 'cardio', 'mixed', 'hiit'] as const) {
      if (isTrainType(tt)) expect(resolveTrainType(tt, 3)).toBe(tt);
    }
  });
});
