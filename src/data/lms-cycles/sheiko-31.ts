import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

const SQ = (sets: SRSetSpec[]) => ex('Присед', 'ПР', 1.2, sets);
const BP = (sets: SRSetSpec[]) => ex('Жим лежа', 'ЖМ', 1.0, sets);
const DL = (sets: SRSetSpec[]) => ex('Становая тяга', 'ТГ', 1.4, sets);

// Sheiko #31 — Transmutation, объём ↓, интенсивность ↑ 80-90%

const weeks: SRDaySpec[][] = [
  [
    day(SQ([s(0.55,5,1), s(0.65,4,1), s(0.75,3,2), s(0.85,2,3), s(0.90,1,2)]), BP([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2), s(0.8,2,4)])),
    day(DL([s(0.6,3,2), s(0.7,3,2), s(0.8,2,3), s(0.85,1,3)]), BP([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2), s(0.85,2,2)])),
    day(SQ([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2), s(0.85,2,3)]), BP([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2), s(0.8,2,5)])),
  ],
  [
    day(SQ([s(0.6,4,1), s(0.7,3,2), s(0.8,2,3), s(0.85,1,3)]), BP([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2), s(0.85,2,3)])),
    day(DL([s(0.65,3,2), s(0.75,3,2), s(0.85,2,3)]), BP([s(0.6,4,1), s(0.7,3,2), s(0.85,2,3)])),
    day(SQ([s(0.5,5,1), s(0.6,4,1), s(0.8,2,4)]), BP([s(0.5,5,1), s(0.6,4,1), s(0.8,2,4)])),
  ],
  [
    day(SQ([s(0.6,3,2), s(0.8,2,4), s(0.85,1,3)]), BP([s(0.6,4,1), s(0.75,3,2), s(0.85,2,3)])),
    day(DL([s(0.7,3,2), s(0.8,2,3), s(0.9,1,2)]), BP([s(0.5,5,1), s(0.7,3,2), s(0.8,2,3)])),
    day(SQ([s(0.6,4,1), s(0.8,2,4)]), BP([s(0.6,4,1), s(0.8,2,4)])),
  ],
  [
    day(SQ([s(0.65,3,2), s(0.85,1,3)]), BP([s(0.65,3,2), s(0.85,1,3)])),
    day(DL([s(0.7,2,3), s(0.85,1,3)]), BP([s(0.6,3,2), s(0.8,2,3)])),
    day(SQ([s(0.6,3,2), s(0.8,2,3)]), BP([s(0.6,3,2), s(0.8,2,3)])),
  ],
];

export const SHEIKO_31: SRCycleTemplate = {
  meta: {
    id: 'sheiko-31',
    title: 'Шейко #31 — трансмутация',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'strength',
    sessionsPerWeek: 3,
    weeks: 4,
    correctionPct: 0,
    description: 'Шейко #31 — интенсивность растёт до 85-90%, объём падает. Переход от накопления к пику.',
    howItWorks: 'Трансмутация: объём ↓30% к #30, интенсивность 80-90% (частые 85%+ синглы). Техника под тяжёлым весом. Подводит к пиковому #32.',
    conditions: ['КМС-МС', '3д/нед', 'После #30'],
    tags: ['sheiko', 'russian', 'transmutation'],
  },
  week1: weeks[0],
  weeks,
};
