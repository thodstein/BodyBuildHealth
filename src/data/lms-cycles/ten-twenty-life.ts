import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// 10/20/Life — Brian Carroll, 3 фазы: Offseason 10п, Strength 5п, Peaking 1-2п, 4д/нед
// Упрощённая 12н версия: 6н Offseason 60-75% 8-10п → 4н Strength 75-85% 5п → 2н Peaking 85-92% 1-2п

const weeks: SRDaySpec[][] = Array.from({ length: 12 }, (_, wi) => {
  const w = wi + 1;
  const phase = w <= 6 ? 'off' : w <= 10 ? 'strength' : 'peak';
  const pct = phase === 'off' ? 0.60 + w * 0.015 : phase === 'strength' ? 0.75 + (w - 7) * 0.02 : 0.85 + (w - 11) * 0.03;
  const reps = phase === 'off' ? 10 : phase === 'strength' ? 5 : 2;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.90, pct), reps, 3)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.60,8,3)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.90, pct), reps, 3)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.90, pct), reps, 3)]), ex('Присед', 'ПР', 1.0, [s(0.60,5,2)])),
    day(ex('Жим стоя', 'ЖМ', 0.5, [s(0.60,6,3)]), ex('Тяга штанги', 'ТГ', 0.5, [s(0.5,8,3)])),
  ];
});

export const TEN_TWENTY_LIFE: SRCycleTemplate = {
  meta: {
    id: 'ten-twenty-life',
    title: '10/20/Life 12н (Brian Carroll)',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 12,
    correctionPct: 0,
    description: '10/20/Life 12н — 6н Offseason 60-75% 10п → 4н Strength 75-85% 5п → 2н Peaking 85-92% 2п. Для КМС-МС.',
    howItWorks: 'Offseason объём 10п, Strength 5п, Peaking 2п 85-92% с RPE. Прогрессия +2.5кг/нед.',
    conditions: ['КМС-МС', '4д/нед', '12 недель'],
    tags: ['10-20-life', 'western', 'offseason'],
  },
  week1: weeks[0],
  weeks,
};
