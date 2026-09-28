import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

const SQ = (sets: SRSetSpec[]) => ex('Присед', 'ПР', 1.2, sets);
const BPU = (sets: SRSetSpec[]) => ex('Жим лежа', 'ЖМ', 1.0, sets);

// Smolov Jr — 3 недели, 4 тренировки/нед. Каноническая схема:
// День1 6×6 @70% | День2 7×5 @75% | День3 8×4 @80% | День4 10×3 @85%
// Каждую неделю +5кг (здесь +2% к % для универсальности). Можно для приседа или жима.

const weeks: SRDaySpec[][] = [
  // Неделя 1
  [
    day(SQ([s(0.70,6,6)]), BPU([s(0.50,8,3)])),
    day(SQ([s(0.75,5,7)]), ex('Тяга штанги в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(SQ([s(0.80,4,8)]), BPU([s(0.55,8,3)])),
    day(SQ([s(0.85,3,10)]), ex('Гиперэкстензия', 'ТГ', 0.3, [s(0.3,10,2)])),
  ],
  // Неделя 2 (+2%)
  [
    day(SQ([s(0.72,6,6)]), BPU([s(0.50,8,3)])),
    day(SQ([s(0.77,5,7)]), ex('Тяга штанги в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(SQ([s(0.82,4,8)]), BPU([s(0.55,8,3)])),
    day(SQ([s(0.87,3,10)]), ex('Пресс', 'ПР', 0, [s(0.2,15,3)])),
  ],
  // Неделя 3 (+2% ещё, затем тест)
  [
    day(SQ([s(0.74,6,6)]), BPU([s(0.50,8,3)])),
    day(SQ([s(0.79,5,7)])),
    day(SQ([s(0.84,4,8)])),
    day(SQ([s(0.89,3,10)]), ex('Тест: проходка до макс', 'ПР', 1.2, [s(1.0,1,1)])),
  ],
];

export const SMOLOV_JR: SRCycleTemplate = {
  meta: {
    id: 'smolov-jr',
    title: 'Смолов Jr — 3 недели (присед/жим)',
    direction: 'powerlifting',
    level: 'II-KMS',
    period: 'peak',
    sessionsPerWeek: 4,
    weeks: 3,
    correctionPct: 0,
    description: 'Укороченная 3-недельная версия Смолова для приседа или жима. 4 тренировки/нед: 6×6@70% → 7×5@75% → 8×4@80% → 10×3@85%. Каждую неделю +5кг (+2% здесь). Можно повторять с неделей отдыха между циклами.',
    howItWorks: 'Smolov Jr — 4×/нед одного движения. День1 объём (6×6), день2 (7×5), день3 (8×4), день4 интенсивность (10×3). Прогрессия +5кг/нед (здесь +2%). Другие лифты — 1 лёгкий день жима/тяги 50% для поддержания. После 3 недель — тест или неделя отдыха и повтор. Идеален как 3-нед вставка в окно между соревнованиями (fitCycleToWeeks сожмёт 6-нед Candito до 3).',
    conditions: ['II-КМС', '4д/нед', '3 недели', 'Присед или жим — одно движение за цикл'],
    tags: ['smolov', 'russian', 'peaking', 'squat', 'bench'],
  },
  week1: weeks[0],
  weeks,
};
