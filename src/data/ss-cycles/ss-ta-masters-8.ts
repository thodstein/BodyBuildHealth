/**
 * ss-ta-masters-8.ts — ТА Masters 40+, 8 недель (4 д/нед).
 * Щадящий блок для возрастных атлетов: ниже частота (4 д/нед), БЕЗ максимумов,
 * приоритет суставной безопасности — работа с блоков/с виса, паузы, темп;
 * % умеренные (70→85%), объём 3-4 подхода. Классика с блоков снижает нагрузку
 * на поясницу/колени, сохраняя специфику.
 * Источник: открытые masters-программы ТА.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const CLASSIC = [0.70, 0.72, 0.74, 0.70, 0.76, 0.78, 0.82, 0.85];
const SQUAT = [0.72, 0.74, 0.76, 0.72, 0.78, 0.80, 0.83, 0.86];
const DELOAD = [4];

function buildWeek(w: number): SSDaySpec[] {
  const c = CLASSIC[w - 1];
  const sq = SQUAT[w - 1];
  const deload = DELOAD.includes(w);
  const last = w === 8;
  const reps = w <= 4 ? 3 : 2;
  const sets = deload ? 2 : last ? 3 : 4;
  return [
    day('snatch_day', deload ? 'лёг' : 'тяж',
      ex('block_snatch', 'Рывок с блоков (выше колен)', 'olympic', 1.2, [s(c, reps, sets)]),
      ex('hang_snatch', 'Рывок с виса', 'olympic', 1.0, [s(Math.max(0.60, c - 0.05), 3, deload ? 2 : 3)], { role: 'accessory' }),
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(sq, 4, deload ? 2 : 4)]),
      ex('ohp', 'Жим стоя', 'shoulders', 1.0, [s(0.70, 6, 3)], { role: 'accessory' }),
    ),
    day('clean_day', deload ? 'лёг' : 'тяж',
      ex('block_clean', 'Взятие с блоков', 'olympic', 1.2, [s(c, reps, sets)]),
      ex('power_clean', 'Взятие в полуприсед', 'olympic', 1.0, [s(Math.max(0.60, c - 0.05), 3, deload ? 2 : 3)], { role: 'accessory' }),
      ex('front_squat', 'Фронтальный присед', 'legs', 1.0, [s(Math.max(0.58, sq - 0.12), 4, deload ? 2 : 3)]),
      ex('push_press', 'Жимовой швунг', 'shoulders', 0.8, [s(Math.min(0.85, c + 0.05), 4, 3)], { role: 'accessory' }),
    ),
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой (тяж)', 'legs', 1.2, [s(sq, 4, deload ? 2 : 4)]),
      ex('pause_squat', 'Присед с паузой (контроль)', 'legs', 0.9, [s(Math.max(0.55, sq - 0.15), 3, 3)], { role: 'accessory' }),
      ex('snatch_pull', 'Рывковая тяга (умеренно)', 'olympic', 1.0, [s(Math.min(0.85, sq), 3, deload ? 1 : 3)], { role: 'accessory' }),
    ),
    day('technique_day', 'памп',
      ex('snatch_balance', 'Рывковый баланс', 'olympic', 0.7, [s(Math.max(0.50, c - 0.12), 3, 4)]),
      ex('jerk_dip', 'Полуприсед толчковый', 'olympic', 0.6, [s(0.75, 5, 3)], { role: 'accessory' }),
      ex('overhead_squat_v2', 'Присед оверхед', 'legs', 0.8, [s(Math.max(0.45, c - 0.20), 3, 3)], { role: 'accessory' }),
      ex('face_pull', 'Тяга к лицу (плечо)', 'shoulders', 0.4, [s(0.30, 12, 3)], { base: 'overheadPress', baseMult: 0.4, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 8 }, (_, i) => buildWeek(i + 1));

export const SS_TA_MASTERS_8: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-masters-8',
    title: 'ТА Masters 40+ — 8 недель (4 д/нед)',
    mode: 'weightlifting',
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Щадящий блок 40+: 4 д/нед, БЕЗ максимумов, работа с блоков/виса + паузы/темп (суставная безопасность). Классика 70→85%, присед 72→86%, объём 3-4 подхода. Делод нед.4.',
    howItWorks: 'Каждая неделя = 4 дня: рывок с блоков / взятие с блоков / присед-сила / техника (баланс, подсед, тяга к лицу). Классика с блоков снижает нагрузку на поясницу. Прогрессия вшита, correctionPct=0.',
    conditions: ['Возраст 40+', '4 д/нед', 'Суставы — приоритет', 'Без максимумов'],
    tags: ['masters', '40+', 'snatch', 'clean', 'joint-friendly', 'base'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Адаптация 3-ки, делод нед.4' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Наращивание 2-ки до 85%' },
    ],
    deloadWeeks: [4],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
