import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from './lms-types';

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

// Sheiko Advanced Large Load 20н — 4 блока: Адаптация 4н → Накопление 6н → Трансмутация 5н → Реализация 5н
// Упрощённая оригинальная раскладка AML (КПШ 800-1000/мес, 4-5д/нед, 80-85% сред.инт. для МС)

const weeks: SRDaySpec[][] = Array.from({ length: 20 }, (_, wi) => {
  const w = wi + 1;
  const block = w <= 4 ? 'adapt' : w <= 10 ? 'acc' : w <= 15 ? 'trans' : 'real';
  const intensity = block === 'adapt' ? 0.65 + w * 0.02 : block === 'acc' ? 0.72 + (w - 5) * 0.015 : block === 'trans' ? 0.80 + (w - 11) * 0.015 : 0.75 - (w - 16) * 0.03;
  const vol = block === 'real' ? 2 : block === 'trans' ? 3 : 5;
  return [
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.85, intensity), 3, vol)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.85, intensity - 0.05), 4, vol)]), ex('Жим гантелей', 'ЖМ', 0.6, [s(0.5,10,3)])),
    day(ex('Становая тяга', 'ТГ', 1.4, [s(Math.min(0.85, intensity), 3, vol)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.80, intensity - 0.05), 4, vol)]), ex('Тяга в наклоне', 'ТГ', 0.5, [s(0.5,8,3)])),
    day(ex('Присед', 'ПР', 1.2, [s(Math.min(0.85, intensity - 0.05), 3, vol)]), ex('Жим лежа', 'ЖМ', 1.0, [s(Math.min(0.85, intensity), 3, vol)]), ex('Наклоны', 'ТГ', 0.5, [s(0.5,6,3)])),
    ...(w % 2 === 0 ? [day(ex('Присед на груди', 'ПР', 1.0, [s(0.60,4,3)]), ex('Жим стоя', 'ЖМ', 0.5, [s(0.5,6,3)]), ex('Гиперэкстензия', 'ТГ', 0.3, [s(0.3,10,3)]))] : []),
  ];
});

export const SHEIKO_AML_20: SRCycleTemplate = {
  meta: {
    id: 'sheiko-aml-20',
    title: 'Шейко AML 20н — Advanced Large Load',
    direction: 'powerlifting',
    level: 'MS-MSMK',
    period: 'strength',
    sessionsPerWeek: 4,
    weeks: 20,
    correctionPct: 0,
    description: 'Шейко Advanced Large Load 20н: 4 блока — Адаптация 4н → Накопление 6н → Трансмутация 5н → Реализация 5н. 4-5д/нед, КПШ 800-1000/мес, 80-85% сред.инт. Для МС/МСМК.',
    howItWorks: 'Годовой объём 50-70к повт.соревн.движ. Волны 65-85% в накоплении, 80-90% в трансмутации, 75% taper в реализации. Каждая неделя — присед/жим/тяга 3-4×. Требуется сон/питание как у сборной.',
    conditions: ['МС-МСМК', '4-5д/нед', '20 недель, КПШ 800-1000'],
    tags: ['sheiko', 'russian', 'advanced', 'large-load'],
  },
  week1: weeks[0],
  weeks,
};
