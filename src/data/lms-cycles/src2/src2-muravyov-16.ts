import type { SRCycleTemplate } from '../lms-types';

export const SRC2_MURAVYOV_16: SRCycleTemplate = {
 meta: {
  id: 'src2-muravyov-16',
  title: 'Муравьёв 16 нед (база ПЛ)',
  direction: 'powerlifting',
  level: 'KMS-MS',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 16,
  correctionPct: 0.005,
  description: '16-недельная базовая программа по ПЛ (автор Муравьёв). 3 тренировки/нед: присед, жим, становая + вспомогательные. Прогрессия 0.5%/нед.',
  howItWorks: 'Муравьёв 16 нед. Троеборье, КМС-МС. Пн: жим+присед. Ср: присед на груди+становая+наклоны+жим стоя. Пт: присед+жим. Процентная пирамида 60-75% от ПМ.',
  conditions: ['КМС-МС', 'Вес от 75 кг', '3 тренировки/нед'],
  tags: ['muravyov']
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
      pct: 0.6,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.65,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.75,
      reps: 4,
      sets: 3
     }
    ]
   },
   {
    name: 'Присед',
    group: 'Ноги',
    coef: 1.2,
    mnosz: 1,
    load: 'Тяжелая',
    sets: [
     {
      pct: 0.65,
      reps: 4,
      sets: 2
     },
     {
      pct: 0.7,
      reps: 3,
      sets: 5
     }
    ]
   }
  ]
 },
 {
  exercises: [
   {
    name: 'Присед на груди',
    group: 'Ноги',
    coef: 1.2,
    mnosz: 1,
    load: 'Средняя',
    sets: [
     {
      pct: 0.6,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.65,
      reps: 4,
      sets: 2
     },
     {
      pct: 0.7,
      reps: 3,
      sets: 3
     }
    ]
   },
   {
    name: 'Становая тяга',
    group: 'Спина',
    coef: 1.4,
    mnosz: 1,
    load: 'Тяжелая',
    sets: [
     {
      pct: 0.65,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 6,
      sets: 5
     }
    ]
   },
   {
    name: 'Наклоны стоя',
    group: 'Спина',
    coef: 1,
    mnosz: 2,
    load: 'Средняя',
    sets: []
   },
   {
    name: 'Жим стоя',
    group: 'Плечи',
    coef: 1,
    mnosz: 2,
    load: 'Легкая',
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
      pct: 0.65,
      reps: 4,
      sets: 2
     },
     {
      pct: 0.7,
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
    load: 'Средняя',
    sets: [
     {
      pct: 0.6,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.65,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 5,
      sets: 2
     }
    ]
   }
  ]
 }
],
};
