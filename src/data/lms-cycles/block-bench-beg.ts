import type { SRCycleTemplate } from './lms-types';

/**
 * block-bench-beg.ts — Блочный: жим, новичок. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.02).
 */
export const BLOCK_BENCH_BEG: SRCycleTemplate = {
  meta: {
    id: 'block-bench-beg',
    title: 'Блочный: жим, новичок',
    direction: 'bench',
    level: 'novice',
    period: 'peak',
    minBodyWeight: 60,
    sessionsPerWeek: 3,
    weeks: 4,
    correctionPct: 0.02,
    sourceWeeks: true,
    description: 'Блочный: жим, новичок.',
    howItWorks: '*Статья включает описание блочных СРЦ, рассчитанных на 4 недели. При этом каждый СРЦ в случае, если он был успешно пройден, может повторяться вплоть до выраженной точки остановки прогресса, то есть пока спортсмен имеет прибавку.* Описывающиеся циклы (далее **Блочные СРЦ по жиму**) рекомендуются для использования атлетами жимовиками различного уровня спортивного мастерства, которые выступают в безэкипировочном дивизионе. Циклы представляют собой периоды по выходу на пик силы и призваны непосредственно растить силовой результат атлета. Блочные СРЦ по жиму не могут быть использованы абсолютными новичками, которые еще не имеют никакого опыта. Однако вполне допускается использование атлетами, кот',
    conditions: ['Условия соответствия цикла: 1.', 'Циклы рассчитаны на спортсменов-жимовиков, то есть атлетов, которые систематически готовятся только в жиме лежа.', 'Предполагается, что спортсмены имеют представление о технике выполнения упражнений и поставленный двигательный навык.', 'Допускается наличие изъянов в технике, однако при условии, что атлет постоянно совершенствует техническое мастерство.', 'В соответствии с классификационными требованиями федерации WPC, циклы рекомендованы атлетам: Уровня до II разряда – Уровня I-МС – Уровня выше МС – ; 2.', 'Предполагается, что атлет соблюдает спортивный режим, работает над собой и ведет активный образ жизни.', 'Циклы не подойдут людям, имеющим напряженную или излишне нервную работу, или же занятость, связанную с тяжелым физическим трудом; 3.'],
  },
  week1: [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.62,reps:3,sets:3},{pct:0.74,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.83,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:1},{pct:0.75,reps:3,sets:5}] },
      { name: 'Становая тяга', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.78,reps:2,sets:2},{pct:0.86,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:3},{pct:0.75,reps:2,sets:3},{pct:0.82,reps:1,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.76,reps:1,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:4,sets:1},{pct:0.62,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:4},{pct:0.75,reps:1,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.61,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:4},{pct:0.6,reps:3,sets:4}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.62,reps:3,sets:3},{pct:0.74,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.83,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:1},{pct:0.75,reps:3,sets:5}] },
      { name: 'Становая тяга', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.78,reps:2,sets:2},{pct:0.86,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:3},{pct:0.75,reps:2,sets:3},{pct:0.82,reps:1,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.76,reps:1,sets:3},{pct:0.8,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:4,sets:1},{pct:0.62,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:4},{pct:0.75,reps:1,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.61,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:4},{pct:0.6,reps:3,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.58,reps:4,sets:1},{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:3},{pct:0.82,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.72,reps:2,sets:2},{pct:0.79,reps:1,sets:2},{pct:0.86,reps:1,sets:2},{pct:0.92,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.62,reps:3,sets:3},{pct:0.7,reps:3,sets:1},{pct:0.78,reps:3,sets:1},{pct:0.83,reps:2,sets:2}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.65,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Становая тяга', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:3},{pct:0.78,reps:1,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.6,reps:5,sets:5}] },
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.72,reps:2,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.58,reps:4,sets:4},{pct:0.66,reps:3,sets:4}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.72,reps:2,sets:2},{pct:0.79,reps:2,sets:1},{pct:0.85,reps:2,sets:1}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:3},{pct:0.7,reps:1,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.43,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:2,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.72,reps:1,sets:3},{pct:0.77,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.63,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2},{pct:0.86,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.65,reps:3,sets:1},{pct:0.76,reps:2,sets:2},{pct:0.85,reps:2,sets:2},{pct:0.88,reps:2,sets:2}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.72,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Становая тяга', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:4,sets:1},{pct:0.61,reps:3,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.88,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.65,reps:3,sets:3},{pct:0.76,reps:2,sets:3},{pct:0.81,reps:1,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2},{pct:0.9,reps:1,sets:2}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:5}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:4,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:3,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.86,reps:2,sets:2}] },
      { name: 'Становая тяга', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.76,reps:1,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:1},{pct:0.78,reps:2,sets:2},{pct:0.86,reps:1,sets:2},{pct:0.9,reps:1,sets:2}] },
      { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.63,reps:5,sets:5}] },
      { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:3},{pct:0.75,reps:2,sets:3},{pct:0.83,reps:1,sets:3}] },
      { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:4,sets:4}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.79,reps:1,sets:2}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:4,sets:1},{pct:0.69,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:3,sets:5}] },
    ] },
    ],
  ],
};
