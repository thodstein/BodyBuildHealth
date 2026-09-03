import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Lilliebridge Method — 8 недель, 4д/нед, присед/жим/тяга + тяжёлый сингл + backoff
// Оригинал Eric Lilliebridge, пиковый метод для пауэрлифтинга

const weeks: SRDaySpec[][] = Array.from({ length: 8 }, (_, wi) => {
  const w = wi + 1;
  const pct = 0.70 + w * 0.03; // 73%→94%
  const reps = w <= 4 ? 5 : w <= 6 ? 3 : 1;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.92, pct), reps, 3)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.60,8,3)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.92, pct), reps, 3)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.92, pct), reps, 3)]), ex('Присед', 'ПР', 1.0, [s(0.60,5,2)])),
    day(ex('Жим стоя', 'ЖМ', 0.5, [s(0.65,6,3)]), ex('Тяга штанги', 'ТГ', 0.5, [s(0.5,8,3)])),
  ];
});

export const LILLIEBRIDGE: SRCycleTemplate = {
  meta: {
    id: 'lilliebridge',
    title: 'Lilliebridge Method — 8н',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 8,
    correctionPct: 0,
    description: 'Lilliebridge Method 8н — 4д/нед, присед/жим/тяга 70→92% 5п→1п + тяжёлый сингл. Пиковый метод.',
    howItWorks: 'Линейная 70→92% 5/3/1п, каждая неделя +3% к топу. Аксессуары минимальны. Для МС.',
    conditions: ['КМС-МС', '4д/нед', '8 недель'],
    tags: ['lilliebridge', 'western', 'peaking'],
  },
  week1: weeks[0],
  weeks,
};
