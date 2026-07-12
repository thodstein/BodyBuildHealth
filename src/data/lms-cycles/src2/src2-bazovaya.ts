import type { SRCycleTemplate } from '../lms-types';

export const SRC2_BAZOVAYA: SRCycleTemplate = {
 meta: {
  id: 'src2-bazovaya',
  title: 'Базовая (Суровецкий)',
  direction: 'powerlifting',
  level: 'novice',
  period: 'strength',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 4,
  correctionPct: 0.01,
  description: 'Базовая программа (автор Суровецкий). Для начинающих троеборцев. 12 тренировок с постепенным ростом нагрузки 60-85% ПМ. Прогрессия 1%/нед.',
  howItWorks: 'Базовая (Суровецкий). Новички. 12 тренировок/4 нед. Плавный рост нагрузки 60-85% ПМ. 3 тренировки/нед.',
  conditions: ['Новички', '3 тренировки/нед', 'Базовый уровень'],
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
      reps: 5,
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
      pct: 0.65,
      reps: 5,
      sets: 3
     }
    ]
   }
  ]
 }
],
};
