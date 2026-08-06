import type { SRCycleTemplate } from './lms-types';

/**
 * embed-bic-exp.ts — Встраиваемый: бицепс, продвинутый. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.005).
 */
export const EMBED_BIC_EXP: SRCycleTemplate = {
  meta: {
    id: 'embed-bic-exp',
    title: 'Встраиваемый: бицепс, продвинутый',
    direction: 'bodybuilding',
    level: 'MS-MSMK',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 4,
    correctionPct: 0.005,
    sourceWeeks: true,
    description: 'Встраиваемый: бицепс, продвинутый.',
    howItWorks: '*Данная инструкция включает в себя встраиваемые циклы для тренировки строгого подъема на бицепс. Не смотря на то, что такое движение, как строгий подъем, в последнее время набирает популярность, тем не менее, сложно представить атлета, который будет готовиться только в данной дисциплине. Исходя из этого, были разработаны встраиваемые циклы, а именно циклы, которые можно встроить в любой план и добавить достаточные тренировки строгого подъема. Это даст возможность полноценно готовиться в строгом подъеме на бицепс и при этом не мешать основной специализации атлета. А таковая может быть как троеборье или жим лежа, так и любая другая.* Первое на что нужно обратить внимание, если атлет хочет взят',
    conditions: [],
  },
  week1: [
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.43,reps:6,sets:3},{pct:0.5,reps:5,sets:3}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4},{pct:0.7,reps:3,sets:4}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.68,reps:4,sets:4}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:6,sets:5}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.43,reps:6,sets:3},{pct:0.5,reps:5,sets:3}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4},{pct:0.7,reps:3,sets:4}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.68,reps:4,sets:4}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:6,sets:5}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.8,reps:1,sets:2}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:1},{pct:0.8,reps:4,sets:4}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:1,sets:2}] },
      { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:5}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:5,sets:5}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:4}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
      { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.65,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:6,sets:1},{pct:0.67,reps:5,sets:5}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:3},{pct:0.45,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:5}] },
    ] },
    { exercises: [
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.3,reps:6,sets:5},{pct:0.35,reps:5,sets:5}] },
      { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
      { name: 'Строгий подъем на бицепс', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
    ] },
    { exercises: [
      { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:4}] },
      { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
      { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:3}] },
    ] },
    ],
  ],
};
