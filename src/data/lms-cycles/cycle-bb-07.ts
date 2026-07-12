import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_07: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-07',
  title: 'PHAT 5x/нед (Power Hypertrophy Adaptive Training)',
  direction: 'bodybuilding',
  level: 'KMS-MS',
  period: 'mixed',
  sessionsPerWeek: 5,
  weeks: 10,
  correctionPct: 0.004,
  targetFocus: 'mixed',
  deloadWeeks: [5,10],
  rirProgression: { start: 2, end: 0 },
  phases: [],
  description: '10-недельный PHAT (Layne Norton) 5x/нед. 2 силовых дня (3-5 повт, 85-95%, RIR 2) + 3 гипертрофийных (8-15 повт, 65-80%, RIR 3→0). Силовая база: жим 3×5, присед 3×5, становая 2×5. Гипертрофия: спина+плечи, ноги+пресс, грудь+руки. Разгрузка нед 5 и 10. Классическая программа Лейна Нортона для натурального бодибилдинга.',
  howItWorks: 'PHAT 5x/нед (Power Hypertrophy Adaptive Training). 10 нед. Upper Power (Пн): жим лёжа 3×5 + тяга штанги 3×5 + жим стоя 2×5 + подсобка 3×8-15. Lower Power (Вт): присед 3×5 + становая 2×5 + румынская 3×8 + разгибания/сгибания 3×10. Back+Shoulders Hyp (Чт): тяги 4×8-12 + жим гантелей 3×10 + боковая+задняя дельта 3×15 + бицепс 4×12. Legs+Abs Hyp (Пт): фронт-присед 4×10 + разгибания/сгибания 4×15 + икры 4×15 + пресс 4×15. Chest+Arms Hyp (Сб): жимы 4×8-12 + изоляция груди 3×15 + трицепс/бицепс 4×12-15.',
  conditions: ['Для продвинутых атлетов (2+ года стажа)', 'Сплит: Пн Upper Power / Вт Lower Power / Чт Back+Shoulders Hyp / Пт Legs+Abs Hyp / Сб Chest+Arms Hyp', 'Силовые дни (3-5 повт): отдых 3-5 мин compounds, RIR 2 на первой неделе', 'Гип-дни (8-15 повт): отдых 60-90с, дроп-сеты на последних подходах с нед 4', 'Становая — только на Lower Power, 1 раз в 5 дней', 'Разгрузка нед 5 и 10: -50% объёма, RIR 4, без дроп-сетов', 'Программа Лейна Нортона — адаптирована под натуралов'],
  tags: ['bodybuilding']
 },
 week1: [
 {
  "exercises": [
   {
    "name": "Жим лежа",
    "group": "Грудь",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.75,
      "reps": 5,
      "sets": 3,
      "rir": 2
     }
    ]
   },
   {
    "name": "Тяга штанги в наклоне",
    "group": "Спина",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.72,
      "reps": 5,
      "sets": 3,
      "rir": 2
     }
    ]
   },
   {
    "name": "Жим стоя",
    "group": "Плечи",
    "coef": 0.8,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.68,
      "reps": 5,
      "sets": 2,
      "rir": 2
     }
    ]
   },
   {
    "name": "Подъем гантелей в стороны",
    "group": "Плечи",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.25,
      "reps": 15,
      "sets": 3,
      "rir": 3
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
      "pct": 0.52,
      "reps": 8,
      "sets": 3,
      "rir": 3
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
      "pct": 0.72,
      "reps": 5,
      "sets": 3,
      "rir": 2
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
      "pct": 0.7,
      "reps": 5,
      "sets": 2,
      "rir": 2
     }
    ]
   },
   {
    "name": "Тяга на прямых ногах",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.52,
      "reps": 8,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Разгибания ног",
    "group": "Ноги",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.38,
      "reps": 10,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Сгибания ног",
    "group": "Ноги",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.35,
      "reps": 10,
      "sets": 3,
      "rir": 3
     }
    ]
   }
  ]
 },
 {
  "exercises": [
   {
    "name": "Тяга верхнего блока",
    "group": "Спина",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.52,
      "reps": 10,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Тяга гантели в наклоне",
    "group": "Спина",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.55,
      "reps": 10,
      "sets": 4,
      "rir": 3
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
      "pct": 0.5,
      "reps": 10,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Подъем гантелей в стороны",
    "group": "Плечи",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.25,
      "reps": 15,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Разведение гантелей в наклоне",
    "group": "Плечи",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.22,
      "reps": 15,
      "sets": 3,
      "rir": 3
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
      "pct": 0.4,
      "reps": 12,
      "sets": 4,
      "rir": 3
     }
    ]
   }
  ]
 },
 {
  "exercises": [
   {
    "name": "Фронт-присед",
    "group": "Ноги",
    "coef": 1.2,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.55,
      "reps": 10,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Разгибания ног",
    "group": "Ноги",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.38,
      "reps": 15,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Сгибания ног",
    "group": "Ноги",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.32,
      "reps": 15,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Подъем на носки стоя",
    "group": "Ноги",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.28,
      "reps": 15,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Скручивания на пресс",
    "group": "Пресс",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.22,
      "reps": 15,
      "sets": 4,
      "rir": 3
     }
    ]
   }
  ]
 },
 {
  "exercises": [
   {
    "name": "Жим гантелей на наклонной",
    "group": "Грудь",
    "coef": 0.8,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.55,
      "reps": 10,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Жим лежа",
    "group": "Грудь",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.52,
      "reps": 12,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Кроссовер",
    "group": "Грудь",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.25,
      "reps": 15,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Французский жим",
    "group": "Руки",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.38,
      "reps": 12,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Разгибания на блоке",
    "group": "Руки",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.3,
      "reps": 15,
      "sets": 3,
      "rir": 3
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
      "pct": 0.32,
      "reps": 15,
      "sets": 3,
      "rir": 3
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
      "pct": 0.38,
      "reps": 12,
      "sets": 3,
      "rir": 3
     }
    ]
   }
  ]
 }
],
};
