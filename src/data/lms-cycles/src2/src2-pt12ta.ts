import type { SRCycleTemplate } from '../lms-types';

export const SRC2_PT12TA: SRCycleTemplate = {
 meta: {
  id: 'src2-pt12ta',
  title: 'ПТ12-ТА (присед/тяга)',
  direction: 'powerlifting',
  level: 'II-KMS',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 4,
  correctionPct: 0.02,
  description: '12-сессионная программа приседа и тяги (автор Суровецкий). 12 тренировок с пирамидальной нагрузкой: 60-92% от ПМ. Прогрессия 2%/нед.',
  howItWorks: 'ПТ12-ТА (Суровецкий). 12 сессий/4 нед. Пирамида: 60%→92% ПМ. Тяжёлые проходки на 11-12 сессиях. Прогрессия 2%/нед.',
  conditions: ['II разряд-КМС', '3 тренировки/нед', '4 недели'],
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
      pct: 0.42,
      reps: 8,
      sets: 1
     },
     {
      pct: 0.588,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.784,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.84,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.896,
      reps: 4,
      sets: 9
     }
    ]
   }
  ]
 }
],
};
