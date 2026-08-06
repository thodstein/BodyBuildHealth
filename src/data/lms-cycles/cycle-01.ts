import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-01.ts — Силовой цикл 1 (троеборье). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_01: SRCycleTemplate = {
  meta: {
    id: 'cycle-01',
    title: 'Силовой цикл 1 (троеборье)',
    direction: 'powerlifting',
    level: 'II-KMS',
    period: 'strength',
    minBodyWeight: 80,
    sessionsPerWeek: 3,
    weeks: 12,
    correctionPct: 0.005,
    sourceWeeks: true,
    description: 'Силовой цикл 1 (троеборье).',
    howItWorks: 'Инструкция №1. СРЦ для троеборца (II — КМС) Саморасчитывающийся цикл №1 (далее «Цикл №1») уже зарекомендовал себя довольно эффективным для первичного становления спортивного мастерства. Многие троеборцы начального уровня, и даже девушки, продуктивно поработали и улучшили свои показатели, используя Цикл №1. Игнорируя некоторые положения инструкции, атлеты, тем не менее, получали хорошие результаты. Здесь представлена модифицированная версия данного СРЦ с внесением правок и рекомендаций на основе длительного опыта его использования.',
    conditions: ['Условия соответствия цикла: Цикл №1 представляет из себя 12-недельный силовой период, рассчитанный для применения атлетом троеборцем, который тренируется и выступает без экипировки.', 'Нагрузка реализована в рамках фиксированных трех тренировок в неделю.', 'Рекомендованный уровень спортивного мастерства — средний и соответствует уровню II взрослого разряда, I взрослого разряда или КМС.', 'Такое дифференцирование взято за основу по следующим причинам: Цикл №1 рассчитан на атлетов, уже обладающих достаточным уровнем технического мастерства.', 'Кроме того, в комплексе применяется ряд упражнений (присед в широкой постановке, присед на груди, наклоны), которые требуют от атлета достаточной гибкости и координации.', 'Опыт показывает, что такие упражнения будут затруднительны для выполнения новичкам; Рассматриваемый цикл предъявляет средние требования к спортсменам с позиций тренированности.', 'Так, величины тренировочного объема, а также усредненная интенсивность предполагает, что атлет уже может с достаточной скоростью восстанавливаться от нагрузки, способен производить работу, необходимую по объему и интенсивности.'],
  },
  week1: [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:2}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:3}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:6,sets:2},{pct:0.75,reps:6,sets:2}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.7,reps:6,sets:3}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:2}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:3}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:6,sets:2},{pct:0.75,reps:6,sets:2}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.7,reps:6,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.62,reps:6,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:6,sets:4}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:2}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:2},{pct:0.65,reps:5,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:3}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.39,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:6,sets:1},{pct:0.7,reps:5,sets:5}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.34,reps:5,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.28,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:6,sets:1},{pct:0.63,reps:5,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.33,reps:6,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:6,sets:5}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.54,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:4,sets:1},{pct:0.58,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:4}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.33,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.53,reps:6,sets:1},{pct:0.66,reps:6,sets:2},{pct:0.72,reps:5,sets:2}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.31,reps:6,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.77,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.36,reps:6,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.39,reps:4,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:4}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.59,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:5,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.69,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:4}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.61,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.39,reps:6,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.53,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.77,reps:4,sets:4}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.34,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.42,reps:5,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:6,sets:1},{pct:0.69,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:3}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.44,reps:4,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:4}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.64,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.72,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.64,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.56,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.64,reps:5,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.59,reps:6,sets:1},{pct:0.68,reps:5,sets:1},{pct:0.78,reps:4,sets:2},{pct:0.82,reps:3,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.54,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.64,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.59,reps:5,sets:5}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.59,reps:6,sets:1},{pct:0.72,reps:5,sets:1},{pct:0.78,reps:4,sets:4}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.58,reps:6,sets:1},{pct:0.68,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.39,reps:6,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:5}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:5,sets:1},{pct:0.65,reps:4,sets:3},{pct:0.72,reps:3,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:6,sets:1},{pct:0.61,reps:5,sets:1},{pct:0.71,reps:5,sets:5}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.31,reps:6,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:6,sets:1},{pct:0.63,reps:6,sets:2},{pct:0.71,reps:5,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.63,reps:5,sets:1},{pct:0.75,reps:4,sets:2},{pct:0.8,reps:2,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.59,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.58,reps:6,sets:1},{pct:0.71,reps:6,sets:1},{pct:0.77,reps:5,sets:4}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.58,reps:6,sets:1},{pct:0.67,reps:5,sets:2},{pct:0.77,reps:5,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.64,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:3}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:2}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:6,sets:1},{pct:0.63,reps:5,sets:1},{pct:0.69,reps:4,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:3}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.67,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.58,reps:6,sets:1},{pct:0.69,reps:6,sets:5}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.62,reps:6,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:6,sets:1},{pct:0.69,reps:5,sets:1},{pct:0.8,reps:4,sets:2},{pct:0.84,reps:3,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.67,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:4}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.62,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.67,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:5}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.59,reps:6,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:6,sets:1},{pct:0.73,reps:5,sets:3},{pct:0.77,reps:4,sets:3}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.34,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.7,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:6,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:5}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:6,sets:3},{pct:0.64,reps:5,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.32,reps:6,sets:5}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.51,reps:6,sets:1},{pct:0.63,reps:6,sets:3},{pct:0.68,reps:5,sets:3}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.38,reps:6,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.59,reps:6,sets:1},{pct:0.64,reps:5,sets:2},{pct:0.69,reps:4,sets:6}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.52,reps:5,sets:5}] },
      { name: 'Разгибание с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.62,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:1},{pct:0.64,reps:5,sets:2},{pct:0.68,reps:4,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:5}] },
      { name: 'Наклоны', group: 'ТГ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.67,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.39,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:5,sets:2},{pct:0.76,reps:4,sets:2},{pct:0.8,reps:3,sets:2}] },
      { name: 'Присед в широкой постановке', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:5}] },
    ] },
    ],
  ],
};
