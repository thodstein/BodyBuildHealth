import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Calgary Barbell 16н — 4 фазы по Bryce Krawczyk: Accumulation 64-71% 5-7п → Intensity 76-82% top+backoff → Competition 78-81% + RPE → Taper 62-72% + синглы @8
// Упрощённая оригинальная раскладка (4д/нед, присед 3×, жим 4×, тяга 3×)

const weeks: SRDaySpec[][] = Array.from({ length: 16 }, (_, wi) => {
  const w = wi + 1;
  let phase: string;
  let sqPct: number, benchPct: number, dlPct: number;
  if (w <= 4) { phase = 'acc'; sqPct = 0.64 + (w - 1) * 0.023; benchPct = sqPct; dlPct = sqPct; }
  else if (w <= 8) { phase = 'int'; sqPct = 0.76 + (w - 5) * 0.02; benchPct = sqPct; dlPct = sqPct; }
  else if (w <= 11) { phase = 'comp'; sqPct = 0.78 + (w - 9) * 0.015; benchPct = sqPct; dlPct = sqPct; }
  else { phase = 'taper'; sqPct = 0.62 + (w - 12) * 0.025; benchPct = sqPct; dlPct = sqPct; }
  const reps = w <= 4 ? 7 - w : w <= 8 ? 3 : w <= 11 ? 4 : w <= 15 ? 2 : 1;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(sqPct, reps, 4)]), ex('Жим лежа', 'ЖМ', 1.0, [s(benchPct, reps, 4)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(dlPct, reps, 3)]), ex('Жим лежа', 'ЖМ', 1.0, [s(benchPct, reps, 4)]), ex('Присед', 'ПР', 1.0, [s(0.60,5,2)])),
    day(ex('Присед на ящик', 'ПР', 1.0, [s(0.60,4,3)]), ex('Жим лежа узким хватом', 'ЖМ', 0.8, [s(0.65,6,3)]), ex('Тяга с плинтов', 'ТГ', 0.8, [s(0.65,4,3)])),
    day(ex('Жим стоя', 'ЖМ', 0.5, [s(0.60,6,3)]), ex('Тяга штанги в наклоне', 'ТГ', 0.5, [s(0.5,8,4)]), ex('Подтягивания', 'ТГ', 0.5, [s(0.3,8,3)])),
  ];
});

export const CALGARY_16: SRCycleTemplate = {
  meta: {
    id: 'calgary-16',
    title: 'Calgary Barbell 16н (Bryce Krawczyk)',
    direction: 'powerlifting',
    level: 'KMS-MS',
    period: 'peak',
    sessionsPerWeek: 4,
    weeks: 16,
    correctionPct: 0,
    description: 'Calgary Barbell 16н — 4 фазы: Accumulation 64-71% 5-7п → Intensity 76-82% top+backoff → Competition 78-81% RPE → Taper 62-72% синглы @8. 4д/нед, присед 3×, жим 4×, тяга 3×.',
    howItWorks: 'Линейная прогрессия 64→82% (нед 1-8), затем RPE-синглы (нед 12-16). Аксессуары @RPE8. Пик на соревнования. Самый скачиваемый бесплатный пик (RPE+%).',
    conditions: ['KMS-МС, 1-3 года стажа', '4д/нед', 'Знать 1ПМ + RPE'],
    tags: ['calgary', 'western', 'rpe', 'peaking'],
  },
  week1: weeks[0],
  weeks,
};
