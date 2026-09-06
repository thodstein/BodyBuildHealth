/**
 * ss-sm-trio-12.ts — Стронг трио 12 недель (3 д/нед).
 * Обезличенный аналог открытой 12-недельной стронг-программы 3×/нед:
 * Д1 макс. сила (тяга+присед + сани/гиря/жим ногами),
 * Д2 взрыв (лог+гантель+жим лёжа + дельты/руки),
 * Д3 функционал (йок+фермер+мешок 3x20м + сани назад/икры/прыжки).
 * Волны: 1-2 база 3x5-6, 3 делод 60-75%, 4-5 напор 3x4-5, 6 делод,
 * 7-8 напор 3x3-4, 9 делод, 10-11 пик 3x2-3, 12 делод 85% + тест.
 * Источник: открытый интернет-гайд 12-week strongman (3-day trio).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

interface Wave { reps: [number, number]; sets: number; load: number; char: SSDaySpec['character'] }
const WAVES: Record<number, Wave> = {
  1: { reps: [5, 6], sets: 3, load: 0.72, char: 'тяж' },
  2: { reps: [5, 6], sets: 3, load: 0.76, char: 'тяж' },
  3: { reps: [2, 6], sets: 2, load: 0.65, char: 'лёг' },
  4: { reps: [4, 5], sets: 3, load: 0.80, char: 'тяж' },
  5: { reps: [4, 5], sets: 3, load: 0.83, char: 'тяж' },
  6: { reps: [2, 5], sets: 2, load: 0.74, char: 'лёг' },
  7: { reps: [3, 4], sets: 3, load: 0.85, char: 'тяж' },
  8: { reps: [3, 4], sets: 3, load: 0.87, char: 'тяж' },
  9: { reps: [2, 4], sets: 2, load: 0.77, char: 'лёг' },
  10: { reps: [2, 3], sets: 3, load: 0.90, char: 'тяж' },
  11: { reps: [2, 3], sets: 3, load: 0.92, char: 'тяж' },
  12: { reps: [2, 3], sets: 2, load: 0.85, char: 'лёг' },
};

function buildWeek(w: number): SSDaySpec[] {
  const { reps, sets, load, char } = WAVES[w];
  const [r0, r1] = reps;
  const rep = Math.round((r0 + r1) / 2);
  return [
    day('deadlift_day', char,
      ex('deadlift', 'Тяга становая', 'back', 1.4, [s(load, rep, sets)]),
      ex('back_squat', 'Присед задний', 'legs', 1.2, [s(Math.max(0.60, load - 0.03), rep, sets)]),
      ex('sled_push_sprint', 'Сани толкание 20м', 'strongman', 0.7, [s(0.65, 1, 3, { distanceM: 20 })]),
      ex('kettlebell_swing', 'Махи гирей (взрыв)', 'legs', 0.5, [s(0.15, 10, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
      ex('leg_press', 'Жим ногами', 'legs', 0.6, [s(1.00, 8, 3)], { base: 'backSquat', role: 'accessory' }),
    ),
    day('overhead_day', char,
      ex('log_press', 'Лог-лифт', 'strongman', 1.4, [s(load, rep, sets)]),
      ex('db_press', 'Жим гантелей', 'shoulders', 0.9, [s(Math.max(0.55, load - 0.10), 8, 3)], { base: 'bench', role: 'accessory' }),
      ex('bench_bar', 'Жим лёжа', 'shoulders', 1.0, [s(Math.max(0.60, load - 0.05), rep + 2, 3)]),
      ex('lateral_raise', 'Махи гантелями в стороны', 'shoulders', 0.4, [s(0.15, 10, 4)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
      ex('pin_press', 'Трицепс: узкий дожим', 'shoulders', 0.6, [s(0.55, 8, 3)], { base: 'bench', role: 'accessory' }),
      ex('row_db', 'Бицепс/спина: тяга гантели', 'back', 0.5, [s(0.45, 8, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
    ),
    day('event_day', char,
      ex('yoke_walk', 'Йок 20м', 'strongman', 1.2, [s(load, 1, 3, { distanceM: 20, timeCapS: 60 })]),
      ex('farmers_walk_heavy', 'Фермер 20м (хват+кор)', 'strongman', 1.2, [s(load, 1, 3, { distanceM: 20, timeCapS: 60 })]),
      ex('sandbag_carry', 'Мешок 20м (выносливость)', 'strongman', 1.0, [s(Math.max(0.60, load - 0.05), 1, 3, { distanceM: 20, timeCapS: 60 })]),
      ex('sled_drag', 'Сани спиной 20м', 'strongman', 0.6, [s(0.60, 1, 3, { distanceM: 20 })]),
      ex('calf_raise', 'Икры стоя', 'legs', 0.3, [s(0.50, 15, 3)], { base: 'backSquat', role: 'accessory' }),
      ex('box_jump', 'Прыжки на тумбу (взрыв)', 'legs', 0.4, [s(0, 4, 3)], { bodyweight: true, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(buildWeek);

export const SS_SM_TRIO_12: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-trio-12',
    title: 'Стронг трио — 12 недель (3 д/нед)',
    mode: 'strongman',
    weeks: 12,
    sessionsPerWeek: 3,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'mixed',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Трио: Д1 макс.сила (тяга+присед), Д2 взрыв (лог+жим), Д3 функционал (йок+фермер+мешок 3x20м). Волны 2+делод: 72-76% → 80-83% → 85-87% → пик 90-92%, делоды 65/74/77/85%. Нед.13 — тест.',
    howItWorks: 'Нагрузка и повторы заданы волной WAVES (в т.ч. делоды нед.3/6/9/12). Разминка 10-15 мин + заминка 5-10 мин каждый день. Без снарядов — замены через фолбэк-коэффы с бейджем.',
    conditions: ['3 д/нед + отдых между', 'Без серьёзных травм', 'Техника базы поставлена'],
    tags: ['strongman', 'trio', 'events', 'wave', 'deload'],
    phases: [
      { weekStart: 1, weekEnd: 2, phase: 'base', title: 'База 3x5-6' },
      { weekStart: 3, weekEnd: 3, phase: 'deload', title: 'Делод 60-75%' },
      { weekStart: 4, weekEnd: 5, phase: 'build', title: 'Напор 3x4-5' },
      { weekStart: 6, weekEnd: 6, phase: 'deload', title: 'Делод 70-80%' },
      { weekStart: 7, weekEnd: 8, phase: 'build', title: 'Напор 3x3-4' },
      { weekStart: 9, weekEnd: 9, phase: 'deload', title: 'Делод 75-80%' },
      { weekStart: 10, weekEnd: 11, phase: 'peak', title: 'Пик 3x2-3' },
      { weekStart: 12, weekEnd: 12, phase: 'deload', title: 'Делод 85% + тест след. нед.' },
    ],
    deloadWeeks: [3, 6, 9, 12],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
