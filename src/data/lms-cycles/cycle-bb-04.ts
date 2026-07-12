import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_04: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-04',
  title: 'PPL Heavy+Pump 6x/нед (ПРОФ, продвинутый)',
  direction: 'bodybuilding',
  level: 'KMS-MSMK',
  period: 'mass',
  sessionsPerWeek: 6,
  weeks: 8,
  correctionPct: 0.004,
  targetFocus: 'push',
  deloadWeeks: [5],
  rirProgression: { start: 3, end: 0 },
  phases: [],
  description: '8-недельный ПРОФ-цикл PPL 2x/нед Heavy+Pump для продвинутых. Тяжёлые дни (Heavy): механическое напряжение 6-8 повторов, RIR 3→0. Пампинг-дни (Pump): метаболический стресс 12-15 повторов, RIR 3→1. Боковая дельта — на оба Push дня, задняя дельта — на Pull Pump, икры — на оба Legs дня. Разгрузка нед 5. 6 тренировок/нед — элитный объём, требуется профицит и 8-10 ч сна.',
  howItWorks: 'PPL Heavy+Pump 6x/нед (ПРОФ, продвинутый). 8 нед, 6 тренировок/нед. Push Heavy (Пн): жим лёжа 4×6 + наклонный 4×8 + жим стоя 3×6 + боковая дельта 3×12 + трицепс 4×8. Pull Heavy (Вт): становая 4×6 + тяга гантели 4×8 + верхняя тяга 3×8 + бицепс 4×8 + наклоны 3×8. Legs Heavy (Ср): присед 4×6 + фронт 3×8 + румынская 4×8 + разгибания 3×10 + икры 4×12. Push Pump (Чт): жим гантелей 4×12 + кроссоверы 3×15 + боковая дельта 4×15 + трицепс 4×15. Pull Pump (Пт): верхняя тяга 4×15 + тяга гантели 4×15 + задняя дельта 3×15 + молотки 4×15 + пресс 3×20. Legs Pump (Сб): присед 4×12 + разгибания 4×15 + румынская 3×12 + сгибания 3×15 + икры 4×15.',
  conditions: ['ТОЛЬКО для продвинутых атлетов (КМС+) с 3+ года стажа', '6 тренировок/нед — экстремальный объём. Требуется 8-10 ч сна, профицит', 'Heavy дни: отдых 2-3 мин база, 1.5 мин изоляция. Pump дни: 45-60с', 'Каждые 4 недели — разгрузка (-50% объёма, RIR 4)', 'Боковая дельта — в каждый Push день, обязательное упражнение', 'Задняя дельта — только на Pull Pump, на Pull Heavy заменена рядовым'],
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
      "pct": 0.68,
      "reps": 6,
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
      "pct": 0.58,
      "reps": 8,
      "sets": 4,
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
      "pct": 0.55,
      "reps": 6,
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
      "reps": 12,
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
    "name": "Тяга гантели в наклоне",
    "group": "Спина",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.58,
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
    "name": "Бицепс стоя",
    "group": "Руки",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.42,
      "reps": 8,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Наклоны стоя",
    "group": "Спина",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.35,
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
      "pct": 0.65,
      "reps": 6,
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
      "pct": 0.55,
      "reps": 8,
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
      "reps": 8,
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
      "reps": 10,
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
      "pct": 0.25,
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
    "name": "Жим гантелей на наклонной",
    "group": "Грудь",
    "coef": 0.8,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.45,
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
    "name": "Подъем гантелей в стороны",
    "group": "Плечи",
    "coef": 0.3,
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
   },
   {
    "name": "Разгибания с гантелью из-за головы",
    "group": "Руки",
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
    "name": "Французский жим лежа",
    "group": "Руки",
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
      "pct": 0.4,
      "reps": 15,
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
      "pct": 0.42,
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
    "name": "Молотковые сгибания",
    "group": "Руки",
    "coef": 0.4,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.3,
      "reps": 15,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Пресс в тренажере (скручивания)",
    "group": "Пресс",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.2,
      "reps": 20,
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
    "name": "Разгибания ног",
    "group": "Ноги",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.3,
      "reps": 15,
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
      "pct": 0.3,
      "reps": 15,
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
      "pct": 0.22,
      "reps": 15,
      "sets": 4,
      "rir": 3
     }
    ]
   }
  ]
 }
],
};
