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
 * 3. Пакетная правка недели («⚡ Пакетно»): пустое поле читалось как 0 («× умножить»
 *    обнулял вес и сеты всей недели), а в правку дописывались выдуманные `reps: 10` и
 *    `weight: 80` — правка «Сеты» переписывала повторы и ставила 80 кг упражнениям без
 *    веса. Теперь `computeBulkWeekEdits` меняет только выбранное поле по фактическим
 *    значениям упражнения.
 */
import { describe, expect, it } from 'vitest';
import { clampInlineNumber, computeBulkWeekEdits, parseInlineNumber, weekPhaseOf } from '../bb-auto-constructor-shared';

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

describe('аудит UI: пакетная правка недели', () => {
  const week = () => ({
    week: 2,
    sessions: [
      {
        exercises: [
          { name: 'Жим лёжа', sets: 4, repsRange: [8, 8], workSets: [{ weight: 82.5, reps: 8 }, { weight: 82.5, reps: 8 }] },
          { name: 'Отжимания на брусьях', sets: 3, repsRange: [10, 12], workSets: [{ weight: 0, reps: 10 }] },
          { name: 'Подтягивания', sets: 3, repsRange: [8, 10], workSets: [] },
        ],
      },
      { exercises: [{ name: 'Тяга штанги', sets: 4, repsRange: [8, 8], workSets: [{ weight: 60, reps: 8 }] }] },
    ],
  });

  it('правка «Сеты» меняет только сеты: повторы и вес остаются фактическими', () => {
    const res = computeBulkWeekEdits({ sessions: week().sessions, weekNo: 2, field: 'sets', mode: 'set', rawValue: '5' });
    expect('edits' in res).toBe(true);
    const edits: any = (res as any).edits;
    expect(Object.keys(edits).sort()).toEqual(['2-0-0', '2-0-1', '2-0-2', '2-1-0']);
    for (const key of Object.keys(edits)) expect(edits[key].sets).toBe(5);
    // Раньше здесь дописывались `reps: 10` и `weight: 80` — неделя «обнулялась».
    expect(edits['2-0-0']).toMatchObject({ reps: 8, weight: 82.5 });
    expect(edits['2-0-1']).toMatchObject({ reps: 10, weight: 0 });
    // Упражнение вообще без рабочих сетов: повторы из диапазона плана, вес 0.
    expect(edits['2-0-2']).toMatchObject({ reps: 8, weight: 0 });
    expect(edits['2-1-0']).toMatchObject({ reps: 8, weight: 60 });
  });

  it('упражнение без веса не получает выдуманные 80 кг', () => {
    const res = computeBulkWeekEdits({ sessions: week().sessions, weekNo: 2, field: 'reps', mode: 'set', rawValue: '12' });
    const edits: any = (res as any).edits;
    expect(edits['2-0-1']).toMatchObject({ reps: 12, weight: 0, sets: 3 });
    // Нет рабочих сетов вовсе — тоже 0, а не «средние 80 кг».
    expect(edits['2-0-2']).toMatchObject({ reps: 12, weight: 0, sets: 3 });
  });

  it('пустое/нечисловое значение — ошибка, а не нули во всей неделе', () => {
    expect(computeBulkWeekEdits({ sessions: week().sessions, weekNo: 2, field: 'sets', mode: 'mult', rawValue: '' }))
      .toEqual({ error: 'укажите число' });
    expect(computeBulkWeekEdits({ sessions: week().sessions, weekNo: 2, field: 'weight', mode: 'set', rawValue: 'abc' }))
      .toEqual({ error: 'укажите число' });
  });

  it('нулевой множитель и нулевые сеты/повторы отклоняются, вес 0 допустим (своё тело)', () => {
    expect(computeBulkWeekEdits({ sessions: week().sessions, weekNo: 2, field: 'weight', mode: 'mult', rawValue: '0' }))
      .toEqual({ error: 'множитель должен быть больше нуля' });
    expect(computeBulkWeekEdits({ sessions: week().sessions, weekNo: 2, field: 'sets', mode: 'set', rawValue: '0' }))
      .toEqual({ error: 'значение должно быть не меньше 1' });
    expect('edits' in computeBulkWeekEdits({ sessions: week().sessions, weekNo: 2, field: 'weight', mode: 'set', rawValue: '0' })).toBe(true);
  });

  it('умножение сохраняет дробный вес и нулевой у упражнений без веса', () => {
    const res = computeBulkWeekEdits({ sessions: week().sessions, weekNo: 2, field: 'weight', mode: 'mult', rawValue: '1.5' });
    const edits: any = (res as any).edits;
    expect(edits['2-0-0'].weight).toBe(123.8);
    expect(edits['2-0-1'].weight).toBe(0);
    expect(edits['2-1-0'].weight).toBe(90);
  });

  it('существующая правка не теряет свои поля (техника остаётся)', () => {
    const res = computeBulkWeekEdits({
      sessions: week().sessions, weekNo: 2, field: 'weight', mode: 'set', rawValue: '70',
      existing: { '2-0-0': { sets: 3, reps: 6, weight: 82.5, technique: 'dropset', exerciseKey: 'Жим лёжа' } },
    });
    const edits: any = (res as any).edits;
    expect(edits['2-0-0']).toMatchObject({ sets: 3, reps: 6, weight: 70, technique: 'dropset', exerciseKey: 'Жим лёжа' });
    // Неделя в ключе — из недели правки, а не из позиции сессии.
    expect(Object.keys(edits)).toContain('2-1-0');
  });
});
