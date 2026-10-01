/**
 * ss-ta-squat-spec-6.ts — ТА специализация присед, 6 недель (4 д/нед).
 * Спец-блок: присед (задний + фронтальный) 2×/нед в центре, классика — только
 * поддержка (power-варианты + тяги). Присед 5x5 → 3x3, 80→92%.
 * Цель — мощный присед под рывок/толчок (перенос силы).
 * Источник: открытые блоки специализации приседа ТА.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const BACK = [0.80, 0.83, 0.86, 0.84, 0.89, 0.92];
const FRONT = [0.75, 0.78, 0.81, 0.79, 0.85, 0.88];

function buildWeek(w: number): SSDaySpec[] {
  const bk = BACK[w - 1];
  const fr = FRONT[w - 1];
  const reps = w <= 3 ? 5 : 3;
  const sets = w <= 3 ? 5 : 4;
  const last = w === 6;
  return [
    day('squat_day', 'тяж',
      ex('back_squat', 'Присед со штангой (тяж)', 'legs', 1.2, [s(bk, reps, sets)]),
      ex('pause_squat', 'Присед с паузой', 'legs', 1.0, [s(Math.max(0.60, bk - 0.12), 3, 3)], { role: 'accessory' }),
      ex('leg_press', 'Жим ногами (объём)', 'legs', 0.7, [s(0.60, 8, 3)], { base: 'backSquat', baseMult: 1.6, role: 'accessory' }),
    ),
    day('squat_day', 'тяж',
      ex('front_squat', 'Фронтальный присед (тяж)', 'legs', 1.1, [s(fr, reps, sets)]),
      ex('tempo_squat', 'Присед темповый 3-0-1', 'legs', 0.9, [s(Math.max(0.58, fr - 0.12), 3, 3)], { role: 'accessory' }),
      ex('calf_raise', 'Подъёмы на носки', 'legs', 0.5, [s(0.50, 10, 3)], { base: 'backSquat', baseMult: 1.2, role: 'accessory' }),
    ),
    day('oly_day', 'памп',
      ex('power_snatch', 'Рывок в полуприсед (поддержка)', 'olympic', 1.0, [s(0.72, 2, last ? 2 : 5)]),
      ex('power_clean', 'Взятие в полуприсед (поддержка)', 'olympic', 1.0, [s(0.72, 2, last ? 2 : 5)]),
      ex('overhead_squat_v2', 'Присед оверхед', 'legs', 0.8, [s(0.55, 3, 3)], { role: 'accessory' }),
    ),
    day('pull_day', 'тяж',
      ex('snatch_pull', 'Рывковая тяга', 'olympic', 1.0, [s(0.95, 3, 3)]),
      ex('clean_pull', 'Толчковая тяга', 'olympic', 1.0, [s(1.00, 3, 3)]),
      ex('rdl', 'Румынская тяга', 'legs', 0.7, [s(0.60, 6, 3)], { role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 6 }, (_, i) => buildWeek(i + 1));

export const SS_TA_SQUAT_SPEC_6: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-squat-spec-6',
    title: 'ТА специализация присед — 6 недель (4 д/нед)',
    mode: 'weightlifting',
    weeks: 6,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    period: 'build',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Спец-блок приседа: задний 5x5 → 3x3 (80→92%), фронтальный (75→88%), пауза/темп. Классика — поддержка (power 72% + тяги 95-100%). Цель — мощный присед под классику.',
    howItWorks: 'Каждая неделя = 4 дня: задний присед / фронтальный присед / классика-power / тяги. Присед 2×/нед в центре, объём 5x5 → 3x3. Прогрессия вшита, correctionPct=0.',
    conditions: ['Знать ПМ приседа', '4 д/нед', 'Слабое звено — присед'],
    tags: ['squat', 'specialization', 'legs', 'strength'],
    phases: [
      { weekStart: 1, weekEnd: 3, phase: 'base', title: 'Объём 5x5, 80-86%' },
      { weekStart: 4, weekEnd: 6, phase: 'build', title: 'Сила 3x3-4x3, 84-92%' },
    ],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
