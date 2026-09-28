import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-06.ts — Силовой цикл (жим, КМС-МС). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_06: SRCycleTemplate = {
  meta: {
    id: 'cycle-06',
    title: 'Силовой цикл (жим, КМС-МС)',
    direction: 'bench',
    level: 'KMS-MS',
    period: 'strength',
    minBodyWeight: 80,
    sessionsPerWeek: 4,
    weeks: 12,
    correctionPct: 0.005,
    sourceWeeks: true,
    tags: ['lms'],
    description: 'Силовой цикл (жим, КМС-МС).',
    howItWorks: 'Инструкция №6. СРЦ для жимовика (КМС-МС) 13.11.2019 0 Циклы для жимовиков Жим лежа В инструкции дается описание цикла для жимовиков высокого уровня подготовленности, который соответствует классификационной таблице федерации WPC – нормативам КМС, МС. Данные атлеты характеризуются высоким уровнем спортивной подготовки и для дальнейшего роста спортивных результатов непременным условием является увеличение тренировочного объема и среднего веса отягощений. Техническая подготовленность этой категории спортсменов характеризуется как высокая, однако технические тренировки, направленные на совершенствование двигательного навыка, занимают важное место в общей системе подготовки. Указанный цикл предназ',
    conditions: ['Условия соответствия цикла: Уровень атлетов достаточно высокий.', 'Данный цикл может применяться КМС, а также МС, имеющих вес тела 80 кг или более.', 'Весоростовое соотношение должно минимально отклоняться от рекомендованного для данной категории спортивного мастерства; С позиции слабых мест нет каких-либо рекомендаций.', 'Приоритет данных движений средний.', 'В Цикле №6 применяется традиционная схема организации нагрузки, с позиции интенсивности.', 'Принципы высокообъемного тренинга и тренировок на микровесах реализованы частично.', 'В дни тяжелых тренировок часто добавляются раскладки в режиме периода по выходу на пик силы.'],
  },
  week1: [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:6,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.74,reps:4,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.77,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.58,reps:5,sets:4}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:6,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.74,reps:4,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.77,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.58,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.57,reps:6,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:6,sets:1},{pct:0.55,reps:6,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:3,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:1},{pct:0.55,reps:5,sets:4}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:3},{pct:0.52,reps:5,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4},{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.58,reps:5,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:3},{pct:0.65,reps:5,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:5,sets:4}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:1},{pct:0.55,reps:5,sets:1},{pct:0.65,reps:5,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:5,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.36,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.74,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:3,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:3},{pct:0.8,reps:2,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.34,reps:6,sets:5}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:1},{pct:0.67,reps:5,sets:4}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.49,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:5}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.63,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:3,sets:1},{pct:0.7,reps:3,sets:1},{pct:0.8,reps:3,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.58,reps:6,sets:4},{pct:0.65,reps:5,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:5,sets:4}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:3,sets:5}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3},{pct:0.45,reps:5,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.58,reps:5,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:6,sets:1},{pct:0.62,reps:5,sets:4},{pct:0.7,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.55,reps:4,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:3},{pct:0.7,reps:4,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3},{pct:0.4,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4},{pct:0.49,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:3},{pct:0.4,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.62,reps:4,sets:1},{pct:0.73,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.77,reps:3,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4},{pct:0.42,reps:5,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3},{pct:0.4,reps:5,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.58,reps:6,sets:3},{pct:0.65,reps:5,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4},{pct:0.49,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.67,reps:3,sets:3},{pct:0.72,reps:2,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:5}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.71,reps:6,sets:5}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:4,sets:1},{pct:0.62,reps:3,sets:1},{pct:0.7,reps:2,sets:1},{pct:0.8,reps:2,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.67,reps:6,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:1},{pct:0.75,reps:3,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:1},{pct:0.85,reps:2,sets:2}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:1},{pct:0.8,reps:2,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:5}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.35,reps:6,sets:3},{pct:0.4,reps:5,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.6,reps:5,sets:4},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:1},{pct:0.8,reps:2,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:3,sets:5}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.4,reps:6,sets:3},{pct:0.45,reps:5,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:3},{pct:0.55,reps:5,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:4}] },
      { name: 'Жим гантелей вниз головой', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Разгибание с гантелью', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    ],
  ],
};
