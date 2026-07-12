import type { SRCycleTemplate } from '../lms-types';

export const SRC2_SOLOVYOV_BENCH_28: SRCycleTemplate = {
 meta: {
  id: 'src2-solovyov-bench-28',
  title: 'Соловьёв жим 28 дн',
  direction: 'bench',
  level: 'MS-MSMK',
  period: 'peak',
  minBodyWeight: 75,
  sessionsPerWeek: 4,
  weeks: 4,
  correctionPct: 0.015,
  description: '28-дневная программа специализации жима лёжа (автор Соловьёв). 4 тренировки в 2-нед микроцикле: средняя (4-6 пвт), тяжёлая (2-3 пвт), лёгкая (6-20 пвт), спина+бицепс. Двойная волновая периодизация, прогрессия 1.5%/нед.',
  howItWorks: 'Соловьёв жим 28 дн. Специализация жима. Двойной микроцикл 14 дн: средняя(4-6 пвт 55-82%), тяжёлая(75-90% 2-3 пвт), лёгкая(30-55% 6-20 пвт), спина+бицепс. Прогрессия 1.5%/нед. 28 дн.',
  conditions: ['Опытные жимовики (МС+)', 'Только жим лёжа', '4 тренировки/14 дн'],
  tags: ['solovyov']
 },
 week1: [
 {
  exercises: [
   {
    name: 'Жим лежа средний',
    group: 'Жим',
    coef: 1,
    mnosz: 1,
    load: 'Средняя',
    sets: [
     {
      pct: 0.5,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.67,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 4,
      sets: 2
     },
     {
      pct: 0.725,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.65,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.4,
      reps: 8,
      sets: 1
     }
    ]
   },
   {
    name: 'Спина+бицепс',
    group: 'Спина',
    coef: 0.5,
    mnosz: 2,
    load: 'Легкая',
    sets: []
   }
  ]
 },
 {
  exercises: [
   {
    name: 'Жим лежа средний',
    group: 'Жим',
    coef: 1,
    mnosz: 1,
    load: 'Средняя',
    sets: [
     {
      pct: 0.5,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.67,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.75,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.775,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.8,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.67,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.47,
      reps: 8,
      sets: 1
     }
    ]
   },
   {
    name: 'Трицепс',
    group: 'Руки',
    coef: 0.3,
    mnosz: 2,
    load: 'Легкая',
    sets: []
   }
  ]
 },
 {
  exercises: [
   {
    name: 'Жим лежа легкий',
    group: 'Жим',
    coef: 0.7,
    mnosz: 1,
    load: 'Легкая',
    sets: [
     {
      pct: 0.45,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.47,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.32,
      reps: 20,
      sets: 1
     },
     {
      pct: 0.35,
      reps: 20,
      sets: 1
     }
    ]
   },
   {
    name: 'Плечи легкие',
    group: 'Плечи',
    coef: 0.3,
    mnosz: 2,
    load: 'Легкая',
    sets: []
   }
  ]
 },
 {
  exercises: [
   {
    name: 'Жим лежа тяжелый',
    group: 'Жим',
    coef: 1.2,
    mnosz: 1,
    load: 'Тяжелая',
    sets: [
     {
      pct: 0.8,
      reps: 2,
      sets: 1
     },
     {
      pct: 0.82,
      reps: 2,
      sets: 1
     },
     {
      pct: 0.85,
      reps: 2,
      sets: 1
     },
     {
      pct: 0.87,
      reps: 2,
      sets: 1
     },
     {
      pct: 0.9,
      reps: 2,
      sets: 1
     },
     {
      pct: 0.75,
      reps: 6,
      sets: 1
     }
    ]
   },
   {
    name: 'Спина',
    group: 'Спина',
    coef: 0.4,
    mnosz: 2,
    load: 'Легкая',
    sets: []
   }
  ]
 }
],
};
