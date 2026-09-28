import type { SRCycleTemplate } from './lms-types';

/**
 * block-bench-exp.ts — Блочный: жим, продвинутый. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.005).
 */
export const BLOCK_BENCH_EXP: SRCycleTemplate = {
  meta: {
    id: 'block-bench-exp',
    title: 'Блочный: жим, продвинутый',
    direction: 'bench',
    level: 'MS-MSMK',
    period: 'peak',
    minBodyWeight: 60,
    sessionsPerWeek: 4,
    weeks: 4,
    correctionPct: 0.005,
    sourceWeeks: true,
    tags: ['lms'],
    description: 'Блочный: жим, продвинутый.',
    howItWorks: '*Статья включает описание блочных СРЦ, рассчитанных на 4 недели. При этом каждый СРЦ в случае, если он был успешно пройден, может повторяться вплоть до выраженной точки остановки прогресса, то есть пока спортсмен имеет прибавку.* Описывающиеся циклы (далее **Блочные СРЦ по жиму**) рекомендуются для использования атлетами жимовиками различного уровня спортивного мастерства, которые выступают в безэкипировочном дивизионе. Циклы представляют собой периоды по выходу на пик силы и призваны непосредственно растить силовой результат атлета. Блочные СРЦ по жиму не могут быть использованы абсолютными новичками, которые еще не имеют никакого опыта. Однако вполне допускается использование атлетами, кот',
    conditions: ['Условия соответствия цикла: 1.', 'Циклы рассчитаны на спортсменов-жимовиков, то есть атлетов, которые систематически готовятся только в жиме лежа.', 'Предполагается, что спортсмены имеют представление о технике выполнения упражнений и поставленный двигательный навык.', 'Допускается наличие изъянов в технике, однако при условии, что атлет постоянно совершенствует техническое мастерство.', 'В соответствии с классификационными требованиями федерации WPC, циклы рекомендованы атлетам: Уровня до II разряда – Уровня I-МС – Уровня выше МС – ; 2.', 'Предполагается, что атлет соблюдает спортивный режим, работает над собой и ведет активный образ жизни.', 'Циклы не подойдут людям, имеющим напряженную или излишне нервную работу, или же занятость, связанную с тяжелым физическим трудом; 3.'],
  },
  week1: [
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:3,sets:2},{pct:0.6,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:2,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:3},{pct:0.7,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.76,reps:1,sets:2}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2}] },
      { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:5}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Сгибание обратным хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.47,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.71,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2},{pct:0.7,reps:1,sets:2},{pct:0.76,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:3,sets:1},{pct:0.65,reps:2,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:2,sets:2},{pct:0.86,reps:1,sets:2}] },
      { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:4,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: '', coef: 1, mnosz: 2, sets: [{pct:0.51,reps:5,sets:5}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:3,sets:2},{pct:0.6,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:2,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:3},{pct:0.7,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.76,reps:1,sets:2}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2}] },
      { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:5}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Сгибание обратным хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.47,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.71,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2},{pct:0.7,reps:1,sets:2},{pct:0.76,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:3,sets:1},{pct:0.65,reps:2,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:2,sets:2},{pct:0.86,reps:1,sets:2}] },
      { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:4,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: '', coef: 1, mnosz: 2, sets: [{pct:0.51,reps:5,sets:5}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:3,sets:1},{pct:0.62,reps:2,sets:5}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.66,reps:2,sets:2},{pct:0.74,reps:2,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.81,reps:1,sets:2},{pct:0.86,reps:1,sets:2}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.63,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.77,reps:1,sets:2}] },
      { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.59,reps:5,sets:5}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.63,reps:3,sets:1},{pct:0.7,reps:2,sets:5}] },
      { name: 'Сгибание обратным хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.57,reps:4,sets:4}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.52,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:3,sets:1},{pct:0.6,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:3},{pct:0.7,reps:2,sets:3},{pct:0.81,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.57,reps:3,sets:4},{pct:0.66,reps:1,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.75,reps:1,sets:2}] },
      { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:4,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:1,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: '', coef: 1, mnosz: 2, sets: [{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:4,sets:4},{pct:0.63,reps:1,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.76,reps:1,sets:2}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:3},{pct:0.61,reps:1,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:2,sets:3},{pct:0.82,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:4}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:3,sets:1},{pct:0.62,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:5}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.65,reps:3,sets:3},{pct:0.76,reps:1,sets:3},{pct:0.83,reps:1,sets:3}] },
      { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.58,reps:5,sets:5}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Сгибание обратным хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.6,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:3,sets:1},{pct:0.65,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.66,reps:2,sets:2},{pct:0.73,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:2},{pct:0.7,reps:1,sets:2},{pct:0.77,reps:1,sets:2},{pct:0.85,reps:1,sets:2},{pct:0.92,reps:1,sets:2}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:3},{pct:0.68,reps:1,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:3,sets:1},{pct:0.65,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.66,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.86,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:3,sets:1},{pct:0.67,reps:2,sets:2},{pct:0.76,reps:1,sets:2}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:5}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.72,reps:2,sets:2},{pct:0.81,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:3,sets:5}] },
      { name: 'Сгибание обратным хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.4,reps:6,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:1,sets:3},{pct:0.77,reps:1,sets:3},{pct:0.86,reps:1,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.72,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.88,reps:1,sets:2}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.77,reps:1,sets:3}] },
    ] },
    ],
  ],
};
