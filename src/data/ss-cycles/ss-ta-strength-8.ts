/**
 * ss-ta-strength-8.ts — ТА силовая база, 8 недель (4 д/нед).
 * Блок общей силы для ТА: присед/тяга/жим стоят в центре, классика — только
 * power-варианты в поддержку (низкий объём, техника). Присед 5x5 → 3x3,
 * тяга 5x5, жим 5x5. Цель — поднять силовую базу под рывок/толчок.
 * Источник: открытые силовые блоки ТА (strength base).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const SQUAT = [0.75, 0.78, 0.80, 0.78, 0.84, 0.86, 0.88, 0.90];
const DEAD = [0.80, 0.83, 0.85, 0.82, 0.88, 0.90, 0.92, 0.95];
const PRESS = [0.70, 0.72, 0.75, 0.72, 0.78, 0.80, 0.82, 0.85];
const DELOAD = [4];

function buildWeek(w: number): SSDaySpec[] {
  const sq = SQUAT[w - 1];
  const dl = DEAD[w - 1];
  const pr = PRESS[w - 1];
  const deload = DELOAD.includes(w);
  const reps = w <= 4 ? 5 : 3;
  const sets = deload ? 2 : w <= 4 ? 5 : 4;
  return [
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(sq, reps, sets)]),
      ex('front_squat', 'Фронтальный присед (объём)', 'legs', 1.0, [s(Math.max(0.55, sq - 0.12), 5, deload ? 2 : 3)]),
      ex('overhead_squat_v2', 'Присед оверхед', 'legs', 0.8, [s(Math.max(0.45, sq - 0.25), 3, 3)], { role: 'accessory' }),
    ),
    day('deadlift_day', deload ? 'лёг' : 'тяж',
      ex('deadlift', 'Становая тяга', 'back', 1.4, [s(dl, reps, sets)]),
      ex('rdl', 'Румынская тяга', 'legs', 0.8, [s(Math.max(0.55, dl - 0.20), 6, deload ? 2 : 3)], { role: 'accessory' }),
      ex('row_bar', 'Тяга штанги в наклоне', 'back', 0.6, [s(Math.max(0.35, dl - 0.35), 8, 3)], { role: 'accessory' }),
    ),
    day('overhead_day', deload ? 'лёг' : 'тяж',
      ex('ohp', 'Жим стоя', 'shoulders', 1.4, [s(pr, reps, sets)]),
      ex('push_press', 'Жимовой швунг', 'shoulders', 1.0, [s(Math.max(0.60, pr + 0.05), 3, deload ? 2 : 4)]),
      ex('pin_press', 'Жим с пинов (локаут)', 'chest', 0.7, [s(0.60, 6, 3)], { base: 'bench', role: 'accessory' }),
    ),
    day('oly_day', 'памп',
      ex('power_snatch', 'Рывок в полуприсед (поддержка)', 'olympic', 1.0, [s(0.70, 2, deload ? 2 : 5)]),
      ex('power_clean', 'Взятие в полуприсед (поддержка)', 'olympic', 1.0, [s(0.70, 2, deload ? 2 : 5)]),
      ex('snatch_pull', 'Рывковая тяга (скорость)', 'olympic', 1.0, [s(Math.min(0.90, dl - 0.05), 3, 3)], { role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 8 }, (_, i) => buildWeek(i + 1));

export const SS_TA_STRENGTH_8: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-strength-8',
    title: 'ТА силовая база — 8 недель (4 д/нед)',
    mode: 'weightlifting',
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Силовой блок ТА: присед 5x5 → 3x3 (75→90%), тяга 5x5 (80→95%), жим 5x5 (70→85%). Классика — только power-варианты в поддержку. Делод нед.4.',
    howItWorks: 'Каждая неделя = 4 дня: присед-сила / тяга-сила / жим-сила / классика-поддержка (power snatch/clean 70%). Объём 5x5 → 3x3, прогрессия вшита, correctionPct=0.',
    conditions: ['Знать ПМ приседа/тяги/жима', '4 д/нед', 'База под классику'],
    tags: ['strength', 'squat', 'deadlift', 'press', 'base'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Объём 5x5, делод нед.4' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Сила 3x3-4x3, % растёт' },
    ],
    deloadWeeks: [4],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
