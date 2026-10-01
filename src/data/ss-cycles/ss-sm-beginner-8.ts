/**
 * ss-sm-beginner-8.ts — Стронг новичок, 8 недель (3 д/нед).
 * Вводный блок: база со штангой (присед/жим/тяга 5x5) + знакомство с ивентами
 * (лог, фермер, камень — лёгкие/техника). Без максимумов, объём 3x5 → 5x5.
 * % 60→75%. Цель — база и техника снарядов.
 * Источник: открытые вводные программы стронгмена.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const MAIN = [0.60, 0.62, 0.65, 0.60, 0.68, 0.70, 0.72, 0.75];
const DELOAD = [4];

function buildWeek(w: number): SSDaySpec[] {
  const m = MAIN[w - 1];
  const deload = DELOAD.includes(w);
  const sets = deload ? 2 : w <= 4 ? 3 : 5;
  const reps = w <= 4 ? 5 : 5;
  return [
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(m, reps, sets)]),
      ex('ohp', 'Жим стоя', 'shoulders', 1.1, [s(m, reps, deload ? 2 : 4)]),
      ex('deadlift', 'Становая тяга', 'back', 1.3, [s(Math.min(0.80, m + 0.05), 5, deload ? 2 : 3)]),
      ex('row_bar', 'Тяга штанги в наклоне', 'back', 0.6, [s(0.45, 8, 3)], { base: 'deadlift', role: 'accessory' }),
    ),
    day('event_day', 'памп',
      ex('log_press', 'Лог-жим (техника)', 'strongman', 1.0, [s(Math.max(0.55, m - 0.05), 5, deload ? 2 : 3)]),
      ex('farmers_walk_heavy', 'Фермер 20м (техника)', 'strongman', 1.0, [s(Math.max(0.60, m), 1, deload ? 2 : 3, { distanceM: 20, timeCapS: 60 })]),
      ex('atlas_stone_load', 'Камень/мешок — загрузка (техника)', 'strongman', 0.9, [s(Math.max(0.55, m - 0.05), 2, deload ? 2 : 3, { timeCapS: 60 })]),
      ex('plank_walkout', 'Планка-ходьба (кор)', 'legs', 0.3, [s(0, 10, 3)], { bodyweight: true, role: 'accessory' }),
    ),
    day('accessory_day', 'памп',
      ex('front_squat', 'Фронтальный присед (техника)', 'legs', 1.0, [s(Math.max(0.50, m - 0.10), 5, deload ? 2 : 3)]),
      ex('db_press', 'Жим гантелей', 'shoulders', 0.8, [s(0.50, 8, deload ? 2 : 3)], { role: 'accessory' }),
      ex('pullup', 'Подтягивания', 'back', 0.6, [s(0, 6, deload ? 2 : 4)], { bodyweight: true, role: 'accessory' }),
      ex('face_pull', 'Тяга к лицу (плечо)', 'shoulders', 0.4, [s(0.30, 12, 3)], { base: 'overheadPress', baseMult: 0.4, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 8 }, (_, i) => buildWeek(i + 1));

export const SS_SM_BEGINNER_8: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-beginner-8',
    title: 'Стронг новичок — 8 недель (3 д/нед)',
    mode: 'strongman',
    weeks: 8,
    sessionsPerWeek: 3,
    level: ['beginner'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell', 'log', 'farmers', 'stone'],
    needsSpecialty: true,
    description: 'Вводный блок: база со штангой (присед/жим/тяга 3x5 → 5x5, 60→75%) + знакомство с ивентами (лог, фермер, камень — техника). Без максимумов. Делод нед.4.',
    howItWorks: 'Каждая неделя = 3 дня: база со штангой / ивенты-техника / подсобка (фронт-присед, гантели, подтягивания). Объём 3x5 → 5x5, % лёгкие. Прогрессия вшита, correctionPct=0.',
    conditions: ['Новичок в стронге', '3 д/нед', 'Спец-снаряды или фолбэк', 'Без максимумов'],
    tags: ['beginner', 'base', 'log', 'farmers', 'stone'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: '3x5, техника снарядов, делод нед.4' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: '5x5, % растёт до 75%' },
    ],
    deloadWeeks: [4],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
