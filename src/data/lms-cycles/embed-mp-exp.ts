import type { SRCycleTemplate } from './lms-types';

/**
 * embed-mp-exp.ts — Встраиваемый: жим стоя, продвинутый. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.005).
 */
export const EMBED_MP_EXP: SRCycleTemplate = {
  meta: {
    id: 'embed-mp-exp',
    title: 'Встраиваемый: жим стоя, продвинутый',
    direction: 'bench',
    level: 'MS-MSMK',
    period: 'strength',
    sessionsPerWeek: 3,
    weeks: 4,
    correctionPct: 0.005,
    sourceWeeks: true,
    description: 'Встраиваемый: жим стоя, продвинутый.',
    howItWorks: '*Данная инструкция включает в себя встраиваемые циклы для тренировки жима стоя. Жим стоя (**армейский жим**) – довольно популярное движение среди атлетов силового направления. Многие пауэрлифтеры ставят перед собой цель прогрессировать в данном упражнении, однако, возникает задача тренировать армейский жим так, чтобы не мешать основной специализации. Именно с этим расчетом написаны данные программы подготовки. Атлет может использовать их, если имеет желание и цель прогрессировать в жиме стоя, при этом, после встраивания, дополнительные упражнения не должны существенно затруднять подготовку по основному направлению.* Конечно, какой бы ни был цикл, он должен быть соответствующим образом привяз',
    conditions: [],
  },
  week1: [
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:5,sets:5},{pct:0.55,reps:4,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5},{pct:0.56,reps:4,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:5,sets:5},{pct:0.55,reps:4,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5},{pct:0.56,reps:4,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:3,sets:1}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.35,reps:6,sets:4},{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:6,sets:3},{pct:0.5,reps:5,sets:3}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:3},{pct:0.7,reps:4,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:6,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:3},{pct:0.45,reps:5,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.35,reps:6,sets:4},{pct:0.4,reps:5,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:3},{pct:0.45,reps:5,sets:3}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.75,reps:4,sets:1},{pct:0.82,reps:4,sets:1}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4},{pct:0.75,reps:4,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:5}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:5,sets:5}] },
    ] },
    ],
  ],
};
