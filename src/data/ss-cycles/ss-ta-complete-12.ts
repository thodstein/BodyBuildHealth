/**
 * ss-ta-complete-12.ts — ТА полный 12-недельный макроцикл (5 д/нед).
 * Обезличенный аналог открытого 12-недельного ТА-цикла: 8 недель базы
 * на силу ног (присед 65%x10x3 → 80%x3x8, блочные рывки/взятия, тяги)
 * + 4 недели предсоревновательной в болгарском стиле (тяжёлые синглы
 * классики, присед уже не первый). Пик — тест рывок/толчок в нед.12.
 * Источник: открытый интернет-цикл ТА (12-week complete cycle).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[]): SSExerciseSpec => ({ id, name, group, coef, sets });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const SQ = [0.65, 0.68, 0.70, 0.72, 0.75, 0.77, 0.80, 0.82]; // нед 1-8
const CL = [0.65, 0.68, 0.70, 0.72, 0.74, 0.76, 0.78, 0.80]; // классика нед 1-8

function baseWeek(w: number): SSDaySpec[] {
  const sq = SQ[w - 1];
  const c = CL[w - 1];
  const heavy = w >= 5;
  return [
    day('snatch_day', 'тяж',
      ex('back_squat', 'Присед задний', 'legs', 1.2, [s(sq, heavy ? 5 : 10, 3)]),
      ex('snatch', 'Рывок с блоков (среднее бедро)', 'olympic', 1.3, [s(c, 3, 5)]),
      ex('snatch_pull', 'Тяга рывковая с паузой у бедра', 'olympic', 1.0, [s(0.80, 3, 3)]),
      ex('overhead_squat_v2', 'Присед над головой', 'legs', 0.8, [s(0.65, 3, 5)]),
    ),
    day('clean_day', 'тяж',
      ex('push_jerk', 'Толчок из-за головы', 'olympic', 1.0, [s(0.70, 3, 5)]),
      ex('push_press', 'Жимовой швунг', 'shoulders', 0.8, [s(0.75, 5, 4)]),
      ex('jerk_dip', 'Полуприсед толчковый', 'legs', 0.6, [s(0.80, 5, 3)]),
    ),
    day('strength_day', 'тяж',
      ex('back_squat', 'Присед задний (сила)', 'legs', 1.2, [s(Math.min(0.88, sq + 0.05), 5, 5)]),
      ex('clean_and_jerk', 'Взятие с блоков + толчок', 'olympic', 1.3, [s(c, 3, 5)]),
      ex('clean_pull', 'Тяга толчковая с паузой', 'olympic', 1.0, [s(0.80, 3, 3)]),
      ex('rdl', 'Румынская тяга', 'legs', 0.7, [s(0.60, 5, 3)]),
    ),
    day('technique_day', 'памп',
      ex('power_snatch', 'Рывок силовой', 'olympic', 1.0, [s(0.65, 3, 4)]),
      ex('power_clean', 'Взятие силовое', 'olympic', 1.0, [s(0.65, 3, 4)]),
      ex('push_jerk', 'Толчок силовой', 'olympic', 0.9, [s(0.65, 3, 4)]),
      ex('snatch_pull', 'Протяжка рывковая', 'olympic', 0.8, [s(0.70, 3, 3)]),
    ),
    day('pull_day', 'тяж',
      ex('back_squat', 'Присед задний (объём)', 'legs', 1.2, [s(sq, 3, heavy ? 5 : 8)]),
      ex('snatch', 'Рывок классический', 'olympic', 1.4, [s(0.70, 3, 2), s(0.75, 2, 3)]),
      ex('clean_and_jerk', 'Толчок классический', 'olympic', 1.4, [s(0.70, 3, 2), s(0.75, 2, 3)]),
    ),
  ];
}

// Нед 9-12: болгарский стиль — классика тяжёлыми синглами, присед вторым
const PEAK = [0.80, 0.85, 0.90, 0.92];
function peakWeek(i: number): SSDaySpec[] {
  const c = PEAK[i];
  const test = i === 3;
  const cls = test
    ? [s(0.92, 1, 1), s(0.97, 1, 1), s(1.02, 1, 1)]
    : [s(c, 2, 3), s(Math.min(0.97, c + 0.04), 1, 2)];
  return [
    day('snatch_day', 'тяж',
      ex('snatch', test ? 'Рывок — тест' : 'Рывок — синглы', 'olympic', 1.5, cls),
      ex('back_squat', 'Присед задний (после классики)', 'legs', 1.1, [s(0.80, 3, 4)]),
      ex('snatch_pull', 'Тяга рывковая', 'olympic', 0.9, [s(0.90, 2, 2)]),
    ),
    day('clean_day', 'тяж',
      ex('clean_and_jerk', test ? 'Толчок — тест' : 'Толчок — синглы', 'olympic', 1.5, cls),
      ex('front_squat', 'Присед фронтальный', 'legs', 1.0, [s(0.78, 2, 3)]),
      ex('push_jerk', 'Толчок со стоек', 'olympic', 0.9, [s(0.82, 2, 3)]),
    ),
    day('strength_day', 'тяж',
      ex('back_squat', 'Присед (поддержка)', 'legs', 1.1, [s(0.82, 3, 4)]),
      ex('clean_pull', 'Тяга толчковая', 'olympic', 0.9, [s(0.92, 2, 3)]),
    ),
    day('technique_day', 'памп',
      ex('power_snatch', 'Рывок силовой — скорость', 'olympic', 0.9, [s(0.70, 2, 4)]),
      ex('power_clean', 'Взятие силовое — скорость', 'olympic', 0.9, [s(0.70, 2, 4)]),
    ),
    day('pull_day', 'тяж',
      ex('snatch', 'Рывок — дубли', 'olympic', 1.3, [s(Math.min(0.90, c), 2, 4)]),
      ex('clean_and_jerk', 'Толчок — дубли', 'olympic', 1.3, [s(Math.min(0.90, c), 2, 4)]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(baseWeek),
  peakWeek(0), peakWeek(1), peakWeek(2), peakWeek(3),
];

export const SS_TA_COMPLETE_12: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-complete-12',
    title: 'ТА полный цикл — 12 недель (5 д/нед)',
    mode: 'weightlifting',
    weeks: 12,
    sessionsPerWeek: 5,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'mixed',
    correctionPct: 0,
    equipment: ['barbell'],
    description: '8 недель силы ног (присед 65%×10×3 → 80%×3×8, блочные рывки/взятия) + 4 недели предсоревновательных в болгарском стиле (синглы классики, присед вторым). Пик — тест в нед.12.',
    howItWorks: 'Нед.1-8: присед первый, классика с блоков; нед.9-12: классика синглами 80→92%+тест 102%, присед после. Прогрессия вшита, correctionPct=0.',
    conditions: ['Стаж от года', '5 д/нед', 'Знать ПМ рывка/толчка/приседа'],
    tags: ['snatch', 'clean-jerk', 'squat-block', 'peaking', '12-week'],
    phases: [
      { weekStart: 1, weekEnd: 8, phase: 'base', title: 'Сила ног + блочная классика' },
      { weekStart: 9, weekEnd: 11, phase: 'peak', title: 'Болгарский стиль: синглы 80-90%' },
      { weekStart: 12, weekEnd: 12, phase: 'test', title: 'Тест рывок/толчок' },
    ],
    mockWeeks: [11],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
