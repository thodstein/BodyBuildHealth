/**
 * ss-hb-base-10.ts — Гибридная база, 10 недель (4 д/нед).
 * Штанга + стронг-ивенты в одном блоке: присед/жим/тяга + power-классика
 * в поддержку + ивент-день (лог/фермер/йок/камни). % умеренные 70→82%,
 * объём 4x5 → 5x5. Цель — база перед гибридным пиком.
 * Источник: открытые гибридные (штанга + силовой экстрим) блоки.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const MAIN = [0.70, 0.72, 0.74, 0.70, 0.76, 0.78, 0.76, 0.72, 0.80, 0.82];
const OLYS = [0.70, 0.72, 0.74, 0.70, 0.76, 0.78, 0.76, 0.72, 0.80, 0.82];
const DELOAD = [4, 8];

function buildWeek(w: number): SSDaySpec[] {
  const p = MAIN[w - 1];
  const o = OLYS[w - 1];
  const deload = DELOAD.includes(w);
  const sets = deload ? 2 : w <= 4 ? 4 : 5;
  const cs = (pct: number, d: number): SSSetSpec[] => [{ pct, reps: 1, sets: deload ? 2 : 3, distanceM: d, timeCapS: 60 }];
  return [
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(p, 5, sets)]),
      ex('bench_bar', 'Жим лёжа', 'chest', 1.0, [s(Math.max(0.65, p - 0.05), 5, deload ? 2 : 4)]),
      ex('row_bar', 'Тяга штанги в наклоне', 'back', 0.7, [s(0.60, 8, deload ? 2 : 4)], { base: 'deadlift', role: 'accessory' }),
      ex('ohp', 'Жим стоя', 'shoulders', 0.9, [s(Math.max(0.60, p - 0.10), 6, 3)], { role: 'accessory' }),
    ),
    day('oly_day', deload ? 'лёг' : 'тяж',
      ex('power_snatch', 'Рывок в полуприсед', 'olympic', 1.1, [s(o, 3, deload ? 2 : 5)]),
      ex('power_clean', 'Взятие в полуприсед', 'olympic', 1.1, [s(o, 3, deload ? 2 : 5)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.0, [s(Math.max(0.62, o - 0.05), 4, deload ? 2 : 4)]),
      ex('snatch_pull', 'Рывковая тяга (сила)', 'olympic', 1.0, [s(Math.min(1.0, o + 0.18), 3, 3)], { role: 'accessory' }),
    ),
    day('overhead_day', deload ? 'лёг' : 'тяж',
      ex('log_press', 'Лог-жим', 'strongman', 1.3, [s(Math.max(0.68, p), 5, deload ? 2 : 4)]),
      ex('axle_press', 'Аксель-жим (толстый гриф)', 'strongman', 1.0, [s(Math.max(0.62, p - 0.08), 6, deload ? 2 : 3)], { role: 'accessory' }),
      ex('pullup', 'Подтягивания', 'back', 0.6, [s(0, deload ? 6 : 8, deload ? 2 : 4)], { bodyweight: true, role: 'accessory' }),
      ex('pin_press', 'Дожим с пинов', 'chest', 0.6, [s(0.62, 6, 3)], { base: 'bench', role: 'accessory' }),
    ),
    day('event_day', deload ? 'лёг' : 'тяж',
      ex('deadlift', 'Становая тяга', 'back', 1.3, [s(Math.min(0.85, p + 0.03), 5, deload ? 2 : 4)]),
      ex('farmers_walk_heavy', 'Фермер 25м', 'strongman', 1.1, cs(Math.max(0.72, p), 25)),
      ex('yoke_walk', 'Йок 20м', 'strongman', 1.1, cs(Math.max(0.70, p - 0.03), 20)),
      ex('atlas_stone_load', 'Камень/мешок — загрузка', 'strongman', 0.9, [s(deload ? 0.60 : Math.max(0.65, p - 0.08), 2, deload ? 2 : 3, { timeCapS: 60 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 10 }, (_, i) => buildWeek(i + 1));

export const SS_HB_BASE_10: SSCycleTemplate = {
  meta: {
    id: 'ss-hb-base-10',
    title: 'Гибрид база — 10 недель (4 д/нед)',
    mode: 'hybrid',
    weeks: 10,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell', 'log', 'yoke', 'farmers', 'stone'],
    needsSpecialty: true,
    description: 'Гибридная база: присед/жим/тяга 4x5 → 5x5 (70→82%), power-классика в поддержку, ивент-день (лог/фермер/йок/камни). Делоды нед.4/8.',
    howItWorks: 'Каждая неделя = 4 дня: штанга (присед+жим+тяга) / power-классика / лог+аксель / ивенты (становая+переноски+камни). Прогрессия вшита, correctionPct=0.',
    conditions: ['База для гибрида (штанга + экстрим)', '4 д/нед', 'Спец-снаряды или фолбэк'],
    tags: ['hybrid', 'base', 'barbell', 'events'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Адаптация 4x5, делод нед.4' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Объём 5x5, делод нед.8' },
      { weekStart: 9, weekEnd: 10, phase: 'peak', title: 'Финал: % до 82%' },
    ],
    deloadWeeks: [4, 8],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
