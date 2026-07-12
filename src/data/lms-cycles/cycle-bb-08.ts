import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_08: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-08',
  title: 'Arnold Split 6x/нед (ПРОФ)',
  direction: 'bodybuilding',
  level: 'KMS-MS',
  period: 'mass',
  sessionsPerWeek: 6,
  weeks: 9,
  correctionPct: 0.004,
  targetFocus: 'mixed',
  deloadWeeks: [5,9],
  rirProgression: { start: 3, end: 0 },
  phases: [],
  description: '9-недельный Arnold Split 6x/нед. Chest+Back / Shoulders+Arms / Legs ×2 с антагонистическими суперсетами. Первый проход — тяжёлый (6-8 повт, RIR 3→0), второй Shoulders+Arms — памп (12-15, RIR 3→1). Суперсеты жим+тяга грудь/спина. Разгрузка нед 5 и 9. RIR-лестница: 3→0 за 9 нед.',
  howItWorks: 'Arnold Split 6x/нед (ПРОФ). 9 нед. Chest+Back Heavy (Пн): жим лёжа+тяга суперсет 4×6-8 + наклонный+тяга блока 3×8-10 + боковая дельта 4×12. Shoulders+Arms Heavy (Вт): жим стоя 4×6-8 + бицепс/трицепс 4×8 + боковая/задняя дельта 4×12 + предплечья 3×12. Legs Heavy (Ср): присед 4×6-8 + фронт 3×8 + румынская 4×8 + разгибания/сгибания 4×10 + икры 4×12. Повтор: Chest+Back Pump (Чт), Shoulders+Arms Pump (Пт), Legs Pump (Сб).',
  conditions: ['Для продвинутых атлетов (2+ года стажа)', '6 тренировок/нед, суперсеты жим+тяга грудь/спина', 'Пн/Чт: Chest+Back. Вт/Пт: Shoulders+Arms. Ср/Сб: Legs', 'Heavy проход (Пн-Ср): отдых 90-120с база, 60с изоляция', 'Pump проход (Чт-Сб): отдых 45-60с, суперсеты без пауз', 'Разгрузка нед 5 и 9: -50% объёма, без суперсетов'],
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
      "pct": 0.65,
      "reps": 8,
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
      "pct": 0.62,
      "reps": 8,
      "sets": 4,
      "rir": 3
     }
    ]
   },
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
      "pct": 0.28,
      "reps": 12,
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
      "pct": 0.32,
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
    "name": "Жим стоя",
    "group": "Плечи",
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
    "name": "Бицепс стоя",
    "group": "Руки",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Тяжелая",
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
    "name": "Французский жим",
    "group": "Руки",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Тяжелая",
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
    "name": "Разведение гантелей в наклоне",
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
    "name": "Сгибания запястий",
    "group": "Руки",
    "coef": 0.2,
    "mnosz": 2,
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.2,
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
    "name": "Присед",
    "group": "Ноги",
    "coef": 1.2,
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
      "pct": 0.5,
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
      "pct": 0.28,
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
      "pct": 0.48,
      "reps": 12,
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
      "pct": 0.22,
      "reps": 15,
      "sets": 3,
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
      "pct": 0.48,
      "reps": 12,
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
   }
  ]
 },
 {
  "exercises": [
   {
    "name": "Жим гантелей сидя",
    "group": "Плечи",
    "coef": 0.6,
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
    "name": "Бицепс стоя",
    "group": "Руки",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.35,
      "reps": 15,
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
      "pct": 0.28,
      "reps": 15,
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
      "pct": 0.22,
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
      "pct": 0.2,
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
    "name": "Фронт-присед",
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
    "name": "Тяга на прямых ногах",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.42,
      "reps": 12,
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
      "pct": 0.32,
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
      "pct": 0.3,
      "reps": 15,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Подъем на носки сидя",
    "group": "Ноги",
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
   }
  ]
 }
],
};
