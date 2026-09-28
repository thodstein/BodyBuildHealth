import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-11.ts — Выносливость (жим, МС-МСМК). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_11: SRCycleTemplate = {
  meta: {
    id: 'cycle-11',
    title: 'Выносливость (жим, МС-МСМК)',
    direction: 'bench',
    level: 'MS-MSMK',
    period: 'endurance',
    minBodyWeight: 80,
    sessionsPerWeek: 4,
    weeks: 12,
    correctionPct: 0.005,
    sourceWeeks: true,
    tags: ['lms'],
    description: 'Выносливость (жим, МС-МСМК).',
    howItWorks: 'Инструкция №11. СРЦ для жимовика (МС-МСМК). Выносливость. 18.11.2019 0 Циклы для жимовиков Жим лежа Статья включает описание и требования саморасчитывающегося цикла для жимовиков высшей спортивной квалификации, рассчитанного на совершенствование силовой выносливости. Для атлетов высокого уровня работа на силовую выносливость не может являться основным методом подготовки и, как правило, применяется довольно редко. Главной целью таких периодов является внесение вариативности в тренировочный процесс и повышение мышечной массы целевых мышечных групп. По этой причине важное требование цикла – уверенный профицит калорий и достаточное потребление белка на ряду с хорошим общим режимом. В рамках цикл',
    conditions: ['Условия соответствия цикла: Уровень спортсмена высокий (МС-МСМК).', 'Предполагается, что пользователь цикла высокого уровня, не раз участвовал на соревнованиях.', 'Величины нагрузки таковы, что атлету без специальной подготовки, будет невозможно нормально восстановиться.', 'Весоростовое соотношение должно быть оптимальным или с малыми отклонениями.', 'Что касается процента корректировки, то он изначально выставлен в низкое значение – 0,5%.', 'В случае, если первые 3-4 недели нагрузок хорошо переносятся спортсменом, то можно повысить его до 0,6-0,8% или даже более.', 'Нужно помнить, что процент корректировки – это та величина, на которую увеличиваются максимумы, от которых идет расчет на следующей неделе.'],
  },
  week1: [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.52,reps:10,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.61,reps:8,sets:3}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.52,reps:10,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.61,reps:8,sets:3}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:1},{pct:0.45,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.62,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.52,reps:10,sets:1},{pct:0.6,reps:8,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.36,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.47,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.4,reps:10,sets:1},{pct:0.52,reps:8,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.65,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.5,reps:10,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:10,sets:1},{pct:0.7,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:1},{pct:0.6,reps:12,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.62,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:8,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:8,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.58,reps:8,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:10,sets:1},{pct:0.7,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:10,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:10,sets:1},{pct:0.6,reps:8,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.57,reps:8,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.53,reps:10,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.52,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:10,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.68,reps:8,sets:3}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.57,reps:10,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.62,reps:10,sets:1},{pct:0.7,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.39,reps:10,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:10,sets:1},{pct:0.48,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:10,sets:1},{pct:0.55,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.53,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.53,reps:10,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:10,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:12,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:12,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.46,reps:12,sets:2},{pct:0.53,reps:15,sets:1},{pct:0.56,reps:20,sets:1}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.58,reps:12,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.47,reps:12,sets:5}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.4,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.5,reps:12,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:12,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.56,reps:10,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.48,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.43,reps:12,sets:1},{pct:0.51,reps:12,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.35,reps:12,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4},{pct:0.45,reps:15,sets:1}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:12,sets:5}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.62,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.62,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.44,reps:12,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:10,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:5}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.67,reps:8,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:1},{pct:0.66,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.46,reps:12,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.65,reps:10,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.65,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.61,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:10,sets:1},{pct:0.6,reps:8,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.38,reps:12,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.63,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:10,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.62,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:12,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:1},{pct:0.67,reps:8,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.7,reps:8,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.64,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:10,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:8,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:10,sets:1},{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:10,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:1},{pct:0.66,reps:8,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.64,reps:12,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.64,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:8,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.47,reps:12,sets:1},{pct:0.53,reps:10,sets:1},{pct:0.59,reps:8,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:8,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:1},{pct:0.62,reps:8,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:8,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.37,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.5,reps:10,sets:3},{pct:0.53,reps:8,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.53,reps:10,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3},{pct:0.55,reps:15,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.55,reps:10,sets:1},{pct:0.64,reps:10,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.65,reps:8,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:12,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.48,reps:10,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.4,reps:12,sets:1},{pct:0.5,reps:10,sets:1},{pct:0.62,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.47,reps:12,sets:3},{pct:0.52,reps:10,sets:3},{pct:0.57,reps:8,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.47,reps:10,sets:1},{pct:0.55,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.37,reps:12,sets:3},{pct:0.41,reps:10,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.53,reps:10,sets:3},{pct:0.6,reps:8,sets:3}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 0.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
    ] },
    ],
  ],
};
