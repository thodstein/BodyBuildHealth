import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// PHAT — Layne Norton, 5д/нед: 2 Power + 3 Hypertrophy, 12н
// Power 3-5п 80-85%, Hypertrophy 8-12п 65-75%

const weeks: SRDaySpec[][] = Array.from({ length: 12 }, (_, wi) => {
  const w = wi + 1;
  const powerPct = 0.78 + w * 0.01;
  const hyperPct = 0.65 + w * 0.008;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.85, powerPct), 5, 3)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.85, powerPct), 5, 3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.85, powerPct), 3, 3)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.75, hyperPct), 8, 3)]), ex('Жим гантелей', 'ЖМ', 0.6, [s(0.5,12,3)]), ex('Разводка', 'ЖМ', 0.4, [s(0.3,12,3)])),
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.75, hyperPct), 10, 3)]), ex('Выпады', 'ПР', 0.5, [s(0.4,10,3)]), ex('Подъем на носки', 'ПР', 0.3, [s(0.3,15,3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.75, hyperPct), 8, 3)]), ex('Тяга с плинтов', 'ТГ', 0.8, [s(0.65,8,3)]), ex('Бицепс', 'ЖМ', 0.3, [s(0.3,12,3)])),
  ];
});

export const PHAT: SRCycleTemplate = {
  meta: {
    id: 'phat',
    title: 'PHAT 12н (Layne Norton)',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'mixed',
    sessionsPerWeek: 5,
    weeks: 12,
    correctionPct: 0,
    description: 'PHAT 12н — 5д/нед: 2 Power 80-85% 5п + 3 Hypertrophy 65-75% 10п. Для intermediate.',
    howItWorks: 'Power дни 3-5п 80-85%, Hypertrophy 8-12п 65-75%. Прогрессия +2.5кг/нед.',
    conditions: ['Intermediate', '5д/нед', '12 недель'],
    tags: ['phat', 'western', 'power-hypertrophy'],
  },
  week1: weeks[0],
  weeks,
};
