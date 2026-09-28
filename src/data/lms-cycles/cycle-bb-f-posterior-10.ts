import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-bb-f-posterior-10 — женская задняя цепь (глут+хамс), 10 недель, 4×/нед.
 * P2-13 (docs/BB-FEMALE-POSTERIOR-QUALITY-PLAN.md). Стек задней цепи:
 * leg press + SLDL (тяга на прямых ногах) + hip thrust + abduction —
 * Kassiano 2024-комбо (leg press+SLDL+thrust дают больше ростка, чем
 * присед-центричные варианты).
 */
export const CYCLE_BB_F_POSTERIOR_10: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-f-posterior-10',
  title: 'Женская задняя цепь 10н (4×/нед)',
  direction: 'bodybuilding',
  level: 'II-KMS',
  period: 'mass',
  sessionsPerWeek: 4,
  weeks: 10,
  correctionPct: 0.005,
  targetFocus: 'lower',
  deloadWeeks: [5,10],
  rirProgression: { start: 3, end: 1 },
  phases: [],
  description: '10-недельный женский цикл на заднюю цепь (ягодицы + бицепс бедра), 4×/нед (2 нижних + 2 верхних). Нижние дни чередуют фокусы: A — hip thrust (тяж) + тяга на прямых ногах (SLDL) + leg press высокой постановкой; B — румынская + сгибания ног (лёжа+сидя) + гиперэкстензия. Abduction-машина 3-4 сета/нед в обе нижние. Верх — Pull-доминанта. RIR-лестница нед 1-3 rir 3, нед 4-7 rir 2, нед 8-10 rir 1. Разгрузка нед 5 и 10.',
  howItWorks: 'Задняя цепь 4×/нед, 10 нед. Пн (цепь A): hip thrust штанга + SLDL + жим ногами высокая + abduction. Вт (верх Pull): тяга блока + тяга гантели + задняя дельта + бицепс. Чт (цепь B): румынская тяга + сгибания лёжа + сгибания сидя + гиперэкстензия на ягодицы. Пт (верх-баланс): наклонный жим гантелей + тяга верхнего блока + боковая дельта + трицепс. RIR: нед 1-3 rir 3, нед 4-7 rir 2, нед 8-10 rir 1. Разгрузка нед 5 и 10.',
  conditions: ['Сплит: Пн цепь A / Вт верх Pull / Чт цепь B / Пт верх', 'Hip thrust — lead нижнего дня A (тяж, 4 сета)', 'SLDL/румынская — lead нижнего дня B (растянутая позиция бицепса бедра)', 'Сгибания в двух углах: лёжа (длинная головка) + сидя (короткая)', 'Abduction 3-4 сета/нед — обе нижние сессии', 'Спина ≥ грудь по недельному объёму', 'RIR-лестница: нед 1-3 rir 3 → нед 8-10 rir 1; разгрузка нед 5 и 10'],
  tags: ['lms', 'bodybuilding', 'female'],
 },
 week1: [
 {
  "exercises": [
   {
    "name": "Ягодичный мост со штангой",
    "group": "Ноги",
    "coef": 1.2,
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
    "name": "Тяга на прямых ногах",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.45,
      "reps": 10,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Жим ногами (высокая постановка)",
    "group": "Ноги",
    "coef": 0.8,
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
   },
   {
    "name": "Отведение бедра в тренажёре (abduction)",
    "group": "Ноги",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.3,
      "reps": 15,
      "sets": 4,
      "rir": 2
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
    "name": "Тяга гантели в наклоне",
    "group": "Спина",
    "coef": 0.7,
    "mnosz": 1,
    "load": "Тяжелая",
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
    "name": "Разведение гантелей в наклоне",
    "group": "Плечи",
    "coef": 0.25,
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
    "coef": 0.4,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.32,
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
    "name": "Тяга на прямых ногах",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Тяжелая",
    "sets": [
     {
      "pct": 0.45,
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
      "reps": 12,
      "sets": 4,
      "rir": 3
     }
    ]
   },
   {
    "name": "Сгибания ног сидя",
    "group": "Ноги",
    "coef": 0.4,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.32,
      "reps": 15,
      "sets": 3,
      "rir": 2
     }
    ]
   },
   {
    "name": "Гиперэкстензия 45° на ягодицы",
    "group": "Ноги",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.25,
      "reps": 15,
      "sets": 3,
      "rir": 2
     }
    ]
   },
   {
    "name": "Отведение бедра в тренажёре (abduction)",
    "group": "Ноги",
    "coef": 0.3,
    "mnosz": 2,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.3,
      "reps": 15,
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
    "load": "Тяжелая",
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
    "name": "Тяга верхнего блока",
    "group": "Спина",
    "coef": 0.6,
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
    "name": "Подъем гантелей в стороны",
    "group": "Плечи",
    "coef": 0.25,
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
    "name": "Разгибания с гантелью из-за головы",
    "group": "Руки",
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
   }
  ]
 }
],
};
