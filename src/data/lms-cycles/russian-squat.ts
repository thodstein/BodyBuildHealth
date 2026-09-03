import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Russian Squat Routine — 6 недель, 3×/нед присед, 80%→105% 6×2→1×1, для приседа
// Оригинал Russian Squat Routine (6н)

const weeks: SRDaySpec[][] = [
  [day(ex('Присед', 'ПР', 1.2, [s(0.80,6,6)]), ex('Жим лежа лёгкий', 'ЖМ', 1.0, [s(0.60,6,3)]))],
  [day(ex('Присед', 'ПР', 1.2, [s(0.80,6,6)]), ex('Жим лежа лёгкий', 'ЖМ', 1.0, [s(0.60,6,3)]))],
  [day(ex('Присед', 'ПР', 1.2, [s(0.85,5,5)]), ex('Жим лежа лёгкий', 'ЖМ', 1.0, [s(0.60,6,3)]))],
  [day(ex('Присед', 'ПР', 1.2, [s(0.90,3,4)]), ex('Жим лежа лёгкий', 'ЖМ', 1.0, [s(0.65,5,3)]))],
  [day(ex('Присед', 'ПР', 1.2, [s(0.95,2,4)]), ex('Жим лежа лёгкий', 'ЖМ', 1.0, [s(0.65,5,3)]))],
  [day(ex('Присед', 'ПР', 1.2, [s(1.00,1,3), s(1.05,1,1)]), ex('Тест: проходка до макс', 'ПР', 1.2, [s(1.0,1,1)]))],
];

export const RUSSIAN_SQUAT: SRCycleTemplate = {
  meta: {
    id: 'russian-squat',
    title: 'Russian Squat Routine — 6н',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'peak',
    sessionsPerWeek: 3,
    weeks: 6,
    correctionPct: 0,
    description: 'Russian Squat Routine 6н — 3×/нед присед 80→105% 6×6→1×1. Классика для приседа.',
    howItWorks: '6 недель, 3 тренировки приседа/нед, 80% 6×6 → 85% 5×5 → 90% 3×4 → 95% 2×4 → 100% 1×3 + тест 105%. Жим лёгкий для поддержания.',
    conditions: ['Intermediate', '3д/нед присед', '6 недель'],
    tags: ['russian-squat', 'russian', 'squat'],
  },
  week1: weeks[0],
  weeks,
};
