import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from '../lms-types';

const s = (pct:number,reps:number,sets=1):SRSetSpec=>({pct,reps,sets});
const ex = (name:string,group:string,coef:number,sets:SRSetSpec[]):SRExerciseSpec=>({name,group,coef,mnosz:1,sets});
const day = (...exercises:SRExerciseSpec[]):SRDaySpec=>({exercises});

// Том МакКаллоу — тяга/жим 14 недель. Источник Tyagovy-tsikl-Toma-Makkelou.xls (ПМ 250). Вес -> pct.
const weeks: SRDaySpec[][] = [
 [day(ex('Становая тяга','Спина',1.4,[s(0.70,10,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.70,10,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.73,8,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.76,8,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.79,5,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.82,5,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.85,5,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.88,5,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.91,3,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.94,3,3)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(0.968,2,2)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(1.00,2,2)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(1.04,1,1)]))],
 [day(ex('Становая тяга','Спина',1.4,[s(1.11,1,1)]))],
];

export const SRC2_MCCULLOUGH_DL: SRCycleTemplate = {
  meta: {
    id: 'src2-mccullough-dl',
    title: 'Том МакКаллоу тяга/жим (14 недель)',
    direction: 'deadlift_bench',
    level: 'II-KMS',
    period: 'strength',
    sessionsPerWeek: 1,
    weeks: 14,
    correctionPct: 0,
    sourceWeeks: true,
    description: 'Линейная программа Тома МакКаллоу: 1 тренировка в неделю, 175x10x3 -> 277.5x1x1. Подходит для тяги и жима.',
    howItWorks: 'Вес +7.5кг/нед, повторы 10->8->5->3->2->1. Написана под тягу (ПМ 250), но автор отмечает подходит и для жима. 1-2 тренировки в неделю на одно движение.',
    conditions: ['Для II-КМС', '1 тренировка в неделю на движение', 'Простая линейка, требует восстановления'],
  },
  week1: weeks[0],
  weeks,
};
