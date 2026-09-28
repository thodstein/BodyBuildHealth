import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Hatch Squat — 12 недель, 2д/нед присед (пн/чт), волны 65-95% 10п→1п
// Оригинал Hatch, 12н, для приседа, часто с жимом

const weeks: SRDaySpec[][] = Array.from({ length: 12 }, (_, wi) => {
  const w = wi + 1;
  const pct1 = 0.60 + w * 0.025; // 62.5%→90%
  const pct2 = 0.65 + w * 0.025;
  const reps1 = w <= 4 ? 10 - w : w <= 8 ? 5 : 3 - Math.floor((w - 9) / 2);
  const reps2 = w <= 4 ? 8 - w : w <= 8 ? 4 : 2;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.85, pct1), reps1, 4)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.65,8,3)])),
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.90, pct2), reps2, 4)]), ex('Становая тяга', 'ТГ', 1.4, [s(0.70,5,3)])),
  ];
});

export const HATCH: SRCycleTemplate = {
  meta: {
    id: 'hatch',
    title: 'Hatch Squat — 12н',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'strength',
    sessionsPerWeek: 2,
    weeks: 12,
    correctionPct: 0,
    description: 'Hatch Squat 12н — 2д/нед присед, волны 65→90% 10п→1п, для приседа.',
    howItWorks: 'Пн и Чт присед, волны 65-90% с уменьшением повторов 10→1. Простая линейка, 2д/нед.',
    conditions: ['Intermediate', '2д/нед присед', '12 недель'],
    tags: ['hatch', 'western', 'squat'],
  },
  week1: weeks[0],
  weeks,
};
