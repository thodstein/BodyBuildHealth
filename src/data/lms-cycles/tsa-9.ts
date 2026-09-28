import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// TSA 9 Week Intermediate — 4д→3д, RPE, 9 недель, пик синглы
// Оригинал The Strength Athlete, 9н, RPE 7-9, 4д (1-5) →3д (6-9)

const weeks: SRDaySpec[][] = Array.from({ length: 9 }, (_, wi) => {
  const w = wi + 1;
  const pct = 0.70 + w * 0.025; // 72.5%→92.5%
  const reps = w <= 5 ? 5 : w <= 7 ? 3 : 1;
  const days = w <= 5 ? 4 : 3;
  const sched: SRDaySpec[] = [
    day(ex('Присед @RPE8', 'ПР', 1.2, [s(Math.min(0.88, pct), reps, 3)]), ex('Жим лежа @RPE8', 'ЖМ', 1.0, [s(Math.min(0.88, pct - 0.05), reps, 3)])),
    day(ex('Становая тяга @RPE8', 'ТГ', 1.4, [s(Math.min(0.88, pct), reps, 2)]), ex('Жим стоя @RPE8', 'ЖМ', 0.5, [s(Math.min(0.85, pct - 0.05), reps, 3)])),
    day(ex('Присед с паузой @RPE8', 'ПР', 1.0, [s(Math.min(0.85, pct - 0.05), reps, 3)]), ex('Жим узким хватом @RPE8', 'ЖМ', 0.8, [s(Math.min(0.85, pct - 0.05), reps, 3)])),
  ];
  if (days === 4) sched.push(day(ex('Тяга с плинтов @RPE8', 'ТГ', 0.8, [s(Math.min(0.85, pct - 0.05), reps, 2)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])));
  return sched;
});

export const TSA_9: SRCycleTemplate = {
  meta: {
    id: 'tsa-9',
    title: 'TSA 9н Intermediate (RPE)',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 9,
    correctionPct: 0,
    description: 'TSA 9н — 4д→3д, RPE 7-9, 70→92% 5п→1п, пик синглы нед 9.',
    howItWorks: 'RPE 7-9, топ-сет на RPE, затем fatigue% backoff. Нед 1-5 4д, 6-9 3д, нед 9 синглы.',
    conditions: ['КМС-МС, RPE', '4д→3д', '9 недель'],
    tags: ['tsa', 'western', 'rpe'],
  },
  week1: weeks[0],
  weeks,
};
