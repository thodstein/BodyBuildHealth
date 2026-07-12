import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_09: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-09',
  title: 'Торс/Конечности 4x/нед (Специализация)',
  direction: 'bodybuilding',
  level: 'II-KMS',
  period: 'mixed',
  sessionsPerWeek: 4,
  weeks: 8,
  correctionPct: 0.005,
  targetFocus: 'mixed',
  deloadWeeks: [5,8],
  rirProgression: { start: 3, end: 1 },
  phases: [],
  description: '8-недельный Торс/Конечности 4x/нед. Torso Heavy (6-8 повт) + Limbs Heavy + Torso Pump (12-15 повт) + Limbs Pump. Слабые группы получают +10% объёма. Прогрессия 0.5%/нед. RIR 3→1 за 8 нед. Разгрузка нед 5 и 8.',
  howItWorks: 'Торс/Конечности 4x/нед. Torso Heavy (Пн): жим лёжа 4×8 + тяга штанги 4×8 + жим стоя 4×8 + наклонный жим 3×10 + боковая дельта 4×12. Limbs Heavy (Вт): присед 4×8 + румынская 4×8 + бицепс/трицепс 4×10 + икры 4×12 + предплечья 3×12. Torso Pump (Чт): жим гантелей 4×12 + тяги 4×12 + дельты 4×15 + грудь изоляция 3×15. Limbs Pump (Пт): ноги 4×12-15 + руки 4×15 + икры 4×20.',
  conditions: ['Для атлетов среднего уровня (1.5+ года стажа)', 'Torso дни: грудь+спина+плечи. Limbs дни: ноги+руки+икры', 'Heavy проход: отдых 90-120с база. Pump проход: 60с', 'Слабые группы определяются пользователем — +10% объёма', 'Разгрузка нед 5 и 8: -40% объёма, RIR 4'],
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
      "pct": 0.62,
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
      "pct": 0.6,
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
    "name": "Тяга верхнего блока",
    "group": "Спина",
    "coef": 0.5,
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
    "name": "Бицепс стоя",
    "group": "Руки",
    "coef": 0.5,
    "mnosz": 1,
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
    "name": "Французский жим",
    "group": "Руки",
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
    "name": "Шраги",
    "group": "Плечи",
    "coef": 0.3,
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
      "pct": 0.52,
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
      "pct": 0.35,
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
    "name": "Подъем на носки сидя",
    "group": "Ноги",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.22,
      "reps": 20,
      "sets": 4,
      "rir": 3
     }
    ]
   }
  ]
 }
],
};
