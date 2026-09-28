import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Wendler 5/3/1 BBB — 4 недели, TM 90%, 5/3/1 + BBB 5×10 50% (+ FSL вариант)

const weeks: SRDaySpec[][] = [
  [
    day(ex('Присед', 'ПР', 1.2, [s(0.65,5,1), s(0.75,5,1), s(0.85,5,1)]), ex('Присед BBB', 'ПР', 1.0, [s(0.50,10,5)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(0.65,5,1), s(0.75,5,1), s(0.85,5,1)]), ex('Жим лежа BBB', 'ЖМ', 0.8, [s(0.50,10,5)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(0.65,5,1), s(0.75,5,1), s(0.85,5,1)]), ex('Становая BBB', 'ТГ', 1.0, [s(0.50,10,5)])),
    day(ex('Жим стоя', 'ЖМ', 0.5, [s(0.65,5,1), s(0.75,5,1), s(0.85,5,1)]), ex('Жим стоя BBB', 'ЖМ', 0.5, [s(0.50,10,5)])),
  ],
  [
    day(ex('Присед', 'ПР', 1.2, [s(0.70,3,1), s(0.80,3,1), s(0.90,3,1)]), ex('Присед BBB', 'ПР', 1.0, [s(0.55,10,5)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(0.70,3,1), s(0.80,3,1), s(0.90,3,1)]), ex('Жим BBB', 'ЖМ', 0.8, [s(0.55,10,5)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(0.70,3,1), s(0.80,3,1), s(0.90,3,1)]), ex('Становая BBB', 'ТГ', 1.0, [s(0.55,10,5)])),
    day(ex('Жим стоя', 'ЖМ', 0.5, [s(0.70,3,1), s(0.80,3,1), s(0.90,3,1)]), ex('Жим BBB', 'ЖМ', 0.5, [s(0.55,10,5)])),
  ],
  [
    day(ex('Присед', 'ПР', 1.2, [s(0.75,5,1), s(0.85,3,1), s(0.95,1,1)]), ex('Присед BBB', 'ПР', 1.0, [s(0.60,10,5)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(0.75,5,1), s(0.85,3,1), s(0.95,1,1)]), ex('Жим BBB', 'ЖМ', 0.8, [s(0.60,10,5)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(0.75,5,1), s(0.85,3,1), s(0.95,1,1)]), ex('Становая BBB', 'ТГ', 1.0, [s(0.60,10,5)])),
    day(ex('Жим стоя', 'ЖМ', 0.5, [s(0.75,5,1), s(0.85,3,1), s(0.95,1,1)]), ex('Жим BBB', 'ЖМ', 0.5, [s(0.60,10,5)])),
  ],
  [
    day(ex('Присед', 'ПР', 1.2, [s(0.40,5,1), s(0.50,5,1), s(0.60,5,1)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(0.40,5,1), s(0.50,5,1), s(0.60,5,1)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(0.40,5,1), s(0.50,5,1), s(0.60,5,1)])),
  ],
];

export const WENDLER_BBB: SRCycleTemplate = {
  meta: {
    id: 'wendler-bbb',
    title: 'Wendler 5/3/1 BBB — 4н',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 4,
    correctionPct: 0,
    description: 'Wendler BBB — 4н, TM 90%, 5/3/1 + BBB 5×10 50-60% + FSL. Вечный цикл +2.5кг.',
    howItWorks: 'TM 90% от 1ПМ. Нед1 65/75/85% 5/5/5+, нед2 70/80/90% 3/3/3+, нед3 75/85/95% 5/3/1+, нед4 deload. После 5/3/1 — BBB 5×10 50-60% того же движения. Прогрессия +2.5кг/цикл к TM.',
    conditions: ['Intermediate', 'TM 90%', '4д/нед'],
    tags: ['wendler', '531', 'bbb', 'western'],
  },
  week1: weeks[0],
  weeks,
};
