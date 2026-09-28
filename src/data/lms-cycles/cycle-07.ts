import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-07.ts — Выход на пик (троеборье, МС-МСМК). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_07: SRCycleTemplate = {
  meta: {
    id: 'cycle-07',
    title: 'Выход на пик (троеборье, МС-МСМК)',
    direction: 'powerlifting',
    level: 'MS-MSMK',
    period: 'peak',
    minBodyWeight: 70,
    sessionsPerWeek: 5,
    weeks: 12,
    correctionPct: 0.005,
    sourceWeeks: true,
    tags: ['lms'],
    description: 'Выход на пик (троеборье, МС-МСМК).',
    howItWorks: 'Инструкция №7. СРЦ для атлета троеборца, уровнем МС-МСМК 14.11.2019 10 Циклы для троеборцев Становая тяга Статья включает описание саморасчитывающегося цикла, который подойдет атлетам высоко уровня: от МС до МСМК и выше, в соответствии с классификацией федерации WPC. Техника выполнения упражнений у данной группы атлетов — эталонная, однако процесс совершенствования технического мастерства всячески улучшается и дополняется с целью поддерживать высокий уровень владения техникой основных и вспомогательных упражнений. Описывающийся цикл (далее Цикл №7) рекомендуется для использования атлетами троеборцами высшего уровня спортивного мастерства, которые выступают в безэкипировочном дивизионе. Цикл ',
    conditions: ['Условия соответствия цикла: Высокий уровень атлетов.', 'Данный цикл может применяться МС, а также МСМК, имеющих вес тела 70 кг или более.', 'Необходимо не только обеспечить должный уровень восстановления, но и ввести дополнительные меры для его ускорения (модификация рациона, массаж, активный отдых и подобное).', 'В случае последнего можно повысить процент корректировки до 1-1,5 или даже выше.', 'В Цикле №7 применяется интенсивная схема организации нагрузки.', 'Принципы высокообъемного тренинга и тренировок на микровесах реализованы только в плоскости легких тренировок.', 'Основная часть нагрузки нацелена на интенсивную работу на высоком проценте.'],
  },
  week1: [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.74,reps:3,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.77,reps:1,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5},{pct:0.59,reps:4,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.76,reps:1,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:4,sets:1},{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.78,reps:1,sets:2}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
      { name: 'Опциональная тяга (см. инстр)', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:1},{pct:0.75,reps:2,sets:1},{pct:0.85,reps:1,sets:2}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.74,reps:3,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.77,reps:1,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5},{pct:0.59,reps:4,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.76,reps:1,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:4,sets:1},{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.78,reps:1,sets:2}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
      { name: 'Опциональная тяга (см. инстр)', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:1},{pct:0.75,reps:2,sets:1},{pct:0.85,reps:1,sets:2}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.56,reps:3,sets:1},{pct:0.67,reps:2,sets:2},{pct:0.78,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:3},{pct:0.55,reps:5,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:4,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.62,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:2,sets:2},{pct:0.82,reps:1,sets:2},{pct:0.87,reps:1,sets:2}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:4,sets:1},{pct:0.67,reps:3,sets:4}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3},{pct:0.4,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:3},{pct:0.6,reps:4,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:5,sets:1},{pct:0.67,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.67,reps:2,sets:1},{pct:0.76,reps:2,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:4}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:2,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:2,sets:2},{pct:0.85,reps:1,sets:2},{pct:0.9,reps:1,sets:2}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:4,sets:1},{pct:0.75,reps:3,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.64,reps:3,sets:1},{pct:0.74,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:3},{pct:0.55,reps:5,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:3},{pct:0.5,reps:5,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:3},{pct:0.55,reps:5,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:3,sets:3},{pct:0.7,reps:2,sets:3}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.57,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.87,reps:1,sets:2}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:3,sets:5}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:3},{pct:0.6,reps:4,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:3}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:3}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:2,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3},{pct:0.45,reps:5,sets:3}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:2,sets:5}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:2,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:4,sets:3},{pct:0.5,reps:3,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:4,sets:1},{pct:0.65,reps:3,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:2},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.75,reps:1,sets:2}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:3},{pct:0.8,reps:2,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:1},{pct:0.77,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:2,sets:2},{pct:0.6,reps:2,sets:1},{pct:0.7,reps:2,sets:1},{pct:0.77,reps:1,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.74,reps:3,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:3},{pct:0.72,reps:1,sets:3},{pct:0.77,reps:1,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5},{pct:0.59,reps:4,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.76,reps:1,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:4},{pct:0.35,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:4,sets:1},{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.78,reps:1,sets:2}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.67,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:1},{pct:0.75,reps:2,sets:1},{pct:0.85,reps:1,sets:2}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:4,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4},{pct:0.63,reps:3,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4},{pct:0.44,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:3,sets:1},{pct:0.68,reps:2,sets:5}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:4,sets:3},{pct:0.58,reps:3,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.62,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:5,sets:4},{pct:0.5,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:3,sets:4}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.56,reps:3,sets:1},{pct:0.67,reps:2,sets:2},{pct:0.78,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:4},{pct:0.55,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:4,sets:5}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.62,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:2,sets:2},{pct:0.82,reps:1,sets:2},{pct:0.87,reps:1,sets:2}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:4}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.53,reps:4,sets:1},{pct:0.6,reps:3,sets:1},{pct:0.68,reps:2,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.67,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2},{pct:0.82,reps:1,sets:2}] },
      { name: 'Наклоны', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:4,sets:4},{pct:0.48,reps:3,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.62,reps:3,sets:1},{pct:0.72,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:1},{pct:0.67,reps:3,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:2},{pct:0.4,reps:5,sets:2}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:4,sets:1},{pct:0.67,reps:3,sets:2},{pct:0.75,reps:2,sets:2},{pct:0.87,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.75,reps:1,sets:2}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:4,sets:1},{pct:0.62,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:3},{pct:0.8,reps:2,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:3},{pct:0.85,reps:1,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:1},{pct:0.77,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:2},{pct:0.75,reps:2,sets:3},{pct:0.78,reps:1,sets:3}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:2,sets:2},{pct:0.6,reps:2,sets:1},{pct:0.7,reps:2,sets:1},{pct:0.77,reps:1,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.72,reps:2,sets:2},{pct:0.8,reps:2,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:3,sets:1},{pct:0.67,reps:2,sets:2},{pct:0.75,reps:2,sets:2},{pct:0.81,reps:1,sets:2}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:2},{pct:0.67,reps:2,sets:2},{pct:0.75,reps:2,sets:2},{pct:0.82,reps:2,sets:2}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:3,sets:3}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.62,reps:3,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.72,reps:1,sets:2}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:4,sets:1},{pct:0.62,reps:4,sets:3},{pct:0.7,reps:1,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:3,sets:3},{pct:0.6,reps:2,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:1,sets:2}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:3},{pct:0.74,reps:2,sets:3}] },
      { name: 'Опциональная тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Присед на груди', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
      { name: 'Тяга на прямых ногах', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    ],
  ],
};
