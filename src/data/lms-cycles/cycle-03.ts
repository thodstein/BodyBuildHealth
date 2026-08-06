import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-03.ts — Цикл на выносливость (жим, новичок). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.01).
 */
export const CYCLE_03: SRCycleTemplate = {
  meta: {
    id: 'cycle-03',
    title: 'Цикл на выносливость (жим, новичок)',
    direction: 'bench',
    level: 'novice',
    period: 'endurance',
    minBodyWeight: 80,
    sessionsPerWeek: 3,
    weeks: 12,
    correctionPct: 0.01,
    sourceWeeks: true,
    description: 'Цикл на выносливость (жим, новичок).',
    howItWorks: 'Инструкция №3. СРЦ для жимовика (новичок). Выносливость. 07.11.2019 8 Циклы для жимовиков Начинающий пауэрлифтер Статья включает описание СРЦ для начинающих жимовиков. Рассматривается период на выносливость для атлета с нормальным весоростовым соотношением и массой тела 70 кг или более. Атлеты должны получить основное понимание техники исполнения базовых упражнений и в ходе периода возможен достаточный массив работы по совершенствованию технического мастерства. Корректировки могут касаться абсолютно любых аспектов техники, начиная от первичной ее постановки. Описывающийся цикл (далее Цикл №3 или СРЦ3) целесообразно использовать спортсменами-новичками, которые имеют достаточную предрасположен',
    conditions: ['Условия соответствия цикла: Уровень спортсмена начальный.', 'Тем не менее, атлет должен иметь достаточную предрасположенность к занятиям спортом.', 'Данное условие вытекает из достаточно большого процента корректировки недельного цикла, а также специфики дозирования нагрузки.', 'Предполагается, что спортсмен будет достаточно быстро повышать свою тренированность и спортивный результат.', 'Весоростовое соотношение должно быть оптимальным или с малыми отклонениями.', 'Минимальный вес атлета для его соответствия указанному циклу — 70 кг; Предполагается, что спортсмены не обладают хорошей техникой, но в ходе цикла идет ее постоянное совершенствование.', 'Так как рассматривается цикл спортсмена жимовика, то главный упор необходимо делать на освоение и совершенствование техники жима лежа и вспомогательных упражнений.'],
  },
  week1: [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.35,reps:10,sets:2}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:20,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:12,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:10,sets:2}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.65,reps:12,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.35,reps:10,sets:2}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:20,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:12,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:10,sets:2}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.65,reps:12,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.62,reps:12,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:12,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:20,sets:1}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:8,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:12,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:10,sets:1},{pct:0.55,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.61,reps:10,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:8,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.61,reps:10,sets:1},{pct:0.7,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:8,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:1},{pct:0.65,reps:8,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.62,reps:8,sets:2}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:8,sets:3}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:12,sets:1},{pct:0.65,reps:10,sets:1},{pct:0.73,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:10,sets:1},{pct:0.62,reps:8,sets:1},{pct:0.72,reps:8,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:1},{pct:0.7,reps:8,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.65,reps:10,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:20,sets:1}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:8,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:8,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.7,reps:8,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:1}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:12,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.65,reps:10,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.65,reps:10,sets:1},{pct:0.75,reps:8,sets:1}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.65,reps:10,sets:1},{pct:0.75,reps:8,sets:1}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:1},{pct:0.7,reps:8,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:10,sets:1},{pct:0.7,reps:8,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:10,sets:1},{pct:0.65,reps:8,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.4,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:10,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:10,sets:1},{pct:0.75,reps:8,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.62,reps:10,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1},{pct:0.75,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.7,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:10,sets:1},{pct:0.7,reps:8,sets:1}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:15,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1},{pct:0.75,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:1},{pct:0.45,reps:15,sets:1}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ОФП', coef: 1.3, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.65,reps:10,sets:1},{pct:0.75,reps:8,sets:1}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:5}] },
    ] },
    ],
  ],
};
