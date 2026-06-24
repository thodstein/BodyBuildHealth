import type { SRCycleTemplate } from './lms-types';

/**
 * embed-bic-int.ts — Встраиваемый: бицепс, средний. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const EMBED_BIC_INT: SRCycleTemplate = {
  meta: {
    id: 'embed-bic-int',
    title: 'Встраиваемый: бицепс, средний',
    direction: 'bodybuilding',
    level: 'II-MS',
    period: 'strength',
    sessionsPerWeek: 1,
    weeks: 12,
    correctionPct: 0.005,
    description: 'Встраиваемый: бицепс, средний.',
    howItWorks: '*Данная инструкция включает в себя встраиваемые циклы для тренировки строгого подъема на бицепс. Не смотря на то, что такое движение, как строгий подъем, в последнее время набирает популярность, тем не менее, сложно представить атлета, который будет готовиться только в данной дисциплине. Исходя из этого, были разработаны встраиваемые циклы, а именно циклы, которые можно встроить в любой план и добавить достаточные тренировки строгого подъема. Это даст возможность полноценно готовиться в строгом подъеме на бицепс и при этом не мешать основной специализации атлета. А таковая может быть как троеборье или жим лежа, так и любая другая.* Первое на что нужно обратить внимание, если атлет хочет взят',
    conditions: [],
  },
  week1: [
    { exercises: [
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:4}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:4},{pct:0.68,reps:1,sets:4}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:3},{pct:0.65,reps:1,sets:3},{pct:0.75,reps:1,sets:3}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:5,sets:5}] },
      { name: 'Упражнение комплекса', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:1},{pct:0.6,reps:4,sets:4},{pct:0.7,reps:3,sets:4}] },
      { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:5,sets:5}] },
      { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 1, sets: [{pct:0.44,reps:5,sets:5}] },
    ] },
  ],
};
