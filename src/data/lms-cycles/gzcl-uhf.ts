import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// GZCL UHF 9н — 5д/нед, UHF (Ultra High Frequency), T1 85-92% 1-3п, T2 70-80% 6-8п, T3 12-15п
// Оригинал Cody LeFever UHF 9 weeks, 5 days

const weeks: SRDaySpec[][] = Array.from({ length: 9 }, (_, wi) => {
  const w = wi + 1;
  const t1Pct = 0.85 + w * 0.008; // 85.8%→92%
  const t2Pct = 0.70 + w * 0.01;
  return [
    day(ex('Присед T1', 'ПР', 1.2, [s(Math.min(0.92, t1Pct), 3 - Math.floor(w/3), 4)]), ex('Жим лежа T2', 'ЖМ', 1.0, [s(t2Pct, 6, 4)]), ex('Тяга в наклоне T3', 'ТГ', 0.5, [s(0.5,12,3)])),
    day(ex('Жим лежа T1', 'ЖМ', 1.0, [s(Math.min(0.92, t1Pct), 3 - Math.floor(w/3), 4)]), ex('Присед T2', 'ПР', 1.0, [s(t2Pct, 6, 4)]), ex('Подтягивания T3', 'ТГ', 0.5, [s(0.3,12,3)])),
    day(ex('Становая тяга T1', 'ТГ', 1.4, [s(Math.min(0.92, t1Pct), 3 - Math.floor(w/3), 3)]), ex('Жим стоя T2', 'ЖМ', 0.5, [s(t2Pct, 6, 3)]), ex('Гиперэкстензия T3', 'ТГ', 0.3, [s(0.3,12,3)])),
    day(ex('Присед T2', 'ПР', 1.0, [s(t2Pct, 8, 3)]), ex('Жим лежа T2', 'ЖМ', 1.0, [s(t2Pct, 8, 3)]), ex('Тяга с плинтов T3', 'ТГ', 0.5, [s(0.5,12,3)])),
    day(ex('Жим стоя T1', 'ЖМ', 0.5, [s(Math.min(0.90, t1Pct - 0.02), 3, 3)]), ex('Тяга в наклоне T2', 'ТГ', 0.5, [s(t2Pct, 8, 3)]), ex('Бицепс T3', 'ЖМ', 0.3, [s(0.3,15,3)])),
  ];
});

export const GZCL_UHF: SRCycleTemplate = {
  meta: {
    id: 'gzcl-uhf',
    title: 'GZCL UHF 9н — 5д/нед',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'strength',
    sessionsPerWeek: 5,
    weeks: 9,
    correctionPct: 0,
    description: 'GZCL UHF 9н — 5д/нед, T1 85-92% 3-1п, T2 70-80% 6-8п, T3 12-15п. Ultra High Frequency для КМС-МС.',
    howItWorks: 'UHF: каждый lift 2×/нед (T1 тяжёлый + T2 объём). Прогрессия +2.5кг/нед к T1. T3 на слабые места. Самый частый GZCL.',
    conditions: ['КМС-МС', '5д/нед', '9 недель, T1/T2/T3'],
    tags: ['gzcl', 'uhf', 'western', 'high-frequency'],
  },
  week1: weeks[0],
  weeks,
};
