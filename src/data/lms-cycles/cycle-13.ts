import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-13.ts — Смешанный интенсифицированный (жим). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.02).
 */
export const CYCLE_13: SRCycleTemplate = {
  meta: {
    id: 'cycle-13',
    title: 'Смешанный интенсифицированный (жим)',
    direction: 'bench',
    level: 'KMS-MSMK',
    period: 'mixed',
    sessionsPerWeek: 4,
    weeks: 12,
    correctionPct: 0.02,
    sourceWeeks: true,
    tags: ['lms'],
    description: 'Смешанный интенсифицированный (жим).',
    howItWorks: 'Инструкция №13. СРЦ для жимовика уровнем КМС-МСМК 19.11.2019 6 Циклы для жимовиков В данной статье содержится инструкция и рекомендации для СРЦ13.Первоначально цикл был создан под ограниченную аудиторию, так как в нем реализовывался высокоинтенсивный подход, а также линейное повышение тоннажа. На некоторых атлетах данная комбинация показала прекрасный результат, и им удавалось даже пробить длительный застой в жиме лежа. Некоторая часть атлетов, которые тестировали данный СРЦ жаловалась, что к середине цикла накапливается усталость и начинают болеть сухожилия креплений грудных – однако данная проблема не имела последствий и уходила после финальной разгрузки цикла и его завершения. СРЦ13 созда',
    conditions: ['Условия соответствия цикла: Средне-высокий уровень атлета жимовика.', 'Данный цикл может применяться КМС, МС а также МСМК.', 'Агрессивная схема организации нагрузок может вызвать сложности у атлетов, которые не имеют начальной подготовки и соответствующего опыта.', 'Необходимо добавить, что в рамках цикла предполагается спортивный режим и хорошее питание.', 'Если атлет не может гарантировать этого, то лучше отказаться в пользу более легких жимовых СРЦ; В СРЦ 13 используются средние значения интенсивности по ходу цикла.', 'Присутствует достаточное количество раскладок на довольно высоком проценте.', 'В совокупности с высоким тоннажем, который постоянно увеличивается, это рождает высокую общую нагрузку на спортсмена.'],
  },
  week1: [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:4,sets:1},{pct:0.62,reps:3,sets:5}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:1},{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.61,reps:4,sets:1},{pct:0.66,reps:3,sets:5},{pct:0.7,reps:2,sets:5}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:4,sets:1},{pct:0.62,reps:3,sets:5}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:1},{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.61,reps:4,sets:1},{pct:0.66,reps:3,sets:5},{pct:0.7,reps:2,sets:5}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:4,sets:5},{pct:0.5,reps:3,sets:5}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:3,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:6,sets:4},{pct:0.7,reps:5,sets:4}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:2,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4},{pct:0.4,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:5,sets:4},{pct:0.33,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:5},{pct:0.55,reps:3,sets:5}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4},{pct:0.4,reps:5,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:5},{pct:0.35,reps:5,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:4},{pct:0.4,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:5,sets:5}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:3,sets:3},{pct:0.55,reps:2,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:5,sets:4},{pct:0.4,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5},{pct:0.65,reps:4,sets:1},{pct:0.7,reps:3,sets:1}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:4},{pct:0.6,reps:3,sets:4}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:3},{pct:0.5,reps:5,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5},{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.55,reps:6,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4},{pct:0.5,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:4,sets:1},{pct:0.75,reps:3,sets:4},{pct:0.8,reps:2,sets:4}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:3,sets:3},{pct:0.6,reps:2,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:4},{pct:0.55,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:3},{pct:0.55,reps:4,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:4},{pct:0.65,reps:3,sets:4},{pct:0.75,reps:2,sets:1}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:5},{pct:0.65,reps:2,sets:5}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:5},{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:4},{pct:0.65,reps:4,sets:4}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:4},{pct:0.6,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:4},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:3,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.6,reps:5,sets:3},{pct:0.7,reps:4,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:1},{pct:0.8,reps:3,sets:5}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:4},{pct:0.6,reps:4,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:6,sets:5},{pct:0.35,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:4},{pct:0.7,reps:3,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:4},{pct:0.6,reps:5,sets:4}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:5,sets:3},{pct:0.7,reps:4,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:1},{pct:0.65,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:3},{pct:0.7,reps:1,sets:3}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5},{pct:0.6,reps:4,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.65,reps:5,sets:4},{pct:0.7,reps:4,sets:4}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:5},{pct:0.65,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.6,reps:3,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.65,reps:5,sets:4},{pct:0.75,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:4,sets:1},{pct:0.75,reps:3,sets:1},{pct:0.85,reps:2,sets:5}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:5},{pct:0.5,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:6,sets:3},{pct:0.4,reps:5,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5},{pct:0.44,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:5,sets:3},{pct:0.75,reps:4,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:1},{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.62,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.75,reps:1,sets:3}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5},{pct:0.65,reps:4,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.31,reps:5,sets:5},{pct:0.35,reps:4,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:5},{pct:0.62,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.39,reps:5,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.66,reps:4,sets:5},{pct:0.7,reps:3,sets:5}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:5},{pct:0.6,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.41,reps:6,sets:3},{pct:0.5,reps:5,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.47,reps:6,sets:5},{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.46,reps:6,sets:4},{pct:0.51,reps:5,sets:4}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.68,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.61,reps:5,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:6,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:4},{pct:0.5,reps:5,sets:4}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.5,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.33,reps:5,sets:5},{pct:0.37,reps:4,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:5},{pct:0.65,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.51,reps:5,sets:1},{pct:0.61,reps:4,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.61,reps:5,sets:1},{pct:0.7,reps:4,sets:4},{pct:0.74,reps:3,sets:4}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.61,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5},{pct:0.7,reps:4,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:4},{pct:0.56,reps:5,sets:4},{pct:0.65,reps:1,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:6,sets:4},{pct:0.65,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.56,reps:6,sets:4},{pct:0.66,reps:5,sets:4}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:1},{pct:0.65,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.75,reps:4,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:3,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.51,reps:5,sets:1},{pct:0.7,reps:4,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:4},{pct:0.6,reps:4,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5},{pct:0.5,reps:4,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.61,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.54,reps:5,sets:1},{pct:0.64,reps:4,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.65,reps:5,sets:5},{pct:0.7,reps:4,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.63,reps:4,sets:1},{pct:0.73,reps:4,sets:4},{pct:0.8,reps:3,sets:4}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:3,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:5,sets:5},{pct:0.75,reps:4,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.49,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.71,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:5}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:5,sets:1},{pct:0.72,reps:4,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:6,sets:4},{pct:0.6,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.54,reps:5,sets:1},{pct:0.64,reps:4,sets:4},{pct:0.72,reps:3,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.4,reps:6,sets:5},{pct:0.55,reps:5,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:4},{pct:0.65,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5},{pct:0.6,reps:4,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.46,reps:6,sets:5},{pct:0.53,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:4,sets:1},{pct:0.68,reps:4,sets:4}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:4},{pct:0.63,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.64,reps:4,sets:1},{pct:0.77,reps:3,sets:4},{pct:0.83,reps:2,sets:4}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.49,reps:3,sets:4},{pct:0.53,reps:2,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:4},{pct:0.6,reps:5,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.55,reps:3,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:5,sets:1},{pct:0.64,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:4,sets:1},{pct:0.6,reps:3,sets:5}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:4},{pct:0.6,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:3,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:5},{pct:0.55,reps:5,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.61,reps:5,sets:5},{pct:0.63,reps:4,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.52,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:6}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5},{pct:0.55,reps:4,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.67,reps:3,sets:1},{pct:0.85,reps:2,sets:5}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:3,sets:3},{pct:0.65,reps:2,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:6,sets:3},{pct:0.65,reps:5,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:4,sets:1},{pct:0.66,reps:3,sets:5},{pct:0.7,reps:1,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.62,reps:5,sets:1},{pct:0.69,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Французский жим лежа', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.66,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:3,sets:5},{pct:0.56,reps:1,sets:3},{pct:0.66,reps:1,sets:3}] },
      { name: 'Жим на наклонной скамье', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:3,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: 'ЖИМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5},{pct:0.6,reps:4,sets:5}] },
      { name: 'Разгиб. с гантелью из-за головы', group: 'ОФП', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:6,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:3,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:4,sets:1},{pct:0.63,reps:3,sets:5}] },
      { name: 'Бицепс с гантелями', group: 'ОФП', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖИМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:5},{pct:0.8,reps:2,sets:5}] },
      { name: 'Уступающий жим', group: 'ЖИМ', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.66,reps:2,sets:5}] },
      { name: 'Жим гантелей', group: 'ЖИМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:6,sets:4}] },
    ] },
    ],
  ],
};
