import type { SRCycleTemplate } from '../lms-types';

export const SRC2_PTBAZ_8: SRCycleTemplate = {
 meta: {
  id: 'src2-ptbaz-8',
  title: 'ПТ-БАЗ 8 нед (с разгрузкой)',
  direction: 'powerlifting',
  level: 'II-KMS',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 8,
  correctionPct: 0.01,
  description: '8-недельная базовая программа с разгрузкой (автор Суровецкий). Чередование приседа и тяги: 3 тренировки/нед. Встроенная разгрузка на 5-й неделе. Прогрессия 1%/нед.',
  howItWorks: 'ПТ-БАЗ 8 нед (Суровецкий). Чередование П-Т-П/Т-П-Т по неделям. Пн: присед(П)/тяга(Т). Ср: тяга/присед. Пт: присед+полуприсед/тяга+дотяга. Разгрузка 5 нед.',
  conditions: ['II разряд-КМС', '3 тренировки/нед', 'Чередование нагрузки'],
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
      pct: 0.52,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.625,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.675,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.725,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.8,
      reps: 3,
      sets: 2
     }
    ]
   }
  ]
 },
 {
  exercises: [
   {
    name: 'Тяга становая',
    group: 'Спина',
    coef: 1.4,
    mnosz: 1,
    load: 'Тяжелая',
    sets: [
     {
      pct: 0.52,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.625,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.675,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 5,
      sets: 5
     }
    ]
   }
  ]
 },
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
      pct: 0.52,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.75,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.8,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.85,
      reps: 2,
      sets: 1
     },
     {
      pct: 0.9,
      reps: 3,
      sets: 1
     }
    ]
   },
   {
    name: 'Полуприсед',
    group: 'Ноги',
    coef: 1,
    mnosz: 1,
    load: 'Средняя',
    sets: [
     {
      pct: 0.9,
      reps: 3,
      sets: 2
     }
    ]
   }
  ]
 }
],
};
