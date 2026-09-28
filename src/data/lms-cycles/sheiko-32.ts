import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

const SQ = (sets: SRSetSpec[]) => ex('Присед', 'ПР', 1.2, sets);
const BP = (sets: SRSetSpec[]) => ex('Жим лежа', 'ЖМ', 1.0, sets);
const DL = (sets: SRSetSpec[]) => ex('Становая тяга', 'ТГ', 1.4, sets);

// Sheiko #32 — Peaking/Realization, низкий объём, высокая интенсивность, taper 3 недели

const weeks: SRDaySpec[][] = [
  // Неделя 1 (пик объёма перед taper)
  [
    day(SQ([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2), s(0.8,2,3), s(0.85,1,2)]), BP([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2), s(0.8,2,2)])),
    day(DL([s(0.5,3,1), s(0.6,3,1), s(0.7,3,2), s(0.8,2,2)]), BP([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2)])),
    day(SQ([s(0.5,5,1), s(0.6,4,1), s(0.7,3,2), s(0.8,2,2)]), BP([s(0.6,4,1), s(0.8,2,3)])),
  ],
  // Неделя 2 — тест (макс день)
  [
    day(SQ([s(0.5,3,1), s(0.6,3,1), s(0.7,2,2), s(0.8,1,2), s(0.9,1,1), s(1.0,1,1)]), BP([s(0.5,3,1), s(0.7,2,2), s(0.85,1,2)])),
    day(DL([s(0.6,2,2), s(0.8,1,2)]), BP([s(0.6,3,2)])),
    day(SQ([s(0.5,5,1), s(0.6,4,1)]), BP([s(0.5,5,1)])),
  ],
  // Неделя 3 — taper 1 (объём -40%)
  [
    day(SQ([s(0.5,5,1), s(0.6,4,1), s(0.75,2,2)]), BP([s(0.5,5,1), s(0.6,4,1), s(0.75,2,2)])),
    day(DL([s(0.5,3,1), s(0.6,3,1)]), BP([s(0.5,5,1)])),
  ],
  // Неделя 4 — taper 2 + соревнования (неделя соревнований — лёгкая)
  [
    day(SQ([s(0.5,3,1), s(0.6,2,2)]), BP([s(0.5,3,1), s(0.6,2,2)])),
    day(ex('Отдых', 'ОФП', 0, [s(0.1,1,1)])),
    day(SQ([s(0.6,2,1), s(0.8,1,1)]), BP([s(0.6,2,1), s(0.8,1,1)]), DL([s(0.6,2,1)])),
  ],
];

export const SHEIKO_32: SRCycleTemplate = {
  meta: {
    id: 'sheiko-32',
    title: 'Шейко #32 — пик',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'peak',
    sessionsPerWeek: 3,
    weeks: 4,
    correctionPct: 0,
    description: 'Шейко #32 — пиковый блок: тест на макс в нед 2, затем 2 недели taper (-40% объём) к соревнованиям. Завершает цикл 29-32 (16н).',
    howItWorks: 'Пик: нед 1 — последний тяжёлый, нед 2 — тест 100% (1ПМ), нед 3-4 — taper (лёгкие 50-75% 2-3п). Недельный тоннаж падает в 2 раза к соревнованиям. Только для завершения 16н цикла.',
    conditions: ['КМС-МС', 'Только после #31', '4 недели, 2-3д/нед в taper'],
    tags: ['sheiko', 'russian', 'peaking', 'taper'],
  },
  week1: weeks[0],
  weeks,
};
