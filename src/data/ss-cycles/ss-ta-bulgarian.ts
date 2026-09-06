/**
 * ss-ta-bulgarian.ts — ТА болгарский daily-max блок 8 недель (6 д/нед).
 * Обезличенный аналог болгарской системы (Абаджиев): ежедневный максимум
 * в рывке / толчке / фронтальном приседе, минимум подсобки; за ~3 недели
 * до пика — только избирательные нагрузки (тяги и полу-толчки убраны),
 * последняя неделя — одна тренировка в день + тест.
 * ВНИМАНИЕ: только для advanced/enhanced с явным согласием; ACWR-gate в селекторе.
 * Источник: открытые описания болгарской методики (Torokhtiy-гид и др.).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[]): SSExerciseSpec => ({ id, name, group, coef, sets });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

// Ежедневный максимум: синглы 95-100% + сбавки 85-90%
function maxDay(tag: SSDaySpec['tag'], withPulls: boolean): SSDaySpec {
  const list = [
    ex('snatch', 'Рывок — максимум дня', 'olympic', 1.5, [s(0.90, 1, 3), s(0.95, 1, 2), s(1.00, 1, 1), s(0.88, 2, 2)]),
    ex('clean_and_jerk', 'Толчок — максимум дня', 'olympic', 1.5, [s(0.90, 1, 3), s(0.95, 1, 2), s(1.00, 1, 1), s(0.88, 2, 2)]),
    ex('front_squat', 'Присед фронтальный — максимум дня', 'legs', 1.2, [s(0.92, 1, 3), s(0.97, 1, 2), s(1.00, 1, 1)]),
  ];
  if (withPulls) {
    list.push(ex('snatch_pull', 'Тяга рывковая 100%', 'olympic', 0.8, [s(1.00, 2, 2)]));
  }
  return day(tag, 'тяж', ...list);
}

const TAGS: SSDaySpec['tag'][] = ['snatch_day', 'clean_day', 'strength_day', 'pull_day', 'squat_day', 'technique_day'];

function buildWeek(w: number): SSDaySpec[] {
  // Нед 7: избирательные нагрузки (без тяг), нед 8: одна сессия-тип + тест в конце
  if (w <= 6) return TAGS.map(t => maxDay(t, true));
  if (w === 7) return TAGS.map(t => maxDay(t, false));
  return [
    day('snatch_day', 'тяж',
      ex('snatch', 'Рывок — проходка', 'olympic', 1.5, [s(0.90, 1, 2), s(0.95, 1, 1), s(1.00, 1, 1)]),
      ex('front_squat', 'Присед фронтальный — поддержка', 'legs', 1.0, [s(0.85, 2, 2)]),
    ),
    day('clean_day', 'тяж',
      ex('clean_and_jerk', 'Толчок — проходка', 'olympic', 1.5, [s(0.90, 1, 2), s(0.95, 1, 1), s(1.00, 1, 1)]),
      ex('front_squat', 'Присед фронтальный — поддержка', 'legs', 1.0, [s(0.85, 2, 2)]),
    ),
    day('strength_day', 'лёг',
      ex('snatch', 'Рывок — лёгкая техника 70%', 'olympic', 0.8, [s(0.70, 2, 3)]),
      ex('clean_and_jerk', 'Толчок — лёгкая техника 70%', 'olympic', 0.8, [s(0.70, 2, 3)]),
    ),
    day('pull_day', 'тяж',
      ex('snatch', 'Рывок — тест', 'olympic', 1.5, [s(0.92, 1, 1), s(0.97, 1, 1), s(1.02, 1, 1)]),
      ex('clean_and_jerk', 'Толчок — тест', 'olympic', 1.5, [s(0.92, 1, 1), s(0.97, 1, 1), s(1.02, 1, 1)]),
    ),
    day('squat_day', 'тяж',
      ex('front_squat', 'Присед фронтальный — тест', 'legs', 1.2, [s(0.95, 1, 2), s(1.00, 1, 1)]),
    ),
    day('technique_day', 'лёг',
      ex('power_snatch', 'Рывок в полуприсед — восстановление', 'olympic', 0.6, [s(0.60, 3, 3)]),
      ex('power_clean', 'Взятие в полуприсед — восстановление', 'olympic', 0.6, [s(0.60, 3, 3)]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6, 7, 8].map(buildWeek);

export const SS_TA_BULGARIAN: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-bulgarian',
    title: 'ТА болгарский максимум — 8 недель (6 д/нед)',
    mode: 'weightlifting',
    weeks: 8,
    sessionsPerWeek: 6,
    level: ['advanced', 'enhanced'],
    period: 'peak',
    correctionPct: 0,
    equipment: ['barbell'],
    bulgarian: true,
    description: 'Daily-max: каждый день рывок + толчок + фронтальный присед до максимума дня (95-100%) со сбавками. Подсобки минимум. Нед.7 — без тяг (избирательно), нед.8 — подводка и тест.',
    howItWorks: 'Нед.1-6: 6 дней максимумов + тяги 100%. Нед.7: те же максимумы без тяг. Нед.8: проходки + тест 102%. Только с согласием, advanced+; при ACWR caution/dangerous селектор блокирует.',
    conditions: ['Стаж 3+ лет', '6 д/нед + сон 8ч', 'Явное согласие (чекбокс)', 'ACWR optimal/undertrained'],
    tags: ['bulgarian', 'daily-max', 'snatch', 'clean-jerk', 'peaking'],
    phases: [
      { weekStart: 1, weekEnd: 6, phase: 'build', title: 'Максимумы ежедневно + тяги' },
      { weekStart: 7, weekEnd: 7, phase: 'peak', title: 'Избирательные нагрузки, без тяг' },
      { weekStart: 8, weekEnd: 8, phase: 'test', title: 'Подводка + тест' },
    ],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
