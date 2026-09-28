import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_03: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-03',
  title: 'Сушка/Рельеф 5x/нед (ПРОФ)',
  direction: 'bodybuilding',
  level: 'II-MS',
  period: 'mixed',
  sessionsPerWeek: 5,
  weeks: 8,
  correctionPct: 0.003,
  targetFocus: 'mixed',
  deloadWeeks: [5],
  rirProgression: { start: 3, end: 1 },
  phases: [],
  description: '8-недельный ПРОФ-цикл сушки/рельефа 5x/нед. Upper Push / Lower Quads / Pull / Lower Posterior / Upper Metabolic. Высокоповторный режим 12-15 повторов. Metbolic день: отдых 45с, суперсеты. Прогрессия 0.3%/нед — замедленная из-за дефицита калорий. RIR 3→1 за 8 нед. Разгрузка нед 5. Включена кардио-секция в conditions.',
  howItWorks: 'Сушка/Рельеф 5x/нед (ПРОФ). Upper Push (Пн): жим гантелей 4×12 + наклонный 3×12 + боковая дельта 4×15 + трицепс 4×12 + передняя дельта 3×12. Lower Quad (Вт): фронт-присед 4×12 + жим ногами 4×15 + разгибания 4×15 + икры 4×20. Pull (Ср): тяга блока 4×12 + тяга гантели 4×12 + задняя дельта 4×15 + бицепс 4×12 + предплечья 3×15. Lower Post (Пт): румынская 4×12 + сгибания 4×15 + ягодичный мост 4×15 + икры сидя 4×20 + пресс 4×20. Upper Met (Сб): круговой режим — жим 3×15 + тяга 3×15 + боковая 3×20 + трицепс/бицепс 3×15, отдых 45с.',
  conditions: ['Для атлетов среднего уровня (2+ года стажа, период сушки)', 'Сплит: Пн Upper Push / Вт Lower Quads / Ср Pull / Пт Lower Posterior / Сб Upper Metabolic', 'Дефицит калорий 300-500 ккал, белок 2.2-2.5 г/кг', 'Metabolic день — отдых 45с, никаких тяжелых весов', 'Разгрузка нед 5: -50% объёма, RIR 4', 'LISS-кардио 3-4x/нед по 40-60 мин утром натощак'],
  tags: ['lms', 'bodybuilding'],
 },
 week1: [
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
    "name": "Разведения гантелей",
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
    "name": "Жим гантелей сидя",
    "group": "Плечи",
    "coef": 0.6,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.45,
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
    "load": "Тяжелая",
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
    "name": "Жим ногами",
    "group": "Ноги",
    "coef": 0.8,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.48,
      "reps": 15,
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
      "pct": 0.25,
      "reps": 20,
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
    "name": "Тяга гантели в наклоне",
    "group": "Спина",
    "coef": 1,
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
    "name": "Бицепс стоя",
    "group": "Руки",
    "coef": 0.5,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.35,
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
    "name": "Тяга на прямых ногах",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
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
    "name": "Сгибания ног",
    "group": "Ноги",
    "coef": 0.5,
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
    "name": "Ягодичный мост",
    "group": "Ноги",
    "coef": 0.5,
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
   },
   {
    "name": "Скручивания на пресс",
    "group": "Пресс",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.2,
      "reps": 20,
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
    "name": "Жим лежа",
    "group": "Грудь",
    "coef": 1,
    "mnosz": 1,
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.42,
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
    "load": "Легкая",
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
    "name": "Подъем гантелей в стороны",
    "group": "Плечи",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.22,
      "reps": 20,
      "sets": 3,
      "rir": 3
     }
    ]
   },
   {
    "name": "Французский жим лежа",
    "group": "Руки",
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
   },
   {
    "name": "Молотковые сгибания",
    "group": "Руки",
    "coef": 0.4,
    "mnosz": 2,
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.28,
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
