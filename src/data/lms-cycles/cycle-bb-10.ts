import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_10: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-10',
  title: 'Специализация: Руки + Плечи 5x/нед (ПРОФ)',
  direction: 'bodybuilding',
  level: 'KMS-MS',
  period: 'mixed',
  sessionsPerWeek: 5,
  weeks: 8,
  correctionPct: 0.005,
  targetFocus: 'arms',
  deloadWeeks: [5],
  rirProgression: { start: 3, end: 1 },
  phases: [],
  description: '8-недельный цикл специализации рук и плеч 5x/нед. Shoulders (Пн): передняя+боковая+задняя дельта 18-24 сета/нед (MRV плеч). Arms (Вт): бицепс/трицепс 20-24 сета/нед (MRV рук). Legs (Ср): ноги — поддерживающий объём (MEV). Shoulders+Arms (Чт): комбинированный день. Chest+Back (Сб): грудь+спина — поддерживающий объём. RIR 3→1 за 8 нед. Разгрузка нед 5. Предплечья включены в Arms дни.',
  howItWorks: 'Специализация: Руки+Плечи 5x/нед. Shoulders (Пн): жим стоя 4×10 + боковая дельта 4×15 + задняя дельта 4×15 + передняя дельта 3×12 + шраги 4×12. Arms (Вт): бицепс 4×12 + молотки 4×12 + трицепс 4×12 + разгибания 4×15 + предплечья 3×15. Legs (Ср): присед 4×10 + румынская 4×10 + разгибания/сгибания 3×15 + икры 4×15. Shoulders+Arms (Чт): жим гантелей 4×12 + боковая 4×15 + бицепс/трицепс 4×12 + задняя дельта 3×15. Chest+Back (Сб): жим лёжа 4×10 + тяга 4×10 + изоляция 3×15.',
  conditions: ['Для продвинутых атлетов (2+ года стажа) с отстающими руками/плечами', 'Руки 20-24 сета/нед (предел MRV). Плечи 18-24 сета/нед', 'Ноги и грудь+спина — поддерживающий объём (MEV), не расти', 'Разгрузка нед 5: -50% объёма на специализацию, RIR 4', 'Предплечья — 2 раза в неделю на Arms днях'],
  tags: ['bodybuilding']
 },
 week1: [
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
      "pct": 0.55,
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
      "pct": 0.48,
      "reps": 12,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Шраги",
    "group": "Плечи",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.35,
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
    "name": "Бицепс стоя",
    "group": "Руки",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Тяжелая",
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
    "name": "Молотковые сгибания",
    "group": "Руки",
    "coef": 0.4,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.32,
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
    "load": "Тяжелая",
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
    "name": "Сгибания запястий",
    "group": "Руки",
    "coef": 0.2,
    "mnosz": 2,
    "load": "Легкая",
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
    "name": "Присед",
    "group": "Ноги",
    "coef": 1.2,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.62,
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
      "reps": 15,
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
   }
  ]
 },
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
      "pct": 0.6,
      "reps": 10,
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
      "pct": 0.58,
      "reps": 10,
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
      "pct": 0.5,
      "reps": 12,
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
      "pct": 0.48,
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
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.22,
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
