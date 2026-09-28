import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// RTS Generalized Intermediate 9н — Mike Tuchscherer, 4д→3д, reps@RPE + fatigue%
// Упрощённая: топ-сеты переводятся в % (RPE 8 ≈ 82%, RPE 9 ≈ 87%), fatigue drop 5-7%

const weeks: SRDaySpec[][] = Array.from({ length: 9 }, (_, wi) => {
  const w = wi + 1;
  const rpePct = w <= 5 ? 0.78 + w * 0.015 : 0.85 + (w - 6) * 0.025; // 80%→92%
  const reps = w <= 5 ? 5 : w <= 7 ? 3 : 1;
  const days = w <= 5 ? 4 : 3;
  const sched: SRDaySpec[] = [
    day(ex('Присед @RPE8', 'ПР', 1.2, [s(rpePct, reps, 3)]), ex('Жим лежа @RPE8', 'ЖМ', 1.0, [s(rpePct - 0.05, reps, 3)])),
    day(ex('Становая тяга @RPE8', 'ТГ', 1.4, [s(rpePct, reps, 2)]), ex('Жим стоя @RPE8', 'ЖМ', 0.5, [s(rpePct - 0.10, reps, 3)])),
    day(ex('Присед с паузой @RPE8', 'ПР', 1.0, [s(rpePct - 0.05, reps, 3)]), ex('Жим узким хватом @RPE8', 'ЖМ', 0.8, [s(rpePct - 0.05, reps, 3)])),
  ];
  if (days === 4) sched.push(day(ex('Тяга с плинтов @RPE8', 'ТГ', 0.8, [s(rpePct - 0.05, reps, 2)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])));
  return sched;
});

export const RTS_9: SRCycleTemplate = {
  meta: {
    id: 'rts-9',
    title: 'RTS 9н — Generalized Intermediate (Tuchscherer)',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 9,
    correctionPct: 0,
    description: 'RTS 9н — 4д→3д, reps@RPE + fatigue% backoff. Каждая сессия — топ-сет на RPE, затем drop% и сеты до RPE. Нед 9 — синглы.',
    howItWorks: 'RPE-авторегуляция: топ-сет на заданные повторы и RPE, затем fatigue% (5-7%) → backoff сеты до RPE. Нагрузку подбирает авторегуляция, а не фикс %. Требует умения оценивать RPE.',
    conditions: ['КМС-МС, умеет RPE', '4д→3д', '9 недель, fatigue%'],
    tags: ['rts', 'western', 'rpe', 'autoreg'],
  },
  week1: weeks[0],
  weeks,
};
