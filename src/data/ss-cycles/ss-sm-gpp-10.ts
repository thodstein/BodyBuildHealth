/**
 * ss-sm-gpp-10.ts — Стронг GPP (межсезонье), 10 недель (4 д/нед).
 * Общая физическая подготовка стронгмена: гипертрофия + рабочие способности.
 * Объём высокий, % умеренные (65→78%), повторы 8-10 на базу, 12-15 на подсобку;
 * кондиция (сани/покрышка/переноски) — работоспособность.
 * Цель — масса и база перед силовым/пиковым блоком.
 * Источник: открытые GPP/off-season блоки стронгмена.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const PCT = [0.65, 0.68, 0.70, 0.65, 0.72, 0.74, 0.72, 0.65, 0.76, 0.78];
const DELOAD = [4, 8];

function buildWeek(w: number): SSDaySpec[] {
  const p = PCT[w - 1];
  const deload = DELOAD.includes(w);
  const sets = deload ? 2 : w <= 4 ? 4 : 5;
  const last = w === 10;
  return [
    day('strength_day', deload ? 'лёг' : 'тяж',
      ex('bench_bar', 'Жим лёжа', 'chest', 1.2, [s(p, 8, sets)]),
      ex('ohp', 'Жим стоя', 'shoulders', 1.0, [s(Math.max(0.60, p - 0.05), 8, deload ? 2 : 4)]),
      ex('db_press', 'Жим гантелей (подсобка)', 'shoulders', 0.7, [s(0.60, 10, deload ? 2 : 3)], { role: 'accessory' }),
      ex('pin_press', 'Дожим с пинов', 'chest', 0.6, [s(0.60, 8, 3)], { base: 'bench', role: 'accessory' }),
    ),
    day('deadlift_day', deload ? 'лёг' : 'тяж',
      ex('deadlift', 'Становая тяга', 'back', 1.3, [s(Math.min(0.80, p + 0.05), deload ? 6 : 8, deload ? 2 : 4)]),
      ex('row_bar', 'Тяга штанги в наклоне', 'back', 0.7, [s(0.55, 10, deload ? 2 : 4)], { base: 'deadlift', role: 'accessory' }),
      ex('pullup', 'Подтягивания', 'back', 0.6, [s(0, deload ? 6 : 8, deload ? 2 : 4)], { bodyweight: true, role: 'accessory' }),
      ex('face_pull', 'Тяга к лицу (плечо)', 'shoulders', 0.4, [s(0.30, 15, 3)], { base: 'overheadPress', baseMult: 0.4, role: 'accessory' }),
    ),
    day('squat_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(p, 8, sets)]),
      ex('front_squat', 'Фронтальный присед', 'legs', 0.9, [s(Math.max(0.55, p - 0.12), 8, deload ? 2 : 3)], { role: 'accessory' }),
      ex('rdl', 'Румынская тяга', 'legs', 0.7, [s(0.55, 10, deload ? 2 : 3)], { role: 'accessory' }),
      ex('hip_thrust', 'Ягодичный мост', 'legs', 0.6, [s(0.60, 10, 3)], { base: 'deadlift', role: 'accessory' }),
    ),
    day('event_day', last ? 'тяж' : 'памп',
      ex('yoke_walk', 'Йок 30м (работоспособность)', 'strongman', 1.0, [s(Math.max(0.70, p), 1, deload ? 2 : 4, { distanceM: 30, timeCapS: 90 })]),
      ex('farmers_walk_heavy', 'Фермер 30м', 'strongman', 1.0, [s(Math.max(0.72, p), 1, deload ? 2 : 4, { distanceM: 30, timeCapS: 90 })]),
      ex('tire_flip', 'Покрышка (кондиция)', 'strongman', 0.9, [s(0.70, 1, deload ? 3 : 6, { timeCapS: 60 })]),
      ex('plank_walkout', 'Планка-ходьба (кор)', 'legs', 0.3, [s(0, 12, 3)], { bodyweight: true, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 10 }, (_, i) => buildWeek(i + 1));

export const SS_SM_GPP_10: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-gpp-10',
    title: 'Стронг GPP (межсезонье) — 10 недель (4 д/нед)',
    mode: 'strongman',
    weeks: 10,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate', 'advanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell', 'yoke', 'farmers', 'tire'],
    needsSpecialty: true,
    description: 'GPP-блок: гипертрофия + работоспособность. Жим/становая/присед 8-10 повторов (65→78%), подсобка 10-15, кондиция (йок/фермер/покрышка). Делоды нед.4/8.',
    howItWorks: 'Каждая неделя = 4 дня: жим-день / тяга-день / ноги / ивенты-кондиция. Объём 4-5 подходов по 8-15, % умеренные. Прогрессия вшита, correctionPct=0.',
    conditions: ['Межсезонье / база', '4 д/нед', 'Спец-снаряды или фолбэк'],
    tags: ['gpp', 'hypertrophy', 'off-season', 'conditioning', 'base'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Адаптация 4x8, делод нед.4' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Объём 5x8, делод нед.8' },
      { weekStart: 9, weekEnd: 10, phase: 'peak', title: 'Финал: кондиция-тест + пик %' },
    ],
    deloadWeeks: [4, 8],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
