import type { SRCycleTemplate } from '../lms-types';

export const SRC2_VOLNA: SRCycleTemplate = {
 meta: {
  id: 'src2-volna',
  title: 'Волна (Суровецкий)',
  direction: 'powerlifting',
  level: 'II-KMS',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 4,
  correctionPct: 0.01,
  description: 'Программа "Волна" (автор Суровецкий). Классическая волновая периодизация с тремя пиками нагрузки за цикл. Прогрессия 1%/нед.',
  howItWorks: 'Волна (Суровецкий). 3 волновых пика за 12 тренировок. Каждый пик: 70→85→90%. Волна с затуханием. Прогрессия 1%/нед.',
  conditions: ['II разряд-КМС', '3 тренировки/нед', 'Волновая периодизация'],
  tags: ['surovetsky']
 },
 week1: [
 {
  exercises: [
   {
    name: 'Присед/жим',
    group: 'ЖМ',
    coef: 1,
    mnosz: 1,
    load: 'Тяжелая',
    sets: [
     {
      pct: 0.5,
      reps: 6,
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
      sets: 5
     }
    ]
   }
  ]
 }
],
};
