/**
 * ss-ta-soviet-8.ts — ТА советская база 8 недель (6 д/нед).
 * Обезличенный аналог открытой советской 8-недельной программы:
 * 6 тренировочных дней, проценты от ПРОЕКТНОГО максимума конца цикла,
 * рывок/толчок/приседы фронтальный+задний/тяги/жимы; отдых каждый 3-й день
 * (в недельном виде: 6 сессий + 1 отдых). Нагрузка растёт еженедельно.
 * Источник: открытый интернет-документ «Soviet 8-week weightlifting program».
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[]): SSExerciseSpec => ({ id, name, group, coef, sets });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

// Проценты от проектного ПМ (конец цикла) — растут каждую неделю
const CLASSIC = [0.70, 0.72, 0.75, 0.77, 0.80, 0.82, 0.85, 0.88];
const SQUAT = [0.72, 0.75, 0.77, 0.80, 0.82, 0.85, 0.87, 0.90];

function buildWeek(w: number): SSDaySpec[] {
  const c = CLASSIC[w - 1];
  const sq = SQUAT[w - 1];
  const vol = w <= 3 ? 5 : 4;
  return [
    day('snatch_day', 'тяж',
      ex('snatch', 'Рывок классический', 'olympic', 1.4, [s(c, 2, 5)]),
      ex('snatch_pull', 'Тяга рывковая 100-110%', 'olympic', 1.0, [s(1.00, 3, 3)]),
      ex('back_squat', 'Присед задний', 'legs', 1.2, [s(sq, 3, vol)]),
    ),
    day('clean_day', 'тяж',
      ex('clean_and_jerk', 'Толчок классический', 'olympic', 1.4, [s(c, 2, 5)]),
      ex('clean_pull', 'Тяга толчковая 100-110%', 'olympic', 1.0, [s(1.00, 3, 3)]),
      ex('front_squat', 'Присед фронтальный', 'legs', 1.1, [s(Math.max(0.65, sq - 0.08), 3, vol)]),
    ),
    day('strength_day', 'тяж',
      ex('back_squat', 'Присед задний (сила)', 'legs', 1.2, [s(sq, 3, vol)]),
      ex('push_press', 'Швунг жимовой', 'shoulders', 0.8, [s(0.75, 4, 4)]),
      ex('snatch_pull', 'Тяга рывковая', 'olympic', 1.0, [s(0.95, 3, 3)]),
    ),
    day('technique_day', 'памп',
      ex('hang_snatch', 'Рывок с виса', 'olympic', 1.0, [s(Math.max(0.60, c - 0.08), 3, 4)]),
      ex('hang_clean', 'Взятие с виса', 'olympic', 1.0, [s(Math.max(0.60, c - 0.08), 3, 4)]),
      ex('snatch_balance', 'Рывковый баланс/уход', 'olympic', 0.7, [s(0.70, 3, 3)]),
    ),
    day('pull_day', 'тяж',
      ex('snatch', 'Рывок (подход к максимуму)', 'olympic', 1.4, [s(c, 2, 3), s(Math.min(0.92, c + 0.03), 1, 2)]),
      ex('clean_and_jerk', 'Толчок (подход к максимуму)', 'olympic', 1.4, [s(c, 2, 3), s(Math.min(0.92, c + 0.03), 1, 2)]),
      ex('clean_pull', 'Тяга толчковая тяжёлая', 'olympic', 1.0, [s(1.05, 2, 3)]),
    ),
    day('squat_day', 'тяж',
      ex('front_squat', 'Присед фронтальный (объём)', 'legs', 1.1, [s(Math.max(0.65, sq - 0.08), 3, 5)]),
      ex('back_squat', 'Присед задний (объём)', 'legs', 1.2, [s(sq, 5, 3)]),
      ex('push_jerk', 'Толчок со стоек (лёгкий)', 'olympic', 0.9, [s(0.70, 3, 3)]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6, 7, 8].map(buildWeek);

export const SS_TA_SOVIET_8: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-soviet-8',
    title: 'ТА советская база — 8 недель (6 д/нед)',
    mode: 'weightlifting',
    weeks: 8,
    sessionsPerWeek: 6,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Советская 8-недельная база: 6 дней, проценты от проектного максимума (классика 70% → 88%, присед 72% → 90%), тяги 100-110% от классики. Отдых каждый 3-й день.',
    howItWorks: 'Неделя = рывок / толчок / сила / техника-памп / классика-подход / присед-объём. Все % растут еженедельно и вшиты в таблицу; correctionPct=0. Восстановление обязательно (сон/питание).',
    conditions: ['Стаж от 1-2 лет', '6 д/нед', 'Знать проектный ПМ', 'Хорошее восстановление'],
    tags: ['snatch', 'clean-jerk', 'squat', 'soviet', 'volume'],
    phases: [
      { weekStart: 1, weekEnd: 3, phase: 'base', title: 'Втягивание: 70-75%, объём 5-ки' },
      { weekStart: 4, weekEnd: 6, phase: 'build', title: 'База: 77-82%' },
      { weekStart: 7, weekEnd: 8, phase: 'peak', title: 'Подход: 85-88%, тяги 105%' },
    ],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
