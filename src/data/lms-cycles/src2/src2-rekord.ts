import type { SRCycleTemplate } from '../lms-types';

export const SRC2_REKORD: SRCycleTemplate = {
 meta: {
  id: 'src2-rekord',
  title: 'Рекорд (Суровецкий)',
  direction: 'powerlifting',
  level: 'KMS-MS',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 7,
  correctionPct: 0.015,
  description: 'Программа "Рекорд" (автор Суровецкий). 22 тренировки с волновой периодизацией. Проценты от ПМ: 60-100% с шагом 4%. Прогрессия 1.5%/нед.',
  howItWorks: 'Рекорд (Суровецкий). 22 тренировки/7 нед. Волновая нагрузка: 60-100% ПМ. Финальные проходки с превышением ПМ на 2.5-5 кг. Прогрессия 1.5%/нед.',
  conditions: ['КМС-МС', '3 тренировки/нед', 'Волновая периодизация'],
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
      pct: 0.54,
      reps: 8,
      sets: 1
     },
     {
      pct: 0.68,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.72,
      reps: 5,
      sets: 5
     }
    ]
   }
  ]
 }
],
};
