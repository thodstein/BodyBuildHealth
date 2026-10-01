/**
 * ss-ta-comp-12.ts — ТА предсоревновательные 12 недель (5 д/нед).
 * Профессиональный соревновательный блок: база → наращивание → пик → тейпер,
 * финал — mock-соревнование (рывок/толчок по заявкам).
 * Классика рампой 70% → 92% (пик нед.11), присед 75% → 95%, объём падает к пику.
 * Делоды нед.4/8 (плановый сброс), тейпер нед.12 (Winwood/cessation).
 * Методика: объёмный блок 4 нед → интенсивность 4 нед → пик 3 нед → тейпер
 * (аналог Catalyst/Russian competition prep). Источник: открытые циклы ТА.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

// Рампа классики/приседа по неделям (пик нед.11, нед.12 — тейпер-занижение)
const CLASSIC = [0.70, 0.72, 0.74, 0.72, 0.78, 0.80, 0.82, 0.80, 0.86, 0.90, 0.92, 0.65];
const SQUAT = [0.75, 0.78, 0.80, 0.78, 0.84, 0.86, 0.88, 0.86, 0.90, 0.93, 0.95, 0.70];
const DELOAD = [4, 8];

function buildWeek(w: number): SSDaySpec[] {
  const c = CLASSIC[w - 1];
  const sq = SQUAT[w - 1];
  const deload = DELOAD.includes(w);
  const taper = w === 12;
  const mock = w === 12;
  const mainReps = w <= 4 ? 3 : w <= 8 ? 2 : 1;
  const classicSets = deload ? 2 : taper ? 1 : w <= 4 ? 4 : w <= 8 ? 3 : 2;
  const sqSets = deload ? 2 : taper ? 2 : w <= 4 ? 5 : w <= 8 ? 4 : 3;
  const sqReps = deload ? 3 : w <= 4 ? 5 : w <= 8 ? 3 : 2;
  const pullPct = Math.min(1.05, c + 0.15);
  return [
    day('snatch_day', deload ? 'лёг' : 'тяж',
      mock
        ? ex('snatch', 'Рывок — заявка (opener/2-й/3-й)', 'olympic', 1.4, [s(0.90, 1, 1), s(0.96, 1, 1), s(1.01, 1, 1)])
        : ex('snatch', 'Рывок классический', 'olympic', 1.4, [s(c, mainReps, classicSets)]),
      ex('snatch_pull', 'Рывковая тяга', 'olympic', 1.0, [s(Math.min(1.0, c + 0.12), 3, deload ? 1 : 2)]),
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(sq, sqReps, sqSets)]),
      ex('overhead_squat_v2', 'Присед оверхед (техника)', 'legs', 0.8, [s(Math.max(0.55, c - 0.15), 3, 3)], { role: 'accessory' }),
    ),
    day('clean_day', deload ? 'лёг' : 'тяж',
      mock
        ? ex('clean_and_jerk', 'Толчок — заявка (opener/2-й/3-й)', 'olympic', 1.4, [s(0.90, 1, 1), s(0.96, 1, 1), s(1.01, 1, 1)])
        : ex('clean_and_jerk', 'Толчок классический', 'olympic', 1.4, [s(c, mainReps, classicSets)]),
      ex('clean_pull', 'Толчковая тяга', 'olympic', 1.0, [s(pullPct, 3, deload ? 1 : 3)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.1, [s(Math.max(0.62, sq - 0.10), 3, deload ? 2 : 4)]),
      ex('jerk_dip', 'Полуприсед толчковый', 'olympic', 0.6, [s(0.80, 5, 3)], { role: 'accessory' }),
    ),
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой (тяж)', 'legs', 1.2, [s(sq, sqReps, sqSets)]),
      ex('snatch_pull', 'Рывковая тяга (сила)', 'olympic', 1.0, [s(Math.min(1.0, c + 0.15), 3, deload ? 1 : 3)]),
      ex('push_press', 'Жимовой швунг', 'shoulders', 0.7, [s(0.75, 5, 3)], { role: 'accessory' }),
    ),
    day('technique_day', 'памп',
      ex('power_snatch', 'Рывок в полуприсед', 'olympic', 1.0, [s(Math.max(0.60, c - 0.07), 3, deload ? 2 : 4)]),
      ex('power_clean', 'Взятие в полуприсед', 'olympic', 1.0, [s(Math.max(0.60, c - 0.07), 3, deload ? 2 : 4)]),
      ex('snatch_balance', 'Рывковый баланс', 'olympic', 0.7, [s(0.55, 3, 3)], { role: 'accessory' }),
      ex('muscle_snatch', 'Рывок силой рук', 'olympic', 0.6, [s(0.50, 3, 3)], { role: 'accessory' }),
    ),
    day('pull_day', deload ? 'лёг' : 'тяж',
      ex('clean_pull', 'Толчковая тяга (сила)', 'olympic', 1.0, [s(pullPct, 3, deload ? 1 : 3)]),
      ex('rdl', 'Румынская тяга', 'legs', 0.7, [s(0.65, 6, 3)], { role: 'accessory' }),
      ex('back_squat', 'Присед (объём)', 'legs', 1.2, [s(Math.max(0.65, sq - 0.10), sqReps, deload ? 3 : 5)]),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 12 }, (_, i) => buildWeek(i + 1));

export const SS_TA_COMP_12: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-comp-12',
    title: 'ТА предсоревновательные — 12 недель (5 д/нед)',
    mode: 'weightlifting',
    weeks: 12,
    sessionsPerWeek: 5,
    level: ['intermediate', 'advanced'],
    period: 'peak',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Соревновательный блок: 4 нед объём → 4 нед интенсивность → 3 нед пик → тейпер. Классика 70→92%, присед 75→95%, объём падает к пику. Делоды нед.4/8. Нед.12 — mock-соревнование (рывок/толчок по заявкам 90/96/101%).',
    howItWorks: 'Каждая неделя = 5 дней: рывок / толчок / сила (присед+тяга) / техника-power / тяги+объём приседа. Прогрессия вшита в недели (CLASSIC/SQUAT рампы), correctionPct=0. Заявки mock — от текущего ПМ (opener 90%, 2-й 96%, 3-й 101%).',
    conditions: ['Знать ПМ рывка/толчка/приседа', '5 д/нед', 'Соревновательный сезон'],
    tags: ['snatch', 'clean-jerk', 'competition', 'peak', 'taper', 'mock'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'База: объём 4x3, классика 70-74%' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Интенсивность: 3x2, классика 78-82%' },
      { weekStart: 9, weekEnd: 11, phase: 'peak', title: 'Пик: 2x1, классика 86-92%' },
      { weekStart: 12, weekEnd: 12, phase: 'taper', title: 'Тейпер + mock-соревнование' },
    ],
    deloadWeeks: [4, 8],
    taperWeeks: [12],
    mockWeeks: [12],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
