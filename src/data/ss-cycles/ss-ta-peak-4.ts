/**
 * ss-ta-peak-4.ts — ТА пик 4 недели (5 д/нед).
 * Короткий подводящий блок под старт/тест: нед.1 классика 80-82%,
 * нед.2 85-88%, нед.3 синглы 90%+ и тест 97-102%, нед.4 разгрузка
 * 70-75% (техника). Ставится после базовых 8-12 недель.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const CLASSIC = [0.81, 0.86, 0.91, 0.72];
const SQUAT = [0.85, 0.87, 0.90, 0.74];

function buildWeek(w: number): SSDaySpec[] {
  const c = CLASSIC[w - 1];
  const sq = SQUAT[w - 1];
  const test = w === 3;
  const deload = w === 4;
  const cls: SSSetSpec[] = test
    ? [s(0.92, 1, 1), s(0.97, 1, 1), s(1.02, 1, 1)]
    : [s(c, 2, 3), s(Math.min(0.95, c + 0.04), 1, 2)];
  return [
    day('snatch_day', deload ? 'лёг' : 'тяж',
      ex('snatch', test ? 'Рывок — тест' : 'Рывок — синглы/дубли', 'olympic', 1.5, cls),
      ex('snatch_pull', 'Тяга рывковая', 'olympic', 0.9, [s(0.90, 2, 2)]),
      ex('back_squat', 'Присед задний', 'legs', 1.2, [s(sq, test ? 2 : 3, test ? 2 : 4)]),
    ),
    day('clean_day', deload ? 'лёг' : 'тяж',
      ex('clean_and_jerk', test ? 'Толчок — тест' : 'Толчок — синглы/дубли', 'olympic', 1.5, cls),
      ex('push_jerk', 'Толчок со стоек', 'olympic', 1.0, [s(0.82, 2, 3)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.0, [s(Math.max(0.65, sq - 0.08), 2, 3)]),
    ),
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед (поддержка)', 'legs', 1.1, [s(sq, 3, 3)]),
      ex('clean_pull', 'Тяга толчковая', 'olympic', 0.9, [s(0.92, 2, 2)]),
    ),
    day('technique_day', 'памп',
      ex('power_snatch', 'Рывок силовой — скорость', 'olympic', 0.9, [s(0.70, 2, 3)]),
      ex('power_clean', 'Взятие силовое — скорость', 'olympic', 0.9, [s(0.70, 2, 3)]),
      ex('jerk_dip', 'Полуприсед толчковый', 'olympic', 0.5, [s(0.75, 3, 2)], { role: 'accessory' }),
    ),
    day('pull_day', deload ? 'лёг' : 'тяж',
      ex('snatch', 'Рывок — дубли', 'olympic', 1.3, [s(Math.min(0.88, c), 2, 3)]),
      ex('clean_and_jerk', 'Толчок — дубли', 'olympic', 1.3, [s(Math.min(0.88, c), 2, 3)]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4].map(buildWeek);

export const SS_TA_PEAK_4: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-peak-4',
    title: 'ТА пик — 4 недели (5 д/нед)',
    mode: 'weightlifting',
    weeks: 4,
    sessionsPerWeek: 5,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'peak',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Подводка к помосту: классика 81% → 86% → тест 92/97/102% → разгрузка 72% на технике. Присед держится вторым номером (85-90%).',
    howItWorks: 'Нед.1-2 синглы/дубли с ростом, нед.3 проходка до 102% (считать как старт: 3 попытки), нед.4 лёгкая техника 70-75%.',
    conditions: ['База за плечами (8+ нед)', 'Знать ПМ рывка/толчка', '5 д/нед'],
    tags: ['weightlifting', 'peaking', 'test', 'singles', 'taper'],
    phases: [
      { weekStart: 1, weekEnd: 2, phase: 'build', title: 'Подвод: 81-86%' },
      { weekStart: 3, weekEnd: 3, phase: 'test', title: 'Тест 92/97/102%' },
      { weekStart: 4, weekEnd: 4, phase: 'deload', title: 'Разгрузка 72%' },
    ],
    deloadWeeks: [4],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
