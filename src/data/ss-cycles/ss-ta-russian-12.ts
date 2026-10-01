/**
 * ss-ta-russian-12.ts — Русская 12-недельная (5 д/нед).
 * Классическая «русская школа»: объёмный блок (высокий тоннаж, тяги 100-110%),
 * блок интенсивности (меньше объёма, выше %), блок пика (синглы), тейпер.
 * Классика 72→95%, тяги 100-110% от классики, присед 2×/нед, жим стоя.
 * Источник: открытые русские/советские 12-недельные циклы ТА.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const CLASSIC = [0.72, 0.75, 0.78, 0.72, 0.80, 0.83, 0.86, 0.82, 0.88, 0.92, 0.95, 0.68];
const SQUAT = [0.78, 0.80, 0.83, 0.76, 0.85, 0.88, 0.90, 0.86, 0.92, 0.94, 0.96, 0.72];
const DELOAD = [4, 8];

function buildWeek(w: number): SSDaySpec[] {
  const c = CLASSIC[w - 1];
  const sq = SQUAT[w - 1];
  const deload = DELOAD.includes(w);
  const taper = w === 12;
  const mainReps = w <= 4 ? 3 : w <= 8 ? 2 : 1;
  const mainSets = deload ? 2 : taper ? 1 : w <= 4 ? 4 : w <= 8 ? 3 : 2;
  const pullPct = Math.min(1.10, c + 0.20);
  const sqSets = deload ? 2 : taper ? 2 : w <= 4 ? 5 : w <= 8 ? 4 : 3;
  const sqReps = w <= 4 ? 5 : w <= 8 ? 3 : 2;
  return [
    day('snatch_day', deload ? 'лёг' : 'тяж',
      ex('snatch', 'Рывок классический', 'olympic', 1.4, [s(c, mainReps, mainSets)]),
      ex('snatch_pull', 'Рывковая тяга', 'olympic', 1.0, [s(pullPct, 3, deload ? 1 : 3)]),
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(sq, sqReps, sqSets)]),
      ex('ohp', 'Жим стоя', 'shoulders', 1.0, [s(0.75, 5, 3)], { role: 'accessory' }),
    ),
    day('clean_day', deload ? 'лёг' : 'тяж',
      ex('clean_and_jerk', 'Толчок классический', 'olympic', 1.4, [s(c, mainReps, mainSets)]),
      ex('clean_pull', 'Толчковая тяга', 'olympic', 1.0, [s(pullPct, 3, deload ? 1 : 3)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.1, [s(Math.max(0.62, sq - 0.10), 3, deload ? 2 : 4)]),
      ex('push_press', 'Жимовой швунг', 'shoulders', 0.8, [s(Math.min(0.90, c + 0.05), 3, 3)], { role: 'accessory' }),
    ),
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой (тяж)', 'legs', 1.2, [s(sq, sqReps, sqSets)]),
      ex('deadlift', 'Становая тяга', 'back', 1.2, [s(Math.min(0.95, sq + 0.02), 3, deload ? 1 : 3)]),
      ex('snatch_pull', 'Рывковая тяга (сила)', 'olympic', 1.0, [s(Math.min(1.05, c + 0.25), 3, 3)], { role: 'accessory' }),
    ),
    day('technique_day', 'памп',
      ex('power_snatch', 'Рывок в полуприсед', 'olympic', 1.0, [s(Math.max(0.62, c - 0.05), 3, deload ? 2 : 4)]),
      ex('power_clean', 'Взятие в полуприсед', 'olympic', 1.0, [s(Math.max(0.62, c - 0.05), 3, deload ? 2 : 4)]),
      ex('snatch_balance', 'Рывковый баланс', 'olympic', 0.7, [s(0.55, 3, 3)], { role: 'accessory' }),
      ex('jerk_dip', 'Полуприсед толчковый', 'olympic', 0.6, [s(0.82, 5, 3)], { role: 'accessory' }),
    ),
    day('pull_day', deload ? 'лёг' : 'тяж',
      ex('clean_pull', 'Толчковая тяга (сила)', 'olympic', 1.0, [s(pullPct, 3, deload ? 1 : 3)]),
      ex('deficit_pull', 'Тяга с дефицита', 'olympic', 1.0, [s(Math.min(1.0, c + 0.15), 3, 3)], { role: 'accessory' }),
      ex('back_squat', 'Присед (объём)', 'legs', 1.2, [s(Math.max(0.65, sq - 0.10), sqReps, deload ? 3 : 5)]),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 12 }, (_, i) => buildWeek(i + 1));

export const SS_TA_RUSSIAN_12: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-russian-12',
    title: 'ТА русская — 12 недель (5 д/нед)',
    mode: 'weightlifting',
    weeks: 12,
    sessionsPerWeek: 5,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'mixed',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Русская школа: объём (тяги 100-110%, 4x3) → интенсивность (3x2, 80-86%) → пик (2x1, 88-95%) → тейпер. Присед 2×/нед, жим стоя. Делоды нед.4/8.',
    howItWorks: 'Каждая неделя = 5 дней: рывок / толчок / сила (присед+тяга) / техника-power / тяги (дефицит+объём приседа). Классика 72→95%, тяги до 110% от классики. Прогрессия вшита, correctionPct=0.',
    conditions: ['Опытный ТА', '5 д/нед', 'Знать ПМ классики и приседа'],
    tags: ['snatch', 'clean-jerk', 'russian', 'volume', 'intensity', 'peak'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Объём: тяги 100-110%, 4x3' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Интенсивность: 3x2, 80-86%' },
      { weekStart: 9, weekEnd: 11, phase: 'peak', title: 'Пик: 2x1, 88-95%' },
      { weekStart: 12, weekEnd: 12, phase: 'taper', title: 'Тейпер' },
    ],
    deloadWeeks: [4, 8],
    taperWeeks: [12],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
