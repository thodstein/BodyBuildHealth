import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_06: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-06',
  title: 'PHUL 4x/нед (Power Hypertrophy Upper Lower)',
  direction: 'bodybuilding',
  level: 'II-KMS',
  period: 'mixed',
  sessionsPerWeek: 4,
  weeks: 9,
  correctionPct: 0.005,
  targetFocus: 'mixed',
  deloadWeeks: [5,9],
  rirProgression: { start: 3, end: 1 },
  phases: [],
  description: '9-недельный PHUL 4x/нед. Upper Power (85-95%, 3-5 повт, RIR 2) + Lower Power + Upper Hyp (65-80%, 8-15 повт, RIR 2-3) + Lower Hyp. Силовые дни: жим лёжа+присед 3-5 повторов, RIR 2. Гипертрофийные дни: 8-15 повторов, RIR 3→1. Боковая дельта — только в гип-дни. Разгрузка нед 5 и 9.',
  howItWorks: 'PHUL 4x/нед (Power Hypertrophy U/L). 9 нед. Upper Power (Пн): жим лёжа 4×5 + тяга штанги 4×5 + жим стоя 3×5 + подсобка 3×8. Lower Power (Вт): присед 4×5 + становая 3×5 + румынская 3×8 + икры 4×10. Upper Hyp (Чт): жим гантелей 4×10 + тяга блока 4×10 + боковая дельта 4×12 + бицепс 4×12 + трицепс 4×12 + задняя дельта 4×12. Lower Hyp (Пт): фронт-присед 4×10 + разгибания/сгибания 4×12 + ягодичный мост 3×12 + икры 4×15.',
  conditions: ['Для среднего уровня (1.5-3 года стажа)', 'Сплит: Пн Upper Power / Вт Lower Power / Чт Upper Hyp / Пт Lower Hyp', 'Силовые дни: отдых 3 мин compounds, 2 мин подсобка', 'Гипертрофийные дни: отдых 60-90с, веса 65-80%', 'Боковая дельта — только в Upper Hyp, не перегружать переднюю дельту в Power', 'Разгрузка нед 5 и 9: -50% объёма, RIR 4'],
  tags: ['lms', 'bodybuilding'],
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
      "pct": 0.72,
      "reps": 5,
      "sets": 4,
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
      "pct": 0.7,
      "reps": 5,
      "sets": 4,
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
      "pct": 0.65,
      "reps": 5,
      "sets": 3,
      "rir": 2
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
   },
   {
    "name": "Французский жим",
    "group": "Руки",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.42,
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
      "pct": 0.7,
      "reps": 5,
      "sets": 4,
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
      "pct": 0.68,
      "reps": 5,
      "sets": 3,
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
    "name": "Подъем на носки стоя",
    "group": "Ноги",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.35,
      "reps": 10,
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
      "pct": 0.52,
      "reps": 10,
      "sets": 4,
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
      "pct": 0.48,
      "reps": 10,
      "sets": 4,
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
      "pct": 0.28,
      "reps": 12,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Разведения гантелей",
    "group": "Грудь",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.25,
      "reps": 12,
      "sets": 3,
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
      "reps": 12,
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
    "name": "Тяга на прямых ногах",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.48,
      "reps": 10,
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
      "reps": 12,
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
      "pct": 0.35,
      "reps": 12,
      "sets": 3,
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
      "pct": 0.32,
      "reps": 15,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Ягодичный мост",
    "group": "Ноги",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.35,
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
