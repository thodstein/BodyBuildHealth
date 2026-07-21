import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_02: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-02',
  title: 'Массонабор Push/Pull/Legs + Upper Pump 4x/нед (ПРОФ)',
  direction: 'bodybuilding',
  level: 'II-MS',
  period: 'mass',
  sessionsPerWeek: 4,
  weeks: 12,
  correctionPct: 0.006,
  targetFocus: 'push',
  deloadWeeks: [5,10],
  rirProgression: { start: 3, end: 0 },
  phases: [],
  description: '12-недельный ПРОФ-цикл PPL + Upper Pump 4x/нед. Push: грудь+передняя дельта+трицепс+боковая дельта (тяжёлый режим 6-8 повт). Pull: спина+бицепс+задняя дельта. Legs: ноги+икры. Upper Pump: пампинг-протокол 12-15 повт с минимальным отдыхом 45с. RIR-лестница: нед 1-3 rir 3, нед 4-6 rir 2, нед 7-9 rir 1-0, нед 10-12 rir 0. Разгрузка нед 5 и 10. Прогрессия 0.6%/нед — ускоренная для массонабора.',
  howItWorks: 'Массонабор PPL+Upper Pump 4x/нед (ПРОФ). 3 силовые сессии (Push/Pull/Legs) + 1 пампинг (Upper Pump). Push (Пн): жим лёжа 4×8 + наклонный 3×10 + жим стоя 3×8 + боковая дельта 4×12 + трицепс 4×10. Pull (Ср): становая 4×6 + тяга штанги 4×8 + верхняя тяга 3×10 + задняя дельта 3×12 + бицепс 4×10. Legs (Пт): присед 4×8 + фронт-присед 3×10 + румынская 4×10 + разгибания/сгибания 3×12 + икры 4×15. Upper Pump (Сб): жим гантелей 4×12, кроссоверы 3×15, тяга блока 4×12, боковая дельта 4×15, руки 3×15 — отдых 45с, цель памп.',
  conditions: ['Для атлетов среднего уровня (2+ года стажа)', 'Сплит: Пн Push / Ср Pull / Пт Legs / Сб Upper Pump', 'Становая тяга — только на Pull, 1 раз в 4 дня, достаточное восстановление', 'Upper Pump — отдых строго 45с, никаких тяжёлых весов', 'Боковая дельта — обязательное упражнение на Push и Upper Pump', 'Разгрузка нед 5 и 10: -40% объёма, RIR 4'],
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
      "pct": 0.65,
      "reps": 8,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Жим на наклонной",
    "group": "Грудь",
    "coef": 0.8,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.55,
      "reps": 10,
      "sets": 3,
      "rir": 3
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
      "pct": 0.52,
      "reps": 8,
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
      "pct": 0.28,
      "reps": 12,
      "sets": 4,
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
      "pct": 0.4,
      "reps": 10,
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
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.3,
      "reps": 12,
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
    "name": "Становая тяга",
    "group": "Спина",
    "coef": 1.4,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.65,
      "reps": 6,
      "sets": 4,
      "rir": 3
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
      "pct": 0.6,
      "reps": 8,
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
      "pct": 0.52,
      "reps": 10,
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
      "pct": 0.28,
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
      "pct": 0.4,
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
    "name": "Присед",
    "group": "Ноги",
    "coef": 1.2,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.62,
      "reps": 8,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Присед на груди",
    "group": "Ноги",
    "coef": 1.2,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.52,
      "reps": 10,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Тяга на прямых ногах",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
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
    "name": "Разгибания ног",
    "group": "Ноги",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.38,
      "reps": 12,
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
      "pct": 0.28,
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
      "pct": 0.48,
      "reps": 12,
      "sets": 4,
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
    "name": "Тяга верхнего блока",
    "group": "Спина",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.42,
      "reps": 12,
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
      "pct": 0.25,
      "reps": 15,
      "sets": 4,
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
   }
  ]
 }
],
};
