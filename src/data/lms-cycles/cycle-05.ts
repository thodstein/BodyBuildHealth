import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-05.ts — Силовой цикл (жим, II-КМС). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_05: SRCycleTemplate = {
  meta: {
    id: 'cycle-05',
    title: 'Силовой цикл (жим, II-КМС)',
    direction: 'bench',
    level: 'II-KMS',
    period: 'strength',
    minBodyWeight: 80,
    sessionsPerWeek: 4,
    weeks: 12,
    correctionPct: 0.005,
    sourceWeeks: true,
    description: 'Силовой цикл (жим, II-КМС).',
    howItWorks: 'Инструкция №5. СРЦ для жимовика (II-КМС). Жим стоя в приоритете. 13.11.2019 1 Циклы для жимовиков Пан Артем Статья включает описание саморасчитывающегося цикла, который подойдет атлетам, начиная от уровня II взрослого спортивного разряда и заканчивая КМС в соответствии с классификацией федерации WPC. Техника выполнения упражнений у данной группы атлетов уже является приемлемой, однако допускаются необходимые корректировки, призванные стимулировать развитие технического мастерства. Эти корректировки могут затрагивать как темповые характеристики жимов лежа и стоя, так и технику исполнения вспомогательных упражнений. Описывающийся цикл (далее Цикл №5) рекомендуется для использования атлетами жи',
    conditions: ['Условия соответствия цикла: СРЦ5 предназначен для спортсменов уровня II-КМС с нормальным весоростовым соотношением.', 'В цикле №5 применяется традиционная схема дозирования тренировочной нагрузки.', 'Принципы высокообъемного тренинга реализованы частично.', 'Тренинг на микровесах не применяется.', 'Местами включаются раскладки с высокой интенсивностью, однако их количество не позволяет отнести цикл к выходу на пик, или к смешанному.', 'СРЦ №5 представляет из себя силовой период – это значит, что в разминочных, подводящих или иных подходах количество повторений не должно превышать 6.', 'На заминке и разминке, которые являются обязательными для выполнения, данное условие также должно быть соблюдено.'],
  },
  week1: [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.57,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:6,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.57,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:6,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.32,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.68,reps:5,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:4,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.58,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.62,reps:3,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.73,reps:4,sets:2},{pct:0.77,reps:4,sets:2}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.61,reps:5,sets:1},{pct:0.72,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:4,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.7,reps:4,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.38,reps:6,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.7,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.53,reps:6,sets:1},{pct:0.62,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3},{pct:0.5,reps:5,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.61,reps:5,sets:1},{pct:0.72,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:6,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.74,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:4,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.58,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:5,sets:1},{pct:0.64,reps:4,sets:1},{pct:0.71,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.67,reps:6,sets:5}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:4,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.47,reps:5,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.66,reps:4,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:3},{pct:0.45,reps:4,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:1},{pct:0.58,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.64,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.62,reps:5,sets:1},{pct:0.72,reps:5,sets:5}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:5}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.42,reps:5,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:6,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.67,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.72,reps:4,sets:1},{pct:0.8,reps:4,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:6,sets:1},{pct:0.65,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.58,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.63,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.67,reps:5,sets:1},{pct:0.79,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.65,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4},{pct:0.4,reps:5,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:3},{pct:0.66,reps:4,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.72,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.7,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:6,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.53,reps:5,sets:1},{pct:0.59,reps:5,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.58,reps:6,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.67,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:1},{pct:0.75,reps:4,sets:1},{pct:0.82,reps:3,sets:1}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:5,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:2},{pct:0.45,reps:5,sets:2}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.62,reps:4,sets:1},{pct:0.74,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:2},{pct:0.45,reps:5,sets:2}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:5,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:1}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.58,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.62,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:3},{pct:0.65,reps:4,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.65,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:3},{pct:0.65,reps:5,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4},{pct:0.6,reps:3,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:4},{pct:0.55,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.77,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:2},{pct:0.55,reps:5,sets:2}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:3,sets:1},{pct:0.82,reps:3,sets:1}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5},{pct:0.66,reps:4,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3},{pct:0.45,reps:5,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    ],
  ],
};
