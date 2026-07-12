import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_11: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-11',
  title: 'Powerbuilding 4x/нед (Сила + Масса)',
  direction: 'bodybuilding',
  level: 'KMS-MS',
  period: 'mixed',
  sessionsPerWeek: 4,
  weeks: 12,
  correctionPct: 0.005,
  targetFocus: 'upper',
  deloadWeeks: [5,9],
  rirProgression: { start: 2, end: 0 },
  phases: [
 {
  weekStart: 1,
  weekEnd: 6,
  title: 'Силовой блок',
  correctionPct: 0.007,
  rirProgression: {
   start: 2,
   end: 1
  },
  repRange: [
   3,
   5
  ]
 },
 {
  weekStart: 7,
  weekEnd: 12,
  title: 'Гипертрофийный блок',
  correctionPct: 0.004,
  rirProgression: {
   start: 3,
   end: 0
  },
  repRange: [
   8,
   12
  ]
 }
],
  description: '12-недельный Powerbuilding 4x/нед с макропериодизацией. Фаза 1 (нед 1-6): силовой блок — 3-5 повт, 85-95%, RIR 2→1, отдых 3 мин. Фаза 2 (нед 7-12): гипертрофийный блок — 8-12 повт, 65-80%, RIR 3→0, отдых 90с. Upper/Lower сплит. Разгрузка нед 5 и 9. Дроп-сеты и техники интенсификации — только в фазе 2.',
  howItWorks: 'Powerbuilding 4x/нед. Фаза 1 (1-6 нед, сила): жим лёжа 4×5 + тяга 4×5 + присед 4×5 + становая 3×5. Жим стоя 3×5. RIR 2→1. Прогрессия 0.7%/нед. Фаза 2 (7-12 нед, гипертрофия): жим гантелей 4×10 + тяги 4×10 + присед 3×10 + разгибания/сгибания 4×12 + икры/пресс 4×15 + дельты/руки 4×12-15. RIR 3→0. Прогрессия 0.4%/нед. Upper/Lower A/B сплит.',
  conditions: ['Для продвинутых атлетов (2+ года стажа)', 'Фаза 1 (нед 1-6 — сила): 3-5 повт, 85-95%, отдых 3 мин, RIR 2→1', 'Фаза 2 (нед 7-12 — гипертрофия): 8-12 повт, 65-80%, отдых 90с, RIR 3→0', 'Переход: опустить вес на 20% в начале фазы 2', 'Разгрузка нед 5 и 9: -50% объёма, RIR 4', 'Силовая фаза: без дроп-сетов. Гипертрофия: дроп-сеты на финише'],
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
      "pct": 0.72,
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
      "pct": 0.68,
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
      "rir": 2
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
      "rir": 2
     }
    ]
   },
   {
    "name": "Подъем штанги на бицепс",
    "group": "Руки",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.4,
      "reps": 8,
      "sets": 3,
      "rir": 2
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
      "pct": 0.7,
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
      "rir": 2
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
      "reps": 8,
      "sets": 4,
      "rir": 2
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
      "pct": 0.28,
      "reps": 12,
      "sets": 3,
      "rir": 2
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
    "name": "Тяга гантели в наклоне",
    "group": "Спина",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.5,
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
      "pct": 0.28,
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
      "pct": 0.25,
      "reps": 12,
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
      "pct": 0.35,
      "reps": 10,
      "sets": 3,
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
    "name": "Присед",
    "group": "Ноги",
    "coef": 1.2,
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
      "pct": 0.3,
      "reps": 12,
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
      "pct": 0.25,
      "reps": 15,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Подъем на носки сидя",
    "group": "Ноги",
    "coef": 0.5,
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
 }
],
};
