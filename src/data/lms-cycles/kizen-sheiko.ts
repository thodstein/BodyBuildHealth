import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Kizen Sheiko Intermediate — 12 недель, 4д/нед, modern Sheiko (Kizen Training)
// 3 фазы: Accumulation 70-80% 5п, Transmutation 75-85% 3п, Peaking 80-90% 2п + тест

const weeks: SRDaySpec[][] = Array.from({ length: 12 }, (_, wi) => {
  const w = wi + 1;
  const phase = w <= 4 ? 'acc' : w <= 8 ? 'trans' : 'peak';
  const pct = phase === 'acc' ? 0.70 + w * 0.015 : phase === 'trans' ? 0.78 + (w - 5) * 0.015 : 0.82 + (w - 9) * 0.02;
  const reps = phase === 'acc' ? 5 : phase === 'trans' ? 3 : 2;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.85, pct), reps, 4)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.85, pct - 0.05), reps, 4)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.85, pct), reps, 3)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.80, pct - 0.05), reps, 3)])),
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.80, pct - 0.05), reps, 3)]), ex('Жим стоя', 'ЖМ', 0.5, [s(0.60,6,3)])),
    day(ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.85, pct), reps, 4)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
  ];
});

export const KIZEN_SHEIKO: SRCycleTemplate = {
  meta: {
    id: 'kizen-sheiko',
    title: 'Kizen Sheiko Intermediate 12н',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 12,
    correctionPct: 0,
    description: 'Kizen Sheiko Intermediate 12н — 4д/нед, Accumulation 70-80% 5п → Transmutation 75-85% 3п → Peaking 80-90% 2п + тест.',
    howItWorks: 'Modern Sheiko (Kizen): 12н, 4д, волны 70→90% с back-off. Сред.инт. 75%, тоннаж 10т/нед. Для KMS-MS.',
    conditions: ['КМС-МС', '4д/нед', '12 недель'],
    tags: ['sheiko', 'kizen', 'western', 'intermediate'],
  },
  week1: weeks[0],
  weeks,
};
