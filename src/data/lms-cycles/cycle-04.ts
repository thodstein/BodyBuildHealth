import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-04.ts — Силовой цикл (армрестлинг, верх). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_04: SRCycleTemplate = {
  meta: {
    id: 'cycle-04',
    title: 'Силовой цикл (армрестлинг, верх)',
    direction: 'armwrestling',
    level: 'II-KMS',
    period: 'strength',
    minBodyWeight: 80,
    sessionsPerWeek: 8,
    weeks: 12,
    correctionPct: 0.005,
    sourceWeeks: true,
    description: 'Силовой цикл (армрестлинг, верх).',
    howItWorks: 'Инструкция №4. СРЦ для армрестлера-верховика (II — КМС) 12.11.2019 2 Прочие циклы Армспорт Данный СРЦ публикуется в неизменном варианте из старой базы с целью сохранения целостности и последовательности порядковых номеров! Статья включает в себя инструкцию по использованию саморасчитывающегося цикла для армрестлера с уровнем спортивного мастерства II разряд – КМС. В рамках данного уровня спортивного мастерства атлеты уже имеют представления о стилях борьбы, а также об эффективном использовании непосредственно верха. Также спортсмены имеют в достаточной степени развитые специальные физические качества: выносливость, быстроту и силу. Использование данного цикла возможно и целесообразно только ',
    conditions: [],
  },
  week1: [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.68,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:2}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:4}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.68,reps:5,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.48,reps:4,sets:4}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:3}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.47,reps:6,sets:3}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:6,sets:1},{pct:0.65,reps:6,sets:3}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:4,sets:4}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.44,reps:6,sets:3}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:3}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.68,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:2}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:4}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.68,reps:5,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.48,reps:4,sets:4}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:3}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.47,reps:6,sets:3}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:6,sets:1},{pct:0.65,reps:6,sets:3}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:4,sets:4}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.44,reps:6,sets:3}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.62,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:6,sets:4}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.6,reps:6,sets:3}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:6,sets:4}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:3}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.39,reps:6,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.58,reps:6,sets:1},{pct:0.7,reps:5,sets:5}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.33,reps:5,sets:4}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.52,reps:6,sets:1},{pct:0.59,reps:5,sets:1},{pct:0.69,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:6,sets:5}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.54,reps:6,sets:3}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.64,reps:5,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.52,reps:4,sets:1},{pct:0.58,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:4}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.33,reps:6,sets:5}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.53,reps:6,sets:1},{pct:0.66,reps:6,sets:4}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.42,reps:5,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.63,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.54,reps:6,sets:1},{pct:0.64,reps:5,sets:1},{pct:0.74,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.36,reps:6,sets:4}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:4,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:4}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.59,reps:5,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.36,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:4,sets:5}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.72,reps:4,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.45,reps:4,sets:5}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.56,reps:5,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.69,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.51,reps:6,sets:4}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.61,reps:5,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:5}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.62,reps:4,sets:1},{pct:0.77,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.53,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.72,reps:5,sets:5}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.34,reps:5,sets:5}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.51,reps:6,sets:3}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.72,reps:5,sets:2}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.6,reps:6,sets:1},{pct:0.69,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:3}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.53,reps:4,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:3}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.64,reps:5,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.42,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.39,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:3}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.52,reps:4,sets:5}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.77,reps:4,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.53,reps:4,sets:5}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.51,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.54,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.72,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:3}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:6,sets:1},{pct:0.75,reps:5,sets:1},{pct:0.8,reps:4,sets:1}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.51,reps:5,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.56,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.77,reps:4,sets:4}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:4,sets:3}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.47,reps:5,sets:3}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.64,reps:5,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.59,reps:6,sets:1},{pct:0.68,reps:5,sets:1},{pct:0.74,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:4,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:5}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Легкая', sets: [{pct:0.54,reps:6,sets:5}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.6,reps:4,sets:5}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.7,reps:4,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.58,reps:4,sets:5}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.58,reps:5,sets:1},{pct:0.76,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:5,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:5}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.59,reps:6,sets:1},{pct:0.72,reps:5,sets:1},{pct:0.81,reps:4,sets:4}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:4,sets:4}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.58,reps:6,sets:1},{pct:0.68,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.39,reps:6,sets:5}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.44,reps:6,sets:5}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Легкая', sets: [{pct:0.58,reps:6,sets:5}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.71,reps:4,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.51,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:5}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.68,reps:5,sets:5}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.31,reps:6,sets:5}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.53,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.53,reps:6,sets:1},{pct:0.63,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:5,sets:5}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Лекгкая', sets: [{pct:0.55,reps:4,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:5}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.38,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.52,reps:6,sets:4}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.55,reps:4,sets:5}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.77,reps:4,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекая', sets: [{pct:0.55,reps:4,sets:5}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.63,reps:5,sets:1},{pct:0.71,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.59,reps:5,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:1},{pct:0.8,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.73,reps:5,sets:4}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.36,reps:5,sets:5}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.38,reps:6,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.56,reps:6,sets:1},{pct:0.63,reps:5,sets:1},{pct:0.7,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.32,reps:5,sets:4}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:5,sets:1},{pct:0.68,reps:4,sets:4}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:2}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.46,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:4}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.52,reps:4,sets:1},{pct:0.64,reps:4,sets:4}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.72,reps:5,sets:5}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:5,sets:1},{pct:0.66,reps:4,sets:4}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.56,reps:6,sets:1},{pct:0.63,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:3}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.53,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.67,reps:5,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:3}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.58,reps:6,sets:1},{pct:0.69,reps:5,sets:1},{pct:0.77,reps:4,sets:4}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:4,sets:4}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.62,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.57,reps:6,sets:1},{pct:0.69,reps:5,sets:1},{pct:0.8,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:5}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:4}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:4}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:1},{pct:0.67,reps:4,sets:3}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:6,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.67,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.6,reps:6,sets:1},{pct:0.68,reps:5,sets:1},{pct:0.76,reps:4,sets:4}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.62,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:5,sets:4}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:5}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.34,reps:6,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.56,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.64,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:6,sets:5}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:5}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:5}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.38,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:4}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:5}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.64,reps:5,sets:2},{pct:0.68,reps:4,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:5}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:2},{pct:0.6,reps:5,sets:2},{pct:0.7,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.32,reps:6,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.51,reps:6,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:4}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.51,reps:6,sets:1},{pct:0.63,reps:5,sets:1},{pct:0.71,reps:5,sets:5}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.38,reps:6,sets:5}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.57,reps:6,sets:1},{pct:0.64,reps:5,sets:1},{pct:0.71,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Бицепс', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.52,reps:5,sets:5}] },
      { name: 'Трицепс на блоке', group: '', coef: 0.3, mnosz: 7, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:3}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:4}] },
      { name: 'Приведение к плечу', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:6,sets:4}] },
      { name: 'Подтягивание ', group: '', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.72,reps:4,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Кисть РР ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.6,reps:6,sets:1},{pct:0.74,reps:5,sets:2},{pct:0.8,reps:4,sets:2}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
      { name: 'Боковой нажим', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:5,sets:1},{pct:0.67,reps:5,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.39,reps:5,sets:5}] },
      { name: 'Отведение СБ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:3}] },
      { name: 'Пронация СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.46,reps:5,sets:5}] },
      { name: 'Тяга верхнего блока', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.47,reps:5,sets:5}] },
      { name: 'Кисть РР', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:5}] },
    ] },
    ],
  ],
};
