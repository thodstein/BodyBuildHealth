import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Bulgarian Method — 6 дней/нед, ежедневный макс 90-100% 1п + backoff 80% 2-3п, для продвинутых
// Упрощённая оригинал для пауэрлифтинга (присед/жим/тяга ротация)

const weeks: SRDaySpec[][] = Array.from({ length: 4 }, (_, wi) => {
  const pct = 0.85 + wi * 0.03; // 85%→94%
  return [
    day(ex('Присед до макс', 'ПР', 1.2, [s(pct,1,1), s(pct*0.85,2,2)]), ex('Жим лежа до макс', 'ЖМ', 1.0, [s(pct,1,1), s(pct*0.85,2,2)])),
    day(ex('Становая тяга до макс', 'ТГ', 1.4, [s(pct,1,1), s(pct*0.85,2,2)]), ex('Присед лёгкий', 'ПР', 1.0, [s(0.60,3,2)])),
    day(ex('Присед до макс', 'ПР', 1.2, [s(pct,1,1), s(pct*0.85,2,2)]), ex('Жим лежа до макс', 'ЖМ', 1.0, [s(pct,1,1)])),
    day(ex('Жим лежа до макс', 'ЖМ', 1.0, [s(pct,1,1), s(pct*0.85,3,2)]), ex('Присед лёгкий', 'ПР', 1.0, [s(0.60,3,2)])),
    day(ex('Присед до макс', 'ПР', 1.2, [s(pct,1,1)]), ex('Становая тяга до макс', 'ТГ', 1.4, [s(pct,1,1)])),
    day(ex('Жим лежа до макс', 'ЖМ', 1.0, [s(pct,1,1)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
  ];
});

export const BULGARIAN: SRCycleTemplate = {
  meta: {
    id: 'bulgarian',
    title: 'Bulgarian Method — 4н (ежедневный макс)',
    direction: 'powerlifting',
    level: 'MS-MSMK',
    period: 'peak',
    sessionsPerWeek: 6,
    weeks: 4,
    correctionPct: 0,
    description: 'Bulgarian — 6д/нед, ежедневный макс 85-94% 1п + backoff 80% 2п. Для МС-МСМК с идеальной техникой и восстановлением.',
    howItWorks: 'Каждый день макс 1п 85-94% (присед/жим/тяга ротация), затем backoff 80% 2×2. Нет процентов — по ощущению макса дня. Только для опытных, 4 недели макс, затем deload.',
    conditions: ['МС-МСМК', '6д/нед', 'Техника идеальна', '4 недели'],
    tags: ['bulgarian', 'eastern', 'daily-max', 'peaking'],
  },
  week1: weeks[0],
  weeks,
};
