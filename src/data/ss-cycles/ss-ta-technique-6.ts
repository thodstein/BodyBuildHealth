/**
 * ss-ta-technique-6.ts — ТА техника/новичок, 6 недель (4 д/нед).
 * Вводный блок: позиционные рывки/взятия (с виса, с высокого виса), комплексы,
 * лёгкие % (50-75%), БЕЗ максимумов. Цель — постановка техники и присед-база.
 * Присед растёт 60→75%, классика только power-варианты до 70%.
 * Источник: открытые вводные программы ТА (Catalyst/техника-блок).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

// Лёгкая техника-рампа: рывок/толчок 50→70%, присед 60→75%
const TECH = [0.50, 0.55, 0.58, 0.62, 0.66, 0.70];
const SQUAT = [0.60, 0.63, 0.66, 0.69, 0.72, 0.75];

function buildWeek(w: number): SSDaySpec[] {
  const t = TECH[w - 1];
  const sq = SQUAT[w - 1];
  return [
    day('technique_day', 'памп',
      ex('hang_snatch', 'Рывок с виса (позиция выше колен)', 'olympic', 1.0, [s(t, 3, 5)]),
      ex('high_hang_snatch', 'Рывок с высокого виса', 'olympic', 0.9, [s(Math.max(0.45, t - 0.05), 3, 4)]),
      ex('muscle_snatch', 'Рывок силой рук', 'olympic', 0.6, [s(0.45, 3, 3)], { role: 'accessory' }),
      ex('snatch_balance', 'Рывковый баланс', 'olympic', 0.7, [s(Math.max(0.40, t - 0.10), 3, 3)], { role: 'accessory' }),
    ),
    day('technique_day', 'памп',
      ex('hang_clean', 'Взятие с виса (позиция выше колен)', 'olympic', 1.0, [s(t, 3, 5)]),
      ex('power_clean', 'Взятие в полуприсед', 'olympic', 0.9, [s(Math.max(0.45, t - 0.05), 3, 4)]),
      ex('push_press', 'Жимовой швунг (техника)', 'shoulders', 0.7, [s(0.55, 5, 3)], { role: 'accessory' }),
      ex('jerk_dip', 'Полуприсед толчковый', 'olympic', 0.6, [s(0.60, 5, 3)], { role: 'accessory' }),
    ),
    day('strength_day', 'тяж',
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(sq, 5, 5)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.0, [s(Math.max(0.50, sq - 0.12), 5, 3)]),
      ex('overhead_squat_v2', 'Присед оверхед (техника)', 'legs', 0.8, [s(Math.max(0.40, t - 0.15), 3, 3)], { role: 'accessory' }),
    ),
    day('pull_day', 'тяж',
      ex('snatch_pull', 'Рывковая тяга (техника)', 'olympic', 1.0, [s(Math.min(0.85, t + 0.15), 3, 3)]),
      ex('clean_pull', 'Толчковая тяга (техника)', 'olympic', 1.0, [s(Math.min(0.85, t + 0.15), 3, 3)]),
      ex('rdl', 'Румынская тяга', 'legs', 0.7, [s(0.55, 6, 3)], { role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 6 }, (_, i) => buildWeek(i + 1));

export const SS_TA_TECHNIQUE_6: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-technique-6',
    title: 'ТА техника (новичок) — 6 недель (4 д/нед)',
    mode: 'weightlifting',
    weeks: 6,
    sessionsPerWeek: 4,
    level: ['beginner'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Вводный блок: позиционные рывки/взятия с виса, комплексы, лёгкие % (50→70%), БЕЗ максимумов. Присед 60→75% 5x5. Цель — техника и база.',
    howItWorks: 'Каждая неделя = 4 дня: рывок-техника / взятие-техника / сила (присед) / тяги. Классика только power-варианты до 70%, 3 повтора. Прогрессия вшита, correctionPct=0.',
    conditions: ['Новичок в ТА', '4 д/нед', 'Без максимумов — техника'],
    tags: ['snatch', 'clean', 'technique', 'beginner', 'base'],
    phases: [
      { weekStart: 1, weekEnd: 3, phase: 'base', title: 'Постановка техники 50-58%' },
      { weekStart: 4, weekEnd: 6, phase: 'build', title: 'Закрепление 62-70%, присед растёт' },
    ],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
