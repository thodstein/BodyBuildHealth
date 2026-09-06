/**
 * ss-hb-mix-8.ts — Гибрид ТА+стронг 8 недель (4 д/нед).
 * Микс для зала без помоста: Пн классика ТА (рывок 3-позиционный + присед),
 * Вт верх стронга (лог + жим стоя), Чт база (тяга + фронтальный присед),
 * Сб ивенты на подручном (фермер с гантелей, мешок, медли).
 * Классика рампой 65% → 80%, сила 72% → 87%. Спец-снаряды опциональны —
 * без них фолбэк с бейджем (йок→фермер ×0.73, камень→мешок ×0.66).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const CLASSIC = [0.65, 0.68, 0.70, 0.72, 0.75, 0.77, 0.78, 0.80];
const STRONG = [0.72, 0.74, 0.76, 0.78, 0.81, 0.83, 0.85, 0.87];

function buildWeek(w: number): SSDaySpec[] {
  const c = CLASSIC[w - 1];
  const g = STRONG[w - 1];
  const vol = w <= 4 ? 5 : 4;
  return [
    day('snatch_day', 'тяж',
      ex('snatch', 'Рывок 3-позиционный', 'olympic', 1.3, [s(c, 3, 4)]),
      ex('overhead_squat_v2', 'Присед над головой', 'legs', 0.8, [s(0.65, 3, 3)]),
      ex('back_squat', 'Присед задний', 'legs', 1.2, [s(g, 5, vol)]),
    ),
    day('overhead_day', 'тяж',
      ex('log_press', 'Лог-жим (или швунг)', 'strongman', 1.3, [s(g, 3, vol)]),
      ex('ohp', 'Жим стоя строго', 'shoulders', 1.0, [s(Math.max(0.60, g - 0.08), 6, 3)]),
      ex('pin_press', 'Дожим узким (локаут)', 'shoulders', 0.7, [s(0.60, 8, 3)], { base: 'bench' }),
    ),
    day('strength_day', 'тяж',
      ex('deadlift', 'Становая тяга', 'back', 1.4, [s(g, 4, vol)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.1, [s(Math.max(0.62, g - 0.10), 3, 4)]),
      ex('row_db', 'Тяга гантели', 'back', 0.6, [s(0.35, 10, 3)], { base: 'deadlift', baseMult: 1 }),
    ),
    day('event_day', w >= 7 ? 'тяж' : 'памп',
      ex('farmers_walk_heavy', 'Фермер (гантели/ручки)', 'strongman', 1.1, [s(0.72, 1, 4, { distanceM: 30, timeCapS: 60 })]),
      ex('sandbag_carry', 'Мешок переноска', 'strongman', 1.0, [s(0.68, 1, 3, { distanceM: 25, timeCapS: 60 })]),
      ex('atlas_stone_load', 'Камень/мешок загрузка', 'strongman', 1.0, [s(0.68, 2, 3, { timeCapS: 60 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6, 7, 8].map(buildWeek);

export const SS_HB_MIX_8: SSCycleTemplate = {
  meta: {
    id: 'ss-hb-mix-8',
    title: 'Гибрид ТА+стронг — 8 недель (4 д/нед)',
    mode: 'hybrid',
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'mixed',
    correctionPct: 0,
    equipment: ['barbell', 'dumbbell'],
    needsSpecialty: true,
    description: 'Микс без помоста: Пн рывок+присед, Вт лог+жим, Чт тяга+фронт, Сб фермер/мешок/камень. Классика 65% → 80%, сила 72% → 87%. Лог/камень опциональны — фолбэк с бейджем.',
    howItWorks: 'Каждый день — свой столп (рывок/лог/тяга/ивенты), прогрессия вшита в недели рампами CLASSIC/STRONG. Режим плана остаётся hybrid.',
    conditions: ['Гантели + штанга как минимум', 'Техника рывка базовая', '4 д/нед'],
    tags: ['hybrid', 'snatch', 'log', 'events', 'mixed'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'База: объём 5-ки' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Напор: 4-ки, ивенты тяж' },
    ],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
