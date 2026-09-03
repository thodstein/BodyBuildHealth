import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Paul Carter Base Building — 8 недель, 4д/нед, 350 method + 5×5, для базы

const weeks: SRDaySpec[][] = Array.from({ length: 8 }, (_, wi) => {
  const w = wi + 1;
  const pct = 0.65 + w * 0.02; // 67%→81%
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.80, pct), 5, 5)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.60,10,3)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.80, pct), 5, 5)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,10,3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.80, pct), 5, 5)]), ex('Присед', 'ПР', 1.0, [s(0.60,10,3)])),
    day(ex('Жим стоя', 'ЖМ', 0.5, [s(0.60,8,3)]), ex('Тяга штанги', 'ТГ', 0.5, [s(0.5,12,3)])),
  ];
});

export const BASE_BUILDING: SRCycleTemplate = {
  meta: {
    id: 'base-building',
    title: 'Base Building 8н (Paul Carter)',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 8,
    correctionPct: 0,
    description: 'Paul Carter Base Building 8н — 4д/нед, 350 method (50п в 3 сетах) + 5×5 65→80% для базы.',
    howItWorks: 'Неделя 1-4 65-75% 5×5, неделя 5-8 75-80% 5×5 + 350 (50п). Прогрессия +2.5кг/нед.',
    conditions: ['Intermediate', '4д/нед', '8 недель'],
    tags: ['base-building', 'western', 'volume'],
  },
  week1: weeks[0],
  weeks,
};
