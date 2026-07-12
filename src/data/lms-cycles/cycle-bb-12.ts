import type { SRCycleTemplate } from './lms-types';

export const CYCLE_BB_12: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-12',
  title: 'Pre-Contest Peak 4x/нед (Соревновательный пик)',
  direction: 'bodybuilding',
  level: 'KMS-MSMK',
  period: 'mixed',
  sessionsPerWeek: 4,
  weeks: 4,
  correctionPct: 0.003,
  targetFocus: 'contest',
  deloadWeeks: [4],
  rirProgression: { start: 3, end: 1 },
  phases: [
 {
  weekStart: 1,
  weekEnd: 2,
  title: 'Втягивание',
  correctionPct: 0.005,
  rirProgression: {
   start: 3,
   end: 2
  },
  repRange: [
   10,
   12
  ]
 },
 {
  weekStart: 3,
  weekEnd: 3,
  title: 'Загрузка',
  correctionPct: 0,
  rirProgression: {
   start: 2,
   end: 1
  },
  repRange: [
   8,
   10
  ]
 },
 {
  weekStart: 4,
  weekEnd: 4,
  title: 'Пик/Пампинг',
  correctionPct: 0,
  rirProgression: {
   start: 1,
   end: 0
  },
  repRange: [
   15,
   25
  ]
 }
],
  description: '4-недельный пиковый блок перед соревнованиями PPL + Full Body Pump. Фаза 1 (нед 1-2): втягивание — PPL с RIR 3→2, объём 14-16 подходов. Фаза 2 (нед 3): углеводная загрузка + умеренный объём. Фаза 3 (нед 4): пампинг-протокол — 3×20-25, дроп-сеты, RIR 0. Белок 2.5-3 г/кг.',
  howItWorks: 'Pre-Contest Peak 4x/нед. Фаза 1 (1-2 нед): Push/Pull/Legs, 4×/нед, 8-10 повт, RIR 3→2. Фаза 2 (3 нед): загрузка — PPL, умеренный объём, +углеводы. Фаза 3 (4 нед): Full Body Pump — 3×20-25 повт, дроп-сеты, отдых 30-45с, вода/натрий. Пик формы.',
  conditions: ['Только для соревнующихся атлетов (КМС+)', 'Фаза 1 (1-2 нед): PPL, 14-16 подходов/сессия', 'Фаза 2 (3 нед): углеводная загрузка 4-6 г/кг', 'Фаза 3 (4 нед): пампинг 3×20-25, отдых 30-45с, манипуляция водой/натрием', 'Разгрузка нед 4: -50% объёма, RIR 4'],
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
      "pct": 0.48,
      "reps": 12,
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
      "pct": 0.35,
      "reps": 12,
      "sets": 3,
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
    "load": "Тяжелая",
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
      "pct": 0.35,
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
      "pct": 0.3,
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
      "pct": 0.58,
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
      "pct": 0.35,
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
      "pct": 0.32,
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
      "pct": 0.25,
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
    "name": "Жим лежа",
    "group": "Грудь",
    "coef": 1,
    "mnosz": 1,
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.4,
      "reps": 20,
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
      "pct": 0.35,
      "reps": 20,
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
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.28,
      "reps": 25,
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
      "pct": 0.18,
      "reps": 25,
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
      "pct": 0.2,
      "reps": 20,
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
      "pct": 0.22,
      "reps": 20,
      "sets": 3,
      "rir": 3
     }
    ]
   }
  ]
 }
],
};
