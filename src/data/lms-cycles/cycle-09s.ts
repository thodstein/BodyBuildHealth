import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-09s.ts — Смешанный (тяга+жим, сумо). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.01).
 */
export const CYCLE_09S: SRCycleTemplate = {
  meta: {
    id: 'cycle-09s',
    title: 'Смешанный (тяга+жим, сумо)',
    direction: 'deadlift_bench',
    level: 'MS-MSMK',
    period: 'mixed',
    minBodyWeight: 80,
    sessionsPerWeek: 3,
    weeks: 12,
    correctionPct: 0.01,
    description: '12-недельный смешанный цикл (тяга+жим, стойка сумо) для уровня МС-МСМК. Чередует фазы накопления и интенсификации для равномерного прогресса с акцентом на тягу сумо и жим лёжа.',
    howItWorks: 'Инструкция №9. СРЦ для тяги и жима под атлета, уровнем МС-МСМК 17.11.2019 1 Прочие циклы Становая тяга В данной статье содержится инструкция и рекомендации для СРЦ9. Данный цикл рассчитан на атлетов, которые выбрали своей специализацией в рамках конкретного периода тягу и жим лежа. Так как соревнования отдельно в тяге уже приобрели некоторую популярность, то данный цикл может быть взят в работу спортсменами, которые стремятся целенаправленно подготовиться в тяге, а также не забывают о жиме лежа. Цикл представляет из себя смешанный период и может использоваться как в межсезонье, так и в период активной подготовки к соревнованиям. Описываемый СРЦ представляет собой смешанный цикл, а значит, в ',
    conditions: ['Условия соответствия цикла: Высокий уровень атлетов.', 'Данный цикл может применяться МС, а также МСМК, имеющих вес тела 80 кг или более.', 'Весоростовое соотношение должно минимально отклоняться от рекомендованного для данной категории спортивного мастерства; Цикл рассчитан на спортсменов, у которых доминирующим движением является становая тяга.', 'В СРЦ 9 используются средние значения интенсивности по ходу цикла.', 'Учитывая смешанный характер цикла, атлет не должен в ходе разминки, заминки или подводящих подходах в упражнениях, выполнять более 6 повторений, чтобы избежать избыточного закисления или (и) накопления усталости.'],
  },
  week1: [
    { exercises: [
      { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Средняя', sets: [{pct:2,reps:0,sets:4},{pct:4,reps:0,sets:3}] },
    ] },
    { exercises: [
      { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:5,reps:0,sets:6}] },
      { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Легкая', sets: [{pct:4,reps:0,sets:4}] },
      { name: 'ЖИМ', group: '', coef: 1, mnosz: 0.8, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
      { name: 'ОФП', group: '', coef: 1, mnosz: 0.5, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:4,reps:0,sets:5}] },
      { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
      { name: 'ОФП', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
      { name: 'ОФП', group: '', coef: 1, mnosz: 1.2, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:4,reps:0,sets:4}] },
      { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:1,reps:0,sets:5},{pct:4,reps:0,sets:4}] },
      { name: 'ОФП', group: '', coef: 1, mnosz: 0.8, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
    ] },
    { exercises: [
      { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Средняя', sets: [{pct:2,reps:0,sets:6},{pct:4,reps:0,sets:4}] },
      { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:5,reps:0,sets:5}] },
      { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Легкая', sets: [{pct:6,reps:0,sets:3}] },
      { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
      { name: 'ЖИМ', group: '', coef: 1, mnosz: 0.8, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
      { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Легкая', sets: [{pct:5,reps:0,sets:3}] },
      { name: 'ОФП', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:5,reps:0,sets:5}] },
      { name: 'ОФП', group: '', coef: 1, mnosz: 1.2, load: 'Легкая', sets: [{pct:5,reps:0,sets:6}] },
      { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:5,reps:0,sets:5}] },
      { name: 'ОФП', group: '', coef: 1, mnosz: 0.8, load: 'Легкая', sets: [{pct:4,reps:0,sets:6}] },
    ] },
  ],
};
