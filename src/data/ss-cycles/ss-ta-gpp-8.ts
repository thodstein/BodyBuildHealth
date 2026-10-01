/**
 * ss-ta-gpp-8.ts — ТА GPP (межсезонье), 8 недель (4 д/нед).
 * Общая физическая подготовка тяжелоатлета: гипертрофия и работоспособность
 * БЕЗ классики — присед/жим/тяга в 8-10 повторах, подсобка, кор.
 * % умеренные (70→80%), объём 4x8 → 5x8; цель — база и масса перед силовым
 * или соревновательным блоком.
 * Источник: открытые GPP/off-season блоки ТА.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const PCT = [0.70, 0.72, 0.74, 0.70, 0.76, 0.78, 0.76, 0.80];
const DELOAD = [4];

function buildWeek(w: number): SSDaySpec[] {
  const p = PCT[w - 1];
  const deload = DELOAD.includes(w);
  const sets = deload ? 2 : w <= 4 ? 4 : 5;
  return [
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(p, 8, sets)]),
      ex('bench_bar', 'Жим лёжа', 'chest', 1.0, [s(Math.max(0.65, p - 0.05), 8, deload ? 2 : 4)]),
      ex('ohp', 'Жим стоя', 'shoulders', 0.9, [s(Math.max(0.60, p - 0.10), 8, deload ? 2 : 3)], { role: 'accessory' }),
      ex('pin_press', 'Дожим с пинов (локаут)', 'chest', 0.6, [s(0.60, 8, 3)], { base: 'bench', role: 'accessory' }),
    ),
    day('pull_day', deload ? 'лёг' : 'тяж',
      ex('deadlift', 'Становая тяга', 'back', 1.3, [s(Math.min(0.82, p + 0.05), 8, deload ? 2 : 4)]),
      ex('row_bar', 'Тяга штанги в наклоне', 'back', 0.7, [s(0.55, 10, deload ? 2 : 4)], { base: 'deadlift', role: 'accessory' }),
      ex('pullup', 'Подтягивания', 'back', 0.6, [s(0, deload ? 6 : 8, deload ? 2 : 4)], { bodyweight: true, role: 'accessory' }),
      ex('rdl', 'Румынская тяга', 'legs', 0.7, [s(Math.max(0.55, p - 0.12), 8, 3)], { role: 'accessory' }),
    ),
    day('squat_day', deload ? 'лёг' : 'тяж',
      ex('front_squat', 'Фронтальный присед', 'legs', 1.1, [s(Math.max(0.62, p - 0.05), 8, sets)]),
      ex('leg_press', 'Жим ногами', 'legs', 0.7, [s(0.60, 10, deload ? 2 : 4)], { base: 'backSquat', baseMult: 1.6, role: 'accessory' }),
      ex('calf_raise', 'Подъёмы на носки', 'legs', 0.5, [s(0.50, 12, 3)], { base: 'backSquat', baseMult: 1.1, role: 'accessory' }),
    ),
    day('accessory_day', 'памп',
      ex('overhead_squat_v2', 'Присед оверхед (подвижность)', 'legs', 0.7, [s(Math.max(0.45, p - 0.25), 5, 3)], { role: 'accessory' }),
      ex('row_db', 'Тяга гантели', 'back', 0.6, [s(0.50, 10, deload ? 2 : 3)], { base: 'deadlift', baseMult: 0.35, role: 'accessory' }),
      ex('db_press', 'Жим гантелей', 'shoulders', 0.7, [s(0.55, 10, deload ? 2 : 3)], { role: 'accessory' }),
      ex('plank_walkout', 'Планка-ходьба (кор)', 'legs', 0.3, [s(0, 12, 3)], { bodyweight: true, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 8 }, (_, i) => buildWeek(i + 1));

export const SS_TA_GPP_8: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-gpp-8',
    title: 'ТА GPP (межсезонье) — 8 недель (4 д/нед)',
    mode: 'weightlifting',
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'GPP-блок тяжелоатлета: гипертрофия и работоспособность БЕЗ классики. Присед/жим/тяга 8-10 повторов (70→80%), подсобка, кор. Делод нед.4.',
    howItWorks: 'Каждая неделя = 4 дня: присед+жимы / тяга / фронт-присед+ноги / подвижность+подсобка. Объём 4x8 → 5x8, % умеренные. Ставится межсезоньем перед силовым/соревновательным блоком.',
    conditions: ['Межсезонье / база', '4 д/нед', 'Без классики'],
    tags: ['gpp', 'hypertrophy', 'off-season', 'base'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Адаптация 4x8, делод нед.4' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Объём 5x8 до 80%' },
    ],
    deloadWeeks: [4],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
