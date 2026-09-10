import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-bb-f-beginner-6 — женский стартовый цикл, 6 недель, 3×/нед.
 * P2-13 (docs/BB-FEMALE-POSTERIOR-QUALITY-PLAN.md). Fullbody для новичка:
 * ягодицы на каждом нижнем элементе (мост → прогрессия к hip thrust),
 * базовые жимы/тяги в одном подходовом окне, безопасное оборудование.
 */
export const CYCLE_BB_F_BEGINNER_6: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-f-beginner-6',
  title: 'Женский стартовый цикл 6н (3×/нед)',
  direction: 'bodybuilding',
  level: 'novice',
  period: 'mass',
  sessionsPerWeek: 3,
  weeks: 6,
  correctionPct: 0.005,
  targetFocus: 'lower',
  deloadWeeks: [6],
  rirProgression: { start: 4, end: 2 },
  phases: [],
  description: '6-недельный женский стартовый цикл fullbody 3×/нед. Ягодицы в каждом тренировочном дне: ягодичный мост на полу/блоке (безопасный вход → прогрессия к hip thrust со штангой с нед 4), жим ногами вместо приседа со штангой (меньше техника-риск), сгибания ног, abduction. Верх: жим гантелей на наклонной, тяга верхнего блока, боковая дельта. RIR 4→2 (учимся слушать тело, не до отказа). Разгрузка нед 6.',
  howItWorks: 'Стартовый fullbody 3×/нед, 6 нед. Пн: жим ногами + ягодичный мост + тяга верхнего блока + abduction + боковая дельта. Ср: жим гантелей на наклонной + тяга гантели + сгибания ног + пресс + трицепс. Пт: жим ногами + ягодичный мост + тяга верхнего блока + сгибания ног + abduction. RIR 4→2 (нед 1-3 rir 4, нед 4-6 rir 2). Разгрузка нед 6.',
  conditions: ['Для женщин-новичков (0-6 месяцев стажа) — пул гейтится уровнем beginner автоматически', 'Сплит: Пн (А) / Ср (Б) / Пт (А) — fullbody 3×/нед', 'Ягодицы в каждый тренировочный день (мост + abduction)', 'Жим ногами вместо приседа со штангой (безопасный вход)', 'Мост с нед 4 может прогрессировать в hip thrust со штангой', 'RIR 4→2 — не до отказа: учимся технике, а не рекордам', 'Разгрузка нед 6'],
  tags: ['lms', 'bodybuilding', 'female', 'beginner'],
 },
 week1: [
 {
  "exercises": [
   {
    "name": "Жим ногами (45°)",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.45,
      "reps": 12,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Ягодичный мост на полу",
    "group": "Ноги",
    "coef": 0.3,
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
   },
   {
    "name": "Тяга верхнего блока",
    "group": "Спина",
    "coef": 0.6,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.45,
      "reps": 12,
      "sets": 3,
      "rir": 4
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
      "rir": 3
     }
    ]
   },
   {
    "name": "Подъем гантелей в стороны",
    "group": "Плечи",
    "coef": 0.25,
    "mnosz": 2,
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.22,
      "reps": 15,
      "sets": 3,
      "rir": 4
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
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Тяга гантели в наклоне",
    "group": "Спина",
    "coef": 0.7,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.45,
      "reps": 12,
      "sets": 3,
      "rir": 4
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
    "name": "Пресс в тренажере (скручивания)",
    "group": "Пресс",
    "coef": 0.5,
    "mnosz": 2,
    "load": "Легкая",
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
    "load": "Легкая",
    "sets": [
     {
      "pct": 0.28,
      "reps": 12,
      "sets": 3,
      "rir": 4
     }
    ]
   }
  ]
 },
 {
  "exercises": [
   {
    "name": "Жим ногами (45°)",
    "group": "Ноги",
    "coef": 1,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.45,
      "reps": 12,
      "sets": 3,
      "rir": 4
     }
    ]
   },
   {
    "name": "Ягодичный мост на полу",
    "group": "Ноги",
    "coef": 0.3,
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
   },
   {
    "name": "Тяга верхнего блока",
    "group": "Спина",
    "coef": 0.6,
    "mnosz": 1,
    "load": "Средняя",
    "sets": [
     {
      "pct": 0.45,
      "reps": 12,
      "sets": 3,
      "rir": 4
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
      "rir": 3
     }
    ]
   }
  ]
 }
],
};
