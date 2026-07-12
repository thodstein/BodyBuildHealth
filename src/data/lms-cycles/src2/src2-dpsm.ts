import type { SRCycleTemplate } from '../lms-types';

export const SRC2_DPSM: SRCycleTemplate = {
 meta: {
  id: 'src2-dpsm',
  title: 'ДПСМ (Суровецкий)',
  direction: 'powerlifting',
  level: 'KMS-MS',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 6,
  correctionPct: 0.01,
  description: 'ДПСМ — длительная прогрессивная система (автор Суровецкий). 18 тренировок с нарастающей нагрузкой. Прогрессия 1%/нед.',
  howItWorks: 'ДПСМ (Суровецкий). Длительная прогрессивная система. 18 тренировок/6 нед. Нарастающая нагрузка 60-90% ПМ. Прогрессия 1%/нед.',
  conditions: ['КМС-МС', '3 тренировки/нед', 'Длительная прогрессия'],
  tags: ['surovetsky']
 },
 week1: [
 {
  exercises: [
   {
    name: 'Присед',
    group: 'Ноги',
    coef: 1.2,
    mnosz: 1,
    load: 'Тяжелая',
    sets: [
     {
      pct: 0.5,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 4,
      sets: 4
     }
    ]
   },
   {
    name: 'Жим лежа',
    group: 'Жим',
    coef: 1,
    mnosz: 1,
    load: 'Тяжелая',
    sets: [
     {
      pct: 0.5,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 5,
      sets: 4
     }
    ]
   }
  ]
 }
],
};
