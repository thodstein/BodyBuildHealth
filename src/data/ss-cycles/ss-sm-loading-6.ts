/**
 * ss-sm-loading-6.ts — Стронг загрузки, 6 недель (4 д/нед).
 * Спец-блок загрузочных ивентов: камни, мешок, бочка, лог-клин. Взрывная сила
 * разгибания + техника lap/загрузки; ноги (фронт-присед) и лог-клин в поддержку.
 * % умеренные (70→88%), объём 4x2 → 5x3, время-кап как на соревновании.
 * Источник: открытые блоки loading events (stones/bags/kegs).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const PCT = [0.70, 0.73, 0.76, 0.79, 0.83, 0.88];
const DELOAD = [4];

function buildWeek(w: number): SSDaySpec[] {
  const p = PCT[w - 1];
  const deload = DELOAD.includes(w);
  const sets = deload ? 2 : w <= 3 ? 4 : 5;
  const last = w === 6;
  return [
    day('event_day', deload ? 'лёг' : 'тяж',
      ex('atlas_stone_load', 'Атлас-камень — загрузка', 'strongman', 1.1, [s(p, 2, sets, { timeCapS: 60 })]),
      ex('natural_stone_shoulder', 'Натуральный камень — на плечо', 'strongman', 1.0, [s(Math.max(0.65, p - 0.08), 2, deload ? 2 : 3, { timeCapS: 60 })]),
      ex('stone_lift', 'Камень — подъём (техника)', 'strongman', 0.9, [s(Math.max(0.60, p - 0.12), 2, deload ? 2 : 3)]),
    ),
    day('event_day', deload ? 'лёг' : 'тяж',
      ex('sandbag_load', 'Мешок — загрузка 120-140см', 'strongman', 1.1, [s(p, 2, sets, { timeCapS: 60 })]),
      ex('sandbag_over_bar', 'Мешок через планку', 'strongman', 1.0, [s(Math.max(0.65, p - 0.06), 2, deload ? 2 : 3, { timeCapS: 60 })]),
      ex('keg_over_bar', 'Бочка через планку', 'strongman', 0.9, [s(Math.max(0.62, p - 0.10), 2, deload ? 2 : 3)]),
      ex('keg_toss', 'Бросок бочки', 'strongman', 0.8, [s(Math.max(0.60, p - 0.12), 1, deload ? 2 : 3)]),
    ),
    day('squat_day', deload ? 'лёг' : 'тяж',
      ex('front_squat', 'Фронтальный присед (драйв загрузок)', 'legs', 1.2, [s(Math.min(0.88, p + 0.02), w <= 3 ? 5 : 3, deload ? 2 : 4)]),
      ex('back_squat', 'Присед со штангой (объём)', 'legs', 1.1, [s(Math.min(0.85, p), 5, deload ? 2 : 3)]),
      ex('rdl', 'Румынская тяга', 'legs', 0.7, [s(0.60, 6, deload ? 2 : 3)], { role: 'accessory' }),
    ),
    day('overhead_day', deload ? 'лёг' : 'тяж',
      ex('log_press', 'Лог-жим', 'strongman', 1.2, [s(Math.min(0.90, p + 0.02), w <= 3 ? 3 : 2, deload ? 2 : 4)]),
      ex('power_clean', 'Взятие лога в полуприсед (клин)', 'olympic', 1.0, [s(Math.max(0.62, p - 0.08), 2, deload ? 2 : 3)], { role: 'accessory' }),
      ex('deficit_pull', 'Тяга с дефицита (старт загрузок)', 'olympic', 1.0, [s(Math.min(0.95, p + 0.05), 3, deload ? 1 : 3)], { role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 6 }, (_, i) => buildWeek(i + 1));

export const SS_SM_LOADING_6: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-loading-6',
    title: 'Стронг загрузки — 6 недель (4 д/нед)',
    mode: 'strongman',
    weeks: 6,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    period: 'build',
    correctionPct: 0,
    equipment: ['barbell', 'stone', 'sandbag', 'keg', 'log'],
    needsSpecialty: true,
    description: 'Спец-блок загрузок: камни/мешок/бочка/лог-клин, взрывное разгибание + техника lap. Поддержка — фронт-присед, лог, тяга с дефицита. % 70→88%, время-кап как на соревновании. Делод нед.4.',
    howItWorks: 'Каждая неделя = 4 дня: камни / мешок-бочка / ноги (фронт/задний присед) / лог + тяга. Объём 4x2 → 5x2-3, % растут. Прогрессия вшита, correctionPct=0.',
    conditions: ['Опытный стронгмен', '4 д/нед', 'Спец-снаряды (камни/мешок/бочка) или фолбэк'],
    tags: ['loading', 'stones', 'sandbag', 'keg', 'log', 'events'],
    phases: [
      { weekStart: 1, weekEnd: 3, phase: 'base', title: 'Объём 4x2, техника lap, делод нед.4' },
      { weekStart: 4, weekEnd: 6, phase: 'build', title: '5x2-3, % до 88%' },
    ],
    deloadWeeks: [4],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
