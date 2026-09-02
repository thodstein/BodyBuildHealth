import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Calgary 8 — укороченная версия 16 (снапшот), 4д/нед, 8 недель, RPE

const weeks: SRDaySpec[][] = Array.from({ length: 8 }, (_, wi) => {
  const w = wi + 1;
  const pct = 0.68 + w * 0.03; // 71%→92%
  const reps = w <= 4 ? 5 : w <= 6 ? 3 : 1;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.85, pct), reps, 3)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.85, pct), reps, 3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.85, pct), reps, 3)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.80, pct - 0.05), reps, 3)])),
    day(ex('Присед на ящик', 'ПР', 1.0, [s(0.60,4,3)]), ex('Жим узким хватом', 'ЖМ', 0.8, [s(0.65,6,3)])),
    day(ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)]), ex('Жим стоя', 'ЖМ', 0.5, [s(0.6,6,3)])),
  ];
});

export const CALGARY_8: SRCycleTemplate = {
  meta: {
    id: 'calgary-8',
    title: 'Calgary 8н (укороченный)',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'peak',
    sessionsPerWeek: 4,
    weeks: 8,
    correctionPct: 0,
    description: 'Calgary 8н — снапшот 16н, 4д/нед, 68→92% 5п→1п + RPE. Быстрый пик.',
    howItWorks: 'Линейная 68→92% 5/3/1п, RPE синглы @8 в конце. Для подготовки за 8 недель.',
    conditions: ['KMS-МС', '4д/нед', '8 недель, RPE'],
    tags: ['calgary', 'western', 'rpe'],
  },
  week1: weeks[0],
  weeks,
};
