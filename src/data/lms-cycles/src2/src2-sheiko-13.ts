import type { SRCycleTemplate } from '../lms-types';

export const SRC2_SHEIKO_13: SRCycleTemplate = {
 meta: {
  id: 'src2-sheiko-13',
  title: 'Шейко 13 нед (ПЛ)',
  direction: 'powerlifting',
  level: 'KMS-MS',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 4,
  weeks: 13,
  correctionPct: 0.005,
  description: '13-недельная программа Шейко по пауэрлифтингу (троеборье). 4 тренировки/нед с волновой периодизацией: 50-90% ПМ. Пирамидальная схема подходов. Прогрессия 0.5%/нед.',
  howItWorks: 'Шейко 13 нед. Троеборье, 4 тренировки/нед. Волновая периодизация 50-90%: понед-вторник-четверг-суббота. Пирамида: подходы×повторы снижаются с ростом % ПМ.',
  conditions: ['КМС-МС', '4 тренировки/нед', '13 недель'],
  tags: ['sheiko']
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
      reps: 4,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.75,
      reps: 3,
      sets: 5
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
      reps: 4,
      sets: 4
     }
    ]
   },
   {
    name: 'Наклоны',
    group: 'Спина',
    coef: 0.5,
    mnosz: 2,
    load: 'Средняя',
    sets: []
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
      sets: 2
     },
     {
      pct: 0.75,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.8,
      reps: 2,
      sets: 2
     },
     {
      pct: 0.75,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.7,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.5,
      reps: 6,
      sets: 1
     }
    ]
   },
   {
    name: 'Румынская тяга',
    group: 'Спина',
    coef: 1,
    mnosz: 1,
    load: 'Средняя',
    sets: [
     {
      pct: 0.4,
      reps: 6,
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
      pct: 0.5,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.8,
      reps: 2,
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
      pct: 0.5,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.75,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.8,
      reps: 2,
      sets: 2
     },
     {
      pct: 0.75,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.7,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.5,
      reps: 6,
      sets: 1
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
      reps: 4,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 3,
      sets: 2
     },
     {
      pct: 0.75,
      reps: 2,
      sets: 3
     }
    ]
   }
  ]
 }
],
};
