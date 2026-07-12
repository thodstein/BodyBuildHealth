import type { SRCycleTemplate } from '../lms-types';

export const SRC2_PERSPEKTIVA: SRCycleTemplate = {
 meta: {
  id: 'src2-perspektiva',
  title: 'Перспектива (Суровецкий)',
  direction: 'powerlifting',
  level: 'novice',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 2,
  weeks: 6,
  correctionPct: 0.01,
  description: 'Программа "Перспектива" (автор Суровецкий). 12 тренировок в 2 части: основная (6 трен) и реализационная (6 трен). Ступенчатая пирамида: 75%×5→100%×1.',
  howItWorks: 'Перспектива (Суровецкий). 12 тренировок/6 нед. Часть 1: 5×5 на 67.5% ПМ. Часть 2: пирамида от 75% до 100+%. Соревновательная проходка.',
  conditions: ['Новичок-разрядник', '2 тренировки/нед', 'Без экипировки'],
  tags: ['surovetsky']
 },
 week1: [
 {
  exercises: [
   {
    name: 'Жим лежа',
    group: 'Жим',
    coef: 1,
    mnosz: 1,
    load: 'Тяжелая',
    sets: [
     {
      pct: 0.525,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.675,
      reps: 5,
      sets: 5
     }
    ]
   }
  ]
 }
],
};
