import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Texas Method — 3д/нед, недельный цикл: Пн Volume 5×5, Ср Recovery 2×5@80%, Пт Intensity 1×5 PR
// Оригинал Mark Rippetoe / Glenn Pendlay, для intermediate после Starting Strength

const weeks: SRDaySpec[][] = [
  [
    day(ex('Присед', 'ПР', 1.2, [s(0.75,5,5)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.75,5,5)]), ex('Тяга штанги в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Присед', 'ПР', 1.2, [s(0.60,5,2)]), ex('Жим стоя', 'ЖМ', 0.5, [s(0.60,5,3)]), ex('Подтягивания', 'ТГ', 0.5, [s(0.3,8,3)]), ex('Гиперэкстензия', 'ТГ', 0.3, [s(0.3,10,2)])),
    day(ex('Присед', 'ПР', 1.2, [s(0.85,5,1)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.85,5,1)]), ex('Становая тяга', 'ТГ', 1.4, [s(0.85,5,1)])),
  ],
  [
    day(ex('Присед', 'ПР', 1.2, [s(0.77,5,5)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.77,5,5)])),
    day(ex('Присед', 'ПР', 1.2, [s(0.62,5,2)]), ex('Жим стоя', 'ЖМ', 0.5, [s(0.62,5,3)])),
    day(ex('Присед', 'ПР', 1.2, [s(0.87,5,1)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.87,5,1)]), ex('Становая тяга', 'ТГ', 1.4, [s(0.87,5,1)])),
  ],
  [
    day(ex('Присед', 'ПР', 1.2, [s(0.79,5,5)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.79,5,5)])),
    day(ex('Присед', 'ПР', 1.2, [s(0.64,5,2)]), ex('Жим стоя', 'ЖМ', 0.5, [s(0.64,5,3)])),
    day(ex('Присед', 'ПР', 1.2, [s(0.89,5,1)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.89,5,1)]), ex('Становая тяга', 'ТГ', 1.4, [s(0.89,5,1)])),
  ],
  [
    day(ex('Присед', 'ПР', 1.2, [s(0.81,5,5)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.81,5,5)])),
    day(ex('Присед', 'ПР', 1.2, [s(0.66,5,2)]), ex('Жим стоя', 'ЖМ', 0.5, [s(0.66,5,3)])),
    day(ex('Присед', 'ПР', 1.2, [s(0.91,5,1)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.91,5,1)]), ex('Становая тяга', 'ТГ', 1.4, [s(0.91,5,1)])),
  ],
];

export const TEXAS_METHOD: SRCycleTemplate = {
  meta: {
    id: 'texas-method',
    title: 'Texas Method — 4 недели',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'strength',
    sessionsPerWeek: 3,
    weeks: 4,
    correctionPct: 0,
    description: 'Texas Method (Rippetoe/Pendlay) — 3д/нед, недельный цикл: Пн Volume 5×5, Ср Recovery 2×5@80%, Пт Intensity 1×5 PR. Еженедельно +2.5кг к пятнице.',
    howItWorks: 'Пн — объёмный стресс 5×5 75-81%, Ср — восстановление 80% от Пн, Пт — интенсивность 1×5 PR 85-91%. Прогрессия еженедельно +2.5кг. Требует сна/питания как работа. После плато — переход на Madcow/5/3/1.',
    conditions: ['Intermediate после Starting Strength', '3д/нед', 'Восстановление приоритет'],
    tags: ['texas', 'western', 'weekly-progression'],
  },
  week1: weeks[0],
  weeks,
};
