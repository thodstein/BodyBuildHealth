import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// PHUL — 12н, 4д/нед: Power Upper/Lower + Hypertrophy Upper/Lower
// Оригинал Brandon Campbell, 2 power дня 3-5п 80-85%, 2 hypertrophy 8-12п 65-75%

const weeks: SRDaySpec[][] = Array.from({ length: 12 }, (_, wi) => {
  const w = wi + 1;
  const powerPct = 0.78 + w * 0.01; // 79%→90%
  const hyperPct = 0.65 + w * 0.008;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.88, powerPct), 5, 4)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.88, powerPct), 5, 4)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.88, powerPct), 5, 4)]), ex('Присед', 'ПР', 1.2, [s(Math.min(0.85, hyperPct), 8, 3)]), ex('Тяга штанги', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.75, hyperPct), 10, 3)]), ex('Жим гантелей', 'ЖМ', 0.6, [s(0.5,12,3)]), ex('Выпады', 'ПР', 0.5, [s(0.4,10,3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.85, powerPct - 0.05), 5, 3)]), ex('Жим стоя', 'ЖМ', 0.5, [s(0.60,10,3)]), ex('Тяга с плинтов', 'ТГ', 0.8, [s(0.65,8,3)])),
  ];
});

export const PHUL: SRCycleTemplate = {
  meta: {
    id: 'phul',
    title: 'PHUL 12н (Power/Hypertrophy)',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'mixed',
    sessionsPerWeek: 4,
    weeks: 12,
    correctionPct: 0,
    description: 'PHUL 12н — 4д/нед: Power Upper/Lower 80-88% 5п + Hypertrophy 65-75% 10п. Для intermediate.',
    howItWorks: '2 power дня 5×5 80-88%, 2 hypertrophy 3×10 65-75%. Прогрессия +2.5кг/нед.',
    conditions: ['Intermediate', '4д/нед', '12 недель'],
    tags: ['phul', 'western', 'power-hypertrophy'],
  },
  week1: weeks[0],
  weeks,
};
