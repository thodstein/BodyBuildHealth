import type { SRCycleTemplate } from '../lms-types';

export const SRC2_GUSENITSA: SRCycleTemplate = {
 meta: {
  id: 'src2-gusenitsa',
  title: 'Гусеница (Суровецкий)',
  direction: 'powerlifting',
  level: 'II-KMS',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 4,
  correctionPct: 0.01,
  description: 'Программа "Гусеница" (автор Суровецкий). Волновая нагрузка с нарастанием: от 64% до 96% ПМ за 12 тренировок. Прогрессия 1%/нед.',
  howItWorks: 'Гусеница (Суровецкий). Волна: 64→96% ПМ. Пошаговое нарастание веса в каждом подходе. 3 тренировки/нед, 4 нед.',
  conditions: ['II разряд-КМС', '3 тренировки/нед', 'Волновая нагрузка'],
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
      pct: 0.36,
      reps: 8,
      sets: 1
     },
     {
      pct: 0.54,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.64,
      reps: 5,
      sets: 3
     }
    ]
   }
  ]
 }
],
};
