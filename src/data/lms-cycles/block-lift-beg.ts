import type { SRCycleTemplate } from './lms-types';

/**
 * block-lift-beg.ts — Блочный: троеборье, новичок. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.02).
 */
export const BLOCK_LIFT_BEG: SRCycleTemplate = {
  meta: {
    id: 'block-lift-beg',
    title: 'Блочный: троеборье, новичок',
    direction: 'powerlifting',
    level: 'novice',
    period: 'peak',
    minBodyWeight: 60,
    sessionsPerWeek: 3,
    weeks: 4,
    correctionPct: 0.02,
    sourceWeeks: true,
    tags: ['lms'],
    description: 'Блочный: троеборье, новичок.',
    howItWorks: '*Статья включает описание блочных СРЦ, рассчитанных на 4 недели. При этом каждый СРЦ в случае, если он был успешно пройден, может повторяться вплоть до выраженной точки остановки прогресса, то есть, пока спортсмен имеет прибавку. В данной статье приводятся циклы для троеборцев.* Данные циклы (далее « **Блочные СРЦ по пауэрлифтингу»**) рекомендуются для использования атлетами-троеборцами различного уровня спортивного мастерства, которые выступают в безэкипировочном дивизионе. Циклы представляют собой периоды по выходу на пик силы и призваны непосредственно растить силовой результат атлета. Блочные СРЦ по пауэрлифтингу не могут быть использованы абсолютными новичками, которые еще не имеют ника',
    conditions: ['Условия соответствия цикла: 1.', 'Циклы рассчитаны на спортсменов-троеборцев, то есть атлетов, которые систематически готовятся к соревнованиям по пауэрлифтингу.', 'Предполагается, что спортсмены имеют представление о технике выполнения упражнений и поставленный двигательный навык.', 'Допускается наличие изъянов в технике, однако при условии, что атлет постоянно совершенствует техническое мастерство.', 'В соответствии с классификационными требованиями федерации WPC, циклы рекомендованы атлетам: Уровня до II разряда – Уровня I-МС – Уровня выше МС – ; 2.', 'Предполагается, что атлет соблюдает спортивный режим, работает над собой и ведет активный образ жизни.', 'Циклы не подойдут людям, имеющим напряженную или излишне нервную работу, или же занятость, связанную с тяжелым физическим трудом; 3.'],
  },
  week1: [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.78,reps:1,sets:2}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.83,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Наклоны со штангой', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.75,reps:3,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим на наклонной скамье', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.78,reps:1,sets:2}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.83,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Наклоны со штангой', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.75,reps:3,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим на наклонной скамье', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:1},{pct:0.8,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.66,reps:4,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.55,reps:5,sets:1},{pct:0.7,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2},{pct:0.9,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Наклоны со штангой', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:4},{pct:0.55,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:2,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:1},{pct:0.85,reps:2,sets:2},{pct:0.88,reps:1,sets:2}] },
      { name: 'Жим на наклонной скамье', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:4,sets:1},{pct:0.75,reps:3,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:4}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:3}] },
      { name: 'Наклоны со штангой', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:5,sets:1},{pct:0.7,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:3,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Жим на наклонной скамье', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:5,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
      { name: 'Жим гантелей', group: 'ЖМ', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:6,sets:3}] },
    ] },
    { exercises: [
      { name: 'Становая тяга', group: 'ТГ', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.77,reps:1,sets:2}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
      { name: 'Наклоны со штангой', group: 'ОФП', coef: 0.8, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Жим стоя', group: 'ОФП', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.59,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:5}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:4,sets:3},{pct:0.75,reps:3,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим на наклонной скамье', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:5,sets:5}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:5,sets:5}] },
    ] },
    ],
  ],
};
