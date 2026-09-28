import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-bb-f-glute-2d-6 — женские ягодицы для новичков, 6 недель, 3×/нед.
 * Ф4 (docs/CYCLE-SYSTEM-FULL-AUDIT-PLAN.md). Простой старт: 2 глут-дня + 1
 * fullbody-верх, минимум оборудования (гантели/тренажёр), техника thrust
 * осваивается с лёгких весов. RIR 4→3 (новичок не у отказа), делод W6.
 */

const s = (pct: number, reps: number, sets: number, rir: number) => ({ pct, reps, sets, rir });
const ex = (name: string, group: string, coef: number, load: string, sets: ReturnType<typeof s>[]) => ({ name, group, coef, mnosz: 1, load, sets });
const day = (...exercises: ReturnType<typeof ex>[]) => ({ exercises });

export const CYCLE_BB_F_GLUTE_2D_6: SRCycleTemplate = {
  meta: {
    id: 'cycle-bb-f-glute-2d-6',
    title: 'Женские ягодицы для новичков 6н (3×/нед)',
    direction: 'bodybuilding',
    level: 'novice',
    period: 'mass',
    sessionsPerWeek: 3,
    weeks: 6,
    correctionPct: 0.005,
    targetFocus: 'lower',
    deloadWeeks: [6],
    rirProgression: { start: 4, end: 3 },
    phases: [],
    description: '6-недельный женский цикл ягодиц для новичков 3×/нед: 2 глут-дня + 1 верхний. Техника hip thrust осваивается с лёгких весов (55%×12), abduction/кикбэк — 2 сета с запасом, никаких отказов: RIR 4→3. Верх — один тяговый и один жимовой день на сохранение пропорций. Делод W6.',
    howItWorks: 'Пн (глут): hip thrust 3×12 + жим ногами широкая + abduction + кикбэк. Ср (верх): тяга блока + жим гантелей наклонная + пресс. Пт (глут): hip thrust 3×10 + румынская лёгкая + abduction. RIR 4 (нед 1-2) → 3 (3-5). Делод W6. После цикла — glute-12 (базовый).',
    conditions: ['Новичок (техника hip thrust осваивается с 55%)', '3×/нед: Пн/Пт глут, Ср верх', 'Никаких отказов: RIR не ниже 3', 'Минимум оборудования: штанга/гантели/тренажёры', 'Делод W6; следующий шаг — cycle-bb-f-glute-12'],
    tags: ['lms', 'bodybuilding', 'female', 'glutes', 'novice'],
  },
  week1: [
    day(
      ex('Ягодичный мост со штангой', 'Ноги', 1.2, 'Тяжелая', [s(0.55, 12, 3, 4)]),
      ex('Жим ногами (широкая постановка)', 'Ноги', 1, 'Тяжелая', [s(0.5, 12, 2, 4)]),
      ex('Отведение бедра в тренажёре (abduction)', 'Ноги', 0.3, 'Средняя', [s(0.3, 15, 2, 3)]),
      ex('Отведение ноги назад в блоке (кикбэк)', 'Ноги', 0.25, 'Средняя', [s(0.25, 12, 2, 3)]),
    ),
    day(
      ex('Тяга верхнего блока', 'Спина', 0.8, 'Тяжелая', [s(0.5, 12, 3, 4)]),
      ex('Жим гантелей на наклонной', 'Грудь', 0.8, 'Средняя', [s(0.45, 12, 3, 4)]),
      ex('Пресс в тренажере (скручивания)', 'Пресс', 0.5, 'Легкая', [s(0.25, 15, 2, 3)]),
    ),
    day(
      ex('Ягодичный мост со штангой', 'Ноги', 1.2, 'Тяжелая', [s(0.5, 10, 3, 4)]),
      ex('Тяга на прямых ногах', 'Ноги', 1, 'Средняя', [s(0.4, 12, 2, 4)]),
      ex('Отведение бедра в тренажёре (abduction)', 'Ноги', 0.3, 'Средняя', [s(0.3, 15, 2, 3)]),
    ),
  ],
};
