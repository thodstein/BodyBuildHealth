/**
 * Аудит UI, проход 13 — две «мелочи», которые портили данные и вводили в заблуждение.
 *
 * 1. Карточка «Фаза (факт)» всегда показывала «Разгрузка»: в компоненте стояло
 *    `(week.phase || week.deload) ? 'deload' : 'accumulation'`. `||` связывает крепче
 *    `?:`, поэтому любая неделя с заполненным `phase` (то есть всегда) давала deload.
 *    Фаза теперь считается общим хелпером `weekPhaseOf`.
 * 2. Inline-правка в шагах «План»/«Коррекция»: `parseInt(...) || 0` писал 0 сетов при
 *    очистке поля, а вес «82.5 кг» обрезался до 82. Теперь пустой/нечисловой ввод
 *    оставляет прежнее значение (`clampInlineNumber`), дробный вес сохраняется.
 */
import { describe, expect, it } from 'vitest';
import { clampInlineNumber, parseInlineNumber, weekPhaseOf } from '../bb-auto-constructor-shared';

describe('аудит UI: «Фаза (факт)» читает реальную фазу недели', () => {
  it('accumulation/intensification больше не превращаются в «Разгрузку»', () => {
    expect(weekPhaseOf({ phase: 'accumulation' })).toBe('accumulation');
    expect(weekPhaseOf({ phase: 'intensification' })).toBe('intensification');
  });

  it('делод и пик распознаются по фазе, флагу и синониму', () => {
    expect(weekPhaseOf({ phase: 'deload' })).toBe('deload');
    expect(weekPhaseOf({ phase: 'accumulation', deload: true })).toBe('deload');
    expect(weekPhaseOf({ phase: 'peaking' })).toBe('peaking');
    expect(weekPhaseOf({ phase: 'peak' })).toBe('peaking');
  });

  it('неизвестная/пустая фаза — accumulation, а не делод', () => {
    expect(weekPhaseOf({ phase: 'weird' })).toBe('accumulation');
    expect(weekPhaseOf({})).toBe('accumulation');
    expect(weekPhaseOf(null)).toBe('accumulation');
  });
});

describe('аудит UI: inline-правка чисел не обнуляет и не обрезает', () => {
  it('пустой и нечисловой ввод — не число (вызывающий оставляет прежнее значение)', () => {
    expect(parseInlineNumber('')).toBeNull();
    expect(parseInlineNumber('   ')).toBeNull();
    expect(parseInlineNumber('abc')).toBeNull();
    expect(parseInlineNumber(undefined)).toBeNull();
  });

  it('очистка поля «Сеты» не пишет 0', () => {
    expect(clampInlineNumber('', 0, 20, 3)).toBe(3);
    expect(clampInlineNumber('abc', 0, 20, 3)).toBe(3);
    // Явный ноль пользователь по-прежнему может ввести.
    expect(clampInlineNumber('0', 0, 20, 3)).toBe(0);
  });

  it('дробный вес сохраняется (не parseInt)', () => {
    expect(clampInlineNumber('82.5', 0, 500, 100)).toBe(82.5);
    expect(clampInlineNumber('82,5', 0, 500, 100)).toBe(82.5);
    expect(parseInlineNumber('1.')).toBe(1);
  });

  it('значения клампятся в допустимый диапазон', () => {
    expect(clampInlineNumber('99', 0, 20, 3)).toBe(20);
    expect(clampInlineNumber('-5', 0, 20, 3)).toBe(0);
    expect(clampInlineNumber('12', 1, 10, 5)).toBe(10);
  });
});
