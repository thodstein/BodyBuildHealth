/**
 * ss-sm-531-4.ts — Стронг 5/3/1, 4 недели (4 д/нед).
 * Обезличенный аналог открытой связки 5/3/1 + стронг (Kentucky Strong):
 * training max = 90% 1ПМ; волна нед.1 3x5 65/75/85% → нед.2 3x3
 * 70/80/90% → нед.3 5/3/1 75/85/95% (последний сет AMRAP «+») →
 * нед.4 делод 40/50/60%. Лифты: жим стоя, наклонный жим, тяга,
 * фронтальный присед + лог/йок/фермер на дистанцию 3xдистанция.
 * Прогрессия: +2.5кг верх / +5кг низ к TM каждый цикл.
 * Источник: открытые материалы 5/3/1 for Strongman.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

// Волна 5/3/1 от TM (доли единицы TM)
const WAVE: Array<Array<[number, number, boolean]>> = [
  [[0.65, 5, false], [0.75, 5, false], [0.85, 5, true]],
  [[0.70, 3, false], [0.80, 3, false], [0.90, 3, true]],
  [[0.75, 5, false], [0.85, 3, false], [0.95, 1, true]],
  [[0.40, 5, false], [0.50, 5, false], [0.60, 5, false]],
];

function mainLift(sets: Array<[number, number, boolean]>): SSSetSpec[] {
  return sets.map(([pct, reps, amrap]) => s(pct, reps, 1, amrap ? { amrap: true } : undefined));
}

function buildWeek(w: number): SSDaySpec[] {
  const wave = WAVE[w - 1];
  const deload = w === 4;
  const dist: SSSetSpec[] = deload
    ? [s(0.60, 1, 2, { distanceM: 20, timeCapS: 60 })]
    : [s(0.75, 1, 3, { distanceM: 20, timeCapS: 60 })];
  return [
    day('overhead_day', deload ? 'лёг' : 'тяж',
      ex('ohp', 'Жим стоя 5/3/1', 'shoulders', 1.4, mainLift(wave)),
      ex('log_press', 'Лог-жим (подсобка)', 'strongman', 1.0, [s(0.70, 5, 3)]),
      ex('pin_press', 'Дожим узким (локаут)', 'shoulders', 0.7, [s(0.60, 8, 3)], { base: 'bench' }),
    ),
    day('deadlift_day', deload ? 'лёг' : 'тяж',
      ex('deadlift', 'Становая 5/3/1', 'back', 1.4, mainLift(wave)),
      ex('front_squat', 'Фронтальный присед (перенос на камни/лог)', 'legs', 1.0, [s(0.65, 5, 3)]),
      ex('row_bar', 'Тяга в наклоне', 'back', 0.6, [s(0.35, 10, 3)], { base: 'deadlift', baseMult: 1 }),
    ),
    day('squat_day', deload ? 'лёг' : 'тяж',
      ex('front_squat', 'Фронтальный присед 5/3/1', 'legs', 1.3, mainLift(wave)),
      ex('back_squat', 'Присед задний (объём)', 'legs', 1.0, [s(0.65, 5, 3)]),
      ex('hip_thrust', 'Ягодичный мост', 'legs', 0.6, [s(0.55, 8, 3)], { base: 'deadlift', baseMult: 1 }),
    ),
    day('event_day', deload ? 'лёг' : 'тяж',
      ex('yoke_walk', 'Йок 3xдистанция', 'strongman', 1.2, dist),
      ex('farmers_walk_heavy', 'Фермер 3xдистанция', 'strongman', 1.2, dist),
      ex('atlas_stone_load', 'Камни/мешок (техника)', 'strongman', 0.9, [s(deload ? 0.60 : 0.70, 2, 3, { timeCapS: 60 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4].map(buildWeek);

export const SS_SM_531_4: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-531-4',
    title: 'Стронг 5/3/1 — 4 недели (4 д/нед)',
    mode: 'strongman',
    weeks: 4,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'build',
    correctionPct: 0,
    equipment: ['barbell'],
    tmFactor: 0.9,
    description: 'TM = 90% 1ПМ. Нед.1 3x5 (65/75/85), нед.2 3x3 (70/80/90), нед.3 5/3/1 (75/85/95, последний +AMRAP), нед.4 делод 40/50/60. Ивенты — 3xдистанция. Фронтальный присед вместо заднего (перенос на камни, легче восстановление с йоком).',
    howItWorks: 'Все % считаются от TM (90% ПМ) — tmFactor=0.9 вшит в адаптер. Последний сет нед.1-3 — AMRAP с запасом (без гроба). После цикла: TM +2.5 верх / +5 низ, повтор.',
    conditions: ['Знать 1ПМ (TM=90%)', '4 д/нед', 'Консервативный старт'],
    tags: ['531', 'training-max', 'amrap', 'strongman', 'events'],
    phases: [
      { weekStart: 1, weekEnd: 1, phase: 'base', title: '3x5' },
      { weekStart: 2, weekEnd: 2, phase: 'build', title: '3x3' },
      { weekStart: 3, weekEnd: 3, phase: 'peak', title: '5/3/1 + AMRAP' },
      { weekStart: 4, weekEnd: 4, phase: 'deload', title: 'Делод 40-60%' },
    ],
    deloadWeeks: [4],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
