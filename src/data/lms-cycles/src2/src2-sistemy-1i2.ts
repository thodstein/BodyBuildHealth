import type { SRCycleTemplate } from '../lms-types';

export const SRC2_SISTEMY_1I2: SRCycleTemplate = {
 meta: {
  id: 'src2-sistemy-1i2',
  title: 'Системы 1 и 2 (Суровецкий, жим)',
  direction: 'bench',
  level: 'II-KMS',
  period: 'peak',
  minBodyWeight: 75,
  sessionsPerWeek: 3,
  weeks: 4,
  correctionPct: 0.02,
  description: 'Система 1+2 жима лёжа (автор Суровецкий). Система 1: 10 тренировок 30→100% ПМ (дожим). Система 2: 5 тренировок закрепления ПМ (110%). Соревновательная проходка.',
  howItWorks: 'Системы 1и2 (Суровецкий). Жим лёжа. Система 1: 10 сессий дожима от 30% до 100% ПМ. Система 2: 5 сессий закрепления на 105-110% ПМ. Прогрессия 2%/нед.',
  conditions: ['Жимовики II-КМС', '3 тренировки/нед', 'Соревновательный цикл'],
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
      pct: 0.3,
      reps: 8,
      sets: 1
     },
     {
      pct: 0.45,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.6,
      reps: 6,
      sets: 1
     },
     {
      pct: 0.7,
      reps: 5,
      sets: 1
     },
     {
      pct: 0.8,
      reps: 4,
      sets: 1
     },
     {
      pct: 0.825,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.875,
      reps: 3,
      sets: 1
     },
     {
      pct: 0.825,
      reps: 2,
      sets: 4
     },
     {
      pct: 0.8,
      reps: 2,
      sets: 2
     }
    ]
   }
  ]
 }
],
};
