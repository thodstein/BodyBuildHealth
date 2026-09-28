import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Barbell Medicine The Bridge — 8 недель, RPE, 4д/нед, для перехода после Starting Strength
// Оригинал 8н, RPE 6-9, 5п→1п

const weeks: SRDaySpec[][] = Array.from({ length: 8 }, (_, wi) => {
  const w = wi + 1;
  const pct = 0.68 + w * 0.025; // 70.5%→88%
  const reps = w <= 4 ? 5 : w <= 6 ? 3 : 1;
  return [
    day(ex('Присед @RPE8', 'ПР', 1.2, [s(Math.min(0.85, pct), reps, 3)]), ex('Жим лежа @RPE8', 'ЖМ', 1.0, [s(Math.min(0.85, pct - 0.05), reps, 3)])),
    day(ex('Становая тяга @RPE8', 'ТГ', 1.4, [s(Math.min(0.85, pct), reps, 2)]), ex('Жим стоя @RPE8', 'ЖМ', 0.5, [s(Math.min(0.82, pct - 0.05), reps, 3)])),
    day(ex('Присед с паузой @RPE7', 'ПР', 1.0, [s(Math.min(0.80, pct - 0.05), reps, 3)]), ex('Жим лежа с паузой @RPE8', 'ЖМ', 1.0, [s(Math.min(0.82, pct - 0.05), reps, 3)])),
    day(ex('Тяга с плинтов @RPE8', 'ТГ', 0.8, [s(Math.min(0.82, pct - 0.05), reps, 2)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
  ];
});

export const BRIDGE: SRCycleTemplate = {
  meta: {
    id: 'bridge',
    title: 'The Bridge 8н (Barbell Medicine)',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 8,
    correctionPct: 0,
    description: 'The Bridge 8н — RPE 6-9, 68→88% 5п→1п, 4д/нед, мост после Starting Strength.',
    howItWorks: 'RPE 6-9, 8 недель, 5п→3п→1п, 4д. Учит RPE после линейки.',
    conditions: ['Intermediate после SS', '4д/нед', 'RPE'],
    tags: ['bridge', 'barbell-medicine', 'rpe'],
  },
  week1: weeks[0],
  weeks,
};
