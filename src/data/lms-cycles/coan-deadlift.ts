import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Coan Deadlift 10н — Эд Коан, 1×/нед тяга + круговые (тяга/присед/тяга с плинтов)
// Оригинал 10 weeks, прогрессия 5кг/нед, пиковый сингл

const weeks: SRDaySpec[][] = Array.from({ length: 10 }, (_, wi) => {
  const w = wi + 1;
  const pct = 0.65 + w * 0.03; // 68%→95%
  const reps = w <= 4 ? 5 : w <= 7 ? 3 : 1;
  return [
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.92, pct), reps, 2), s(Math.min(0.90, pct - 0.05), reps, 2)]), ex('Тяга с плинтов', 'ТГ', 0.8, [s(0.70,5,2)]), ex('Тяга штанги в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Присед лёгкий', 'ПР', 1.0, [s(0.60,5,2)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.65,6,3)])),
  ];
});

export const COAN_DEADLIFT: SRCycleTemplate = {
  meta: {
    id: 'coan-deadlift',
    title: 'Coan Deadlift 10н (Ed Coan)',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'peak',
    sessionsPerWeek: 2,
    weeks: 10,
    correctionPct: 0,
    description: 'Coan Deadlift 10н — 1×/нед тяга 65→92% 5п→1п + круговые (плинты/наклон). Пик 95% сингл.',
    howItWorks: 'Тяга 1×/нед, прогрессия +15кг/нед к топу, 2×2 90% в пике. Присед лёгкий для поддержания. Для тяговой специализации.',
    conditions: ['КМС-МС', '2д/нед тяга', '10 недель'],
    tags: ['coan', 'western', 'deadlift'],
  },
  week1: weeks[0],
  weeks,
};
