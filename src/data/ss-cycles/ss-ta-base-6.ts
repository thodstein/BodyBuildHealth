/**
 * ss-ta-base-6.ts — ТА короткая база 6 недель (5 д/нед).
 * Укороченная общая база для входа в цикл или между стартами:
 * классика рампой 65% → 80%, присед 70% → 85%, тяги 90-95%,
 * нед.6 — разгрузка 60-65% + проходка 90%.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const CLASSIC = [0.65, 0.69, 0.73, 0.76, 0.80, 0.62];
const SQUAT = [0.70, 0.74, 0.78, 0.81, 0.85, 0.64];

function buildWeek(w: number): SSDaySpec[] {
  const c = CLASSIC[w - 1];
  const sq = SQUAT[w - 1];
  const deload = w === 6;
  return [
    day('snatch_day', deload ? 'лёг' : 'тяж',
      ex('snatch', 'Рывок классический', 'olympic', 1.4, [s(c, 3, 4)]),
      ex('snatch_pull', 'Тяга рывковая', 'olympic', 1.0, [s(0.90, 3, 3)]),
      ex('back_squat', 'Присед задний', 'legs', 1.2, [s(sq, deload ? 5 : 5, deload ? 3 : 5)]),
    ),
    day('clean_day', deload ? 'лёг' : 'тяж',
      ex('clean_and_jerk', 'Толчок классический', 'olympic', 1.4, [s(c, 3, 4)]),
      ex('push_jerk', 'Толчок со стоек', 'olympic', 1.0, [s(Math.min(0.90, c + 0.05), 3, 3)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.1, [s(Math.max(0.60, sq - 0.10), 3, 4)]),
    ),
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед (сила)', 'legs', 1.2, [s(sq, 3, 4)]),
      ex('clean_pull', 'Тяга толчковая', 'olympic', 1.0, [s(0.90, 3, 3)]),
      ex('push_press', 'Швунг жимовой', 'shoulders', 0.8, [s(0.72, 5, 3)]),
    ),
    day('technique_day', 'памп',
      ex('power_snatch', 'Рывок силовой', 'olympic', 1.0, [s(0.65, 3, 3)]),
      ex('power_clean', 'Взятие силовое', 'olympic', 1.0, [s(0.65, 3, 3)]),
      ex('overhead_squat_v2', 'Присед над головой', 'legs', 0.7, [s(0.62, 3, 3)]),
    ),
    day('pull_day', deload ? 'лёг' : 'тяж',
      ex('snatch', 'Рывок — дубли', 'olympic', 1.3, [s(c, 2, 3)]),
      ex('clean_and_jerk', 'Толчок — дубли', 'olympic', 1.3, [s(c, 2, 3)]),
      ...(deload ? [ex('back_squat', 'Присед — проходка 90%', 'legs', 1.2, [s(0.90, 1, 2)])] : []),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6].map(buildWeek);

export const SS_TA_BASE_6: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-base-6',
    title: 'ТА короткая база — 6 недель (5 д/нед)',
    mode: 'weightlifting',
    weeks: 6,
    sessionsPerWeek: 5,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Входной блок: классика 65% → 80%, присед 70% → 85%, нед.6 — разгрузка 62-64% + проходка приседа 90%. Между стартами или перед длинным циклом.',
    howItWorks: 'Та же структура, что общая база (рывок/толчок/сила/техника/дубли), сжатая в 6 недель; нед.6 — делод с проходкой.',
    conditions: ['Техника классики поставлена', '5 д/нед'],
    tags: ['weightlifting', 'base', 'short', 'snatch', 'clean-jerk'],
    phases: [
      { weekStart: 1, weekEnd: 3, phase: 'base', title: 'Втягивание 65-73%' },
      { weekStart: 4, weekEnd: 5, phase: 'build', title: 'Напор 76-80%' },
      { weekStart: 6, weekEnd: 6, phase: 'deload', title: 'Разгрузка + проходка' },
    ],
    deloadWeeks: [6],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
