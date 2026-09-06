/**
 * ss-sm-press-6.ts — Стронг жимовой акцент 6 недель (4 д/нед).
 * Специализация на верх (лог/жим стоя): нед.1-2 объём (лог 5x5 75-80%),
 * нед.3-4 тройки 85-90%, нед.5 синглы 92-95%, нед.6 делод + проходка.
 * Низ — поддержка (тяга/присед без максимумов), ивенты 1×/нед.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const LOG = [0.75, 0.78, 0.85, 0.88, 0.92, 0.60];

function buildWeek(w: number): SSDaySpec[] {
  const g = LOG[w - 1];
  const deload = w === 6;
  const ohpMain: SSSetSpec[] = w <= 2 ? [s(g, 5, 5)] : w <= 4 ? [s(g, 3, 4)] : w === 5 ? [s(0.90, 1, 2), s(g, 1, 1)] : [s(g, 3, 2)];
  return [
    day('overhead_day', deload ? 'лёг' : 'тяж',
      ex('log_press', 'Лог-жим (акцент)', 'strongman', 1.5, ohpMain),
      ex('ohp', 'Жим стоя строго', 'shoulders', 1.0, [s(Math.max(0.55, g - 0.10), w <= 2 ? 6 : 3, w <= 2 ? 4 : 3)]),
      ex('pin_press', 'Дожим узким', 'shoulders', 0.7, [s(0.62, 8, 3)], { base: 'bench', role: 'accessory' }),
    ),
    day('deadlift_day', deload ? 'лёг' : 'тяж',
      ex('deadlift', 'Тяга (поддержка, без максимумов)', 'back', 1.1, [s(0.78, 4, 4)]),
      ex('row_bar', 'Тяга в наклоне', 'back', 0.7, [s(0.35, 10, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
    ),
    day('squat_day', deload ? 'лёг' : 'тяж',
      ex('front_squat', 'Фронтальный (стойка под лог)', 'legs', 1.0, [s(0.72, 4, 4)]),
      ex('push_press', 'Швунг жимовой', 'shoulders', 1.0, [s(0.80, 3, 4)]),
    ),
    day('event_day', deload ? 'лёг' : 'памп',
      ex('circus_db_press', 'Гантель цирковая (одна рука)', 'strongman', 1.0, [s(0.70, 3, 4)]),
      ex('farmers_walk_heavy', 'Фермер (хват под лог)', 'strongman', 0.8, [s(0.70, 1, 3, { distanceM: 30, timeCapS: 60 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6].map(buildWeek);

export const SS_SM_PRESS_6: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-press-6',
    title: 'Стронг жимовой акцент — 6 недель (4 д/нед)',
    mode: 'strongman',
    weeks: 6,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'build',
    correctionPct: 0,
    equipment: ['barbell'],
    needsSpecialty: true,
    description: 'Специализация верха: лог 75% 5x5 → 88% тройки → синглы 92% → делод. Низ и тяга — поддержка без максимумов, ивенты лёгкие 1×/нед.',
    howItWorks: 'Жимовый объём сконцентрирован в 2 днях (лог + швунг/гантель); фронт-присед держит стойку. Прогрессия вшита рампой LOG.',
    conditions: ['Жим стоя с техникой', 'Лог желателен (иначе швунг)', '4 д/нед'],
    tags: ['strongman', 'overhead', 'specialization', 'log'],
    phases: [
      { weekStart: 1, weekEnd: 2, phase: 'base', title: 'Объём 5x5' },
      { weekStart: 3, weekEnd: 4, phase: 'build', title: 'Тройки 85-88%' },
      { weekStart: 5, weekEnd: 5, phase: 'peak', title: 'Синглы 92%' },
      { weekStart: 6, weekEnd: 6, phase: 'deload', title: 'Делод + проходка' },
    ],
    deloadWeeks: [6],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
