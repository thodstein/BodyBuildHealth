import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Cube Method 10н — Brandon Lilly: 3 волны ×3н + пик 1н, ротация Heavy/Explosive/Rep
// Heavy 80→95% 2п, Explosive 60→70% 3п×8, Rep 70→85% 8п→3п, + bodybuilding day

const weeks: SRDaySpec[][] = [
  // Волна 1 (нед1-3) — 80% Heavy, 60% Explosive, 70% Rep
  [day(ex('Присед Heavy', 'ПР', 1.2, [s(0.80,2,5)]), ex('Жим лежа Rep', 'ЖМ', 1.0, [s(0.70,8,3)]), ex('Становая тяга Explosive', 'ТГ', 1.0, [s(0.60,3,8)]), ex('Бицепс на скамье', 'ЖМ', 0.3, [s(0.3,12,3)]))],
  [day(ex('Жим лежа Heavy', 'ЖМ', 1.0, [s(0.80,2,5)]), ex('Присед Rep', 'ПР', 1.0, [s(0.70,8,3)]), ex('Становая тяга Rep', 'ТГ', 1.0, [s(0.70,8,3)]))],
  [day(ex('Становая тяга Heavy', 'ТГ', 1.4, [s(0.80,2,5)]), ex('Присед Explosive', 'ПР', 1.0, [s(0.60,3,8)]), ex('Жим лежа Explosive', 'ЖМ', 1.0, [s(0.60,3,8)]))],
  // Волна 2 (нед4-6) — 85% / 65% / 80%
  [day(ex('Присед Heavy', 'ПР', 1.2, [s(0.85,2,3)]), ex('Жим Rep', 'ЖМ', 1.0, [s(0.80,6,3)]), ex('Тяга Explosive', 'ТГ', 1.0, [s(0.65,2,6)]))],
  [day(ex('Жим Heavy', 'ЖМ', 1.0, [s(0.85,2,3)]), ex('Присед Rep', 'ПР', 1.0, [s(0.80,6,3)]))],
  [day(ex('Тяга Heavy', 'ТГ', 1.4, [s(0.85,2,3)]), ex('Присед Explosive', 'ПР', 1.0, [s(0.65,2,6)]))],
  // Волна 3 (нед7-9) — 90-95% Heavy, 70% Explosive, 85% Rep
  [day(ex('Присед Heavy', 'ПР', 1.2, [s(0.90,1,2), s(0.92,1,1), s(0.95,1,1)]), ex('Жим Rep', 'ЖМ', 1.0, [s(0.85,3,3)]))],
  [day(ex('Жим Heavy', 'ЖМ', 1.0, [s(0.90,1,2), s(0.95,1,1)]), ex('Присед Rep', 'ПР', 1.0, [s(0.85,3,3)]))],
  [day(ex('Тяга Heavy', 'ТГ', 1.4, [s(0.90,1,2), s(0.95,1,1)]), ex('Жим Explosive', 'ЖМ', 1.0, [s(0.70,2,5)]))],
  // Пик (нед10) — тест
  [day(ex('Присед', 'ПР', 1.2, [s(0.90,1,2), s(0.95,1,1), s(1.0,1,1)]), ex('Жим лежа', 'ЖМ', 1.0, [s(0.90,1,2), s(0.95,1,1), s(1.0,1,1)]), ex('Становая тяга', 'ТГ', 1.4, [s(0.90,1,2), s(0.95,1,1), s(1.0,1,1)]))],
];

export const CUBE: SRCycleTemplate = {
  meta: {
    id: 'cube',
    title: 'Cube Method 10н (Brandon Lilly)',
    direction: 'powerlifting',
    level: 'intermediate',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 10,
    correctionPct: 0,
    description: 'Cube Method 10н — 3 волны ×3н + пик: Heavy 80→95% 2п, Explosive 60→70% 3п×8, Rep 70→85% 8×→3×, ротация по lifts.',
    howItWorks: 'Каждый lift/нед Heavy/Explosive/Rep ротация. Волна1 80/60/70%, Волна2 85/65/80%, Волна3 90/70/85% + тест 100% нед10. Bodybuilding день — на слабые места.',
    conditions: ['Intermediate', '4д/нед', '10 недель, ротация стилей'],
    tags: ['cube', 'western', 'wave', 'rotation'],
  },
  week1: weeks[0],
  weeks,
};
