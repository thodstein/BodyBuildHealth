/**
 * ss-ta-general-8.ts — ТА 8 недель, общая база (5 д/нед).
 * Обезличенный аналог открытой 8-недельной общей программы ТА:
 * 3-позиционные рывки/взятия + power-варианты, тяги 90-95% от классики,
 * присед 5x5, жимовой блок; классика рампой 65% → 82%.
 * Источник: открытый интернет-цикл ТА (Catalyst-style general 8-week).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[]): SSExerciseSpec => ({ id, name, group, coef, sets });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

// Рампа классики и приседа по неделям (дословно волна источника)
const CLASSIC = [0.65, 0.68, 0.70, 0.72, 0.75, 0.78, 0.80, 0.82];
const SQUAT = [0.70, 0.72, 0.75, 0.77, 0.80, 0.82, 0.85, 0.87];

function buildWeek(w: number): SSDaySpec[] {
  const c = CLASSIC[w - 1];
  const sq = SQUAT[w - 1];
  const last = w === 8;
  const sqSets = last ? 3 : 5;
  const sqReps = w <= 4 ? 5 : 3;
  return [
    day('snatch_day', 'тяж',
      ex('snatch', 'Рывок 3-позиционный (пол/ниже колен/выше колен)', 'olympic', 1.4, [s(c, 3, 4)]),
      ex('snatch_pull', 'Рывковая тяга', 'olympic', 1.0, [s(0.90, 3, 2), s(0.95, 3, 2)]),
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(sq, sqReps, sqSets)]),
      ex('push_press', 'Жимовой швунг', 'shoulders', 0.7, [s(0.70, 5, 4)]),
    ),
    day('clean_day', 'тяж',
      ex('clean_and_jerk', 'Взятие 3-позиционное + толчок', 'olympic', 1.4, [s(c, 3, 4)]),
      ex('push_jerk', 'Толчок со стоек', 'olympic', 1.0, [s(Math.min(0.92, c + 0.05), 3, 3)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.1, [s(Math.max(0.60, sq - 0.10), 3, 4)]),
      ex('clean_pull', 'Толчковая тяга', 'olympic', 1.0, [s(0.90, 3, 3)]),
    ),
    day('strength_day', 'тяж',
      ex('back_squat', 'Присед со штангой (тяж)', 'legs', 1.2, [s(sq, sqReps, sqSets)]),
      ex('snatch_pull', 'Рывковая тяга (сила)', 'olympic', 1.0, [s(0.95, 3, 3)]),
      ex('overhead_squat_v2', 'Присед со штангой над головой', 'legs', 0.8, [s(0.65, 3, 3)]),
    ),
    day('technique_day', 'памп',
      ex('power_snatch', 'Рывок в полуприсед', 'olympic', 1.0, [s(Math.max(0.60, c - 0.05), 3, 4)]),
      ex('power_clean', 'Взятие в полуприсед', 'olympic', 1.0, [s(Math.max(0.60, c - 0.05), 3, 4)]),
      ex('muscle_snatch', 'Рывок силой рук', 'olympic', 0.6, [s(0.55, 3, 3)]),
      ex('jerk_dip', 'Полуприсед толчковый', 'olympic', 0.6, [s(0.80, 5, 3)]),
    ),
    day('pull_day', 'тяж',
      ex('snatch', 'Рывок классический', 'olympic', 1.4, [s(c, 3, 2), s(Math.min(0.90, c + 0.05), 2, 3)]),
      ex('clean_and_jerk', 'Толчок классический', 'olympic', 1.4, [s(c, 3, 2), s(Math.min(0.90, c + 0.05), 2, 3)]),
      ex('back_squat', 'Присед (объём)', 'legs', 1.2, [s(sq, sqReps, last ? 4 : 8)]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6, 7, 8].map(buildWeek);

export const SS_TA_GENERAL_8: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-general-8',
    title: 'ТА общая база — 8 недель (5 д/нед)',
    mode: 'weightlifting',
    weeks: 8,
    sessionsPerWeek: 5,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Общая 8-недельная база ТА: 3-позиционные рывки/взятия + power-варианты, тяги 90-95%, присед 5x5 → 3x3. Классика рампой 65% → 82%. Нед.1: если легко — поднять последние сеты.',
    howItWorks: 'Каждая неделя = 5 дней: рывок / взятие+толчок / сила (присед+тяги) / техника-памп (power) / классика+объём приседа. Прогрессия вшита в недели (CLASSIC/SQUAT рампы), correctionPct=0.',
    conditions: ['Знать ПМ рывка/толчка/приседа', '5 д/нед', 'Тяги считаются от ПМ классики'],
    tags: ['snatch', 'clean-jerk', 'squat', 'technique', 'base'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'База: объём 5x5, техника 3-позиционная' },
      { weekStart: 5, weekEnd: 7, phase: 'build', title: 'Наращивание: 3-ки, классика 75-80%' },
      { weekStart: 8, weekEnd: 8, phase: 'peak', title: 'Тяжёлая неделя: классика 82%, присед 87%' },
    ],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
