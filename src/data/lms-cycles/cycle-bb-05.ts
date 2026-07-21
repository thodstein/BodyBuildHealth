import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_05: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-05',
  title: 'Начальный Full Body 3x/нед (новички)',
  direction: 'bodybuilding',
  level: 'novice',
  period: 'mixed',
  sessionsPerWeek: 3,
  weeks: 8,
  correctionPct: 0.006,
  targetFocus: 'fullbody',
  deloadWeeks: [5],
  rirProgression: { start: 4, end: 2 },
  phases: [],
  description: '8-недельный начальный Full Body 3x/нед для новичков. Каждая группа 3x/нед, 6 упражнений/сессия, 10-14 подходов. Прогрессия 0.6%/нед — максимальная (новичковая адаптация). RIR 4→2 за 8 нед. Разгрузка нед 5. Включает присед, жим, становую, армейский жим — построение базы.',
  howItWorks: 'Начальный Full Body 3x/нед (новички). 8 нед, 3 тренировки/нед. Каждая сессия: присед 4×6-10 + жим лёжа 4×6-10 + становая/румынская 3×8 + армейский жим 3×8-12 + тяга блока 3×10-12 + бицепс/трицепс 3×12. Все упражнения — база. Прогрессия 0.6%/нед. RIR 4→2 за 8 нед.',
  conditions: ['Для новичков (0-1 год стажа)', '3 тренировки/нед через день (Пн/Ср/Пт или Вт/Чт/Сб)', 'Цель — освоение техники + базовая адаптация', 'Присед, жим, становая — в каждой тренировке', 'Разгрузка нед 5: -40% объёма, те же веса', 'Вес снарядов — 50-70% от ПМ, не гнаться за весом'],
  tags: ['lms', 'bodybuilding'],
 },
 week1: [
 {
  "exercises": [
   {
    "name": "Присед",
    "group": "Ноги",
    "coef": 1.2,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.55,
      "reps": 8,
      "sets": 4,
      "rir": 4
     }
    ]
   },
   {
    "name": "Жим лежа",
    "group": "Грудь",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.52,
      "reps": 8,
      "sets": 4,
      "rir": 4
     }
    ]
   },
   {
    "name": "Тяга на прямых ногах",
    "group": "Спина",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.42,
      "reps": 10,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Жим стоя",
    "group": "Плечи",
    "coef": 0.8,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.42,
      "reps": 10,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Тяга верхнего блока",
    "group": "Спина",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.38,
      "reps": 12,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Французский жим лежа",
    "group": "Руки",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.28,
      "reps": 12,
      "sets": 3,
      "rir": 4
     }
    ]
   }
  ]
 },
 {
  "exercises": [
   {
    "name": "Присед",
    "group": "Ноги",
    "coef": 1.2,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.55,
      "reps": 8,
      "sets": 4,
      "rir": 4
     }
    ]
   },
   {
    "name": "Жим лежа",
    "group": "Грудь",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.52,
      "reps": 8,
      "sets": 4,
      "rir": 4
     }
    ]
   },
   {
    "name": "Становая тяга",
    "group": "Спина",
    "coef": 1.4,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.5,
      "reps": 6,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Жим стоя",
    "group": "Плечи",
    "coef": 0.8,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.42,
      "reps": 10,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Тяга штанги в наклоне",
    "group": "Спина",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.45,
      "reps": 10,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Бицепс стоя",
    "group": "Руки",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.32,
      "reps": 12,
      "sets": 3,
      "rir": 4
     }
    ]
   }
  ]
 },
 {
  "exercises": [
   {
    "name": "Присед",
    "group": "Ноги",
    "coef": 1.2,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.55,
      "reps": 8,
      "sets": 4,
      "rir": 4
     }
    ]
   },
   {
    "name": "Жим лежа",
    "group": "Грудь",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.52,
      "reps": 8,
      "sets": 4,
      "rir": 4
     }
    ]
   },
   {
    "name": "Тяга на прямых ногах",
    "group": "Спина",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.42,
      "reps": 10,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Жим гантелей сидя",
    "group": "Плечи",
    "coef": 0.6,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.4,
      "reps": 10,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Тяга верхнего блока",
    "group": "Спина",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.38,
      "reps": 12,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Молотковые сгибания",
    "group": "Руки",
    "coef": 0.4,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.28,
      "reps": 12,
      "sets": 3,
      "rir": 4
     }
    ]
   }
  ]
 }
],
};
