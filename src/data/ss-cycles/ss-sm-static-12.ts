/**
 * ss-sm-static-12.ts — Стронг статика, 12 недель (4 д/нед).
 * Блок статической силы стронгмена: лог/аксель-жим, становая (аксель/рама),
 * присед стоят в центре; ивенты — статические (автодедлифт, камни, холды).
 * Фазы: база → наращивание → пик → тейпер; делоды нед.4/8.
 * Жим 70→92%, тяга 78→95%, присед 75→92%. Объём 5x5 → 3x3 → 2x1.
 * Источник: открытые статические блоки стронгмена (static strength).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const PRESS = [0.70, 0.73, 0.76, 0.72, 0.80, 0.83, 0.86, 0.83, 0.88, 0.90, 0.92, 0.65];
const DEAD = [0.78, 0.81, 0.84, 0.78, 0.87, 0.89, 0.91, 0.87, 0.93, 0.94, 0.95, 0.68];
const SQUAT = [0.75, 0.78, 0.81, 0.75, 0.84, 0.86, 0.88, 0.85, 0.90, 0.91, 0.92, 0.68];
const DELOAD = [4, 8];

function buildWeek(w: number): SSDaySpec[] {
  const pr = PRESS[w - 1];
  const dl = DEAD[w - 1];
  const sq = SQUAT[w - 1];
  const deload = DELOAD.includes(w);
  const taper = w === 12;
  const reps = w <= 4 ? 5 : w <= 8 ? 3 : 1;
  const sets = deload ? 2 : taper ? 1 : w <= 4 ? 5 : w <= 8 ? 4 : 3;
  return [
    day('overhead_day', deload ? 'лёг' : 'тяж',
      ex('log_press', 'Лог-жим', 'strongman', 1.4, [s(pr, reps, sets)]),
      ex('axle_press', 'Аксель-жим (подсобка)', 'strongman', 1.0, [s(Math.max(0.60, pr - 0.08), deload ? 5 : 3, deload ? 2 : 3)], { role: 'accessory' }),
      ex('pin_press', 'Дожим с пинов (локаут)', 'chest', 0.7, [s(0.65, 6, 3)], { base: 'bench', role: 'accessory' }),
      ex('viking_press', 'Викинг-пресс (объём)', 'strongman', 0.8, [s(Math.max(0.55, pr - 0.15), 8, 3)], { role: 'accessory' }),
    ),
    day('deadlift_day', deload ? 'лёг' : 'тяж',
      ex('deadlift', 'Становая тяга', 'back', 1.4, [s(dl, reps, sets)]),
      ex('axle_deadlift', 'Становая аксель (толстый гриф)', 'strongman', 1.1, [s(Math.max(0.62, dl - 0.08), deload ? 3 : 3, deload ? 2 : 3)], { role: 'accessory' }),
      ex('frame_carry', 'Рама — холд 20с', 'strongman', 1.0, [s(Math.max(0.70, dl - 0.05), 1, deload ? 2 : 3, { timeCapS: 20 })]),
    ),
    day('squat_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой', 'legs', 1.2, [s(sq, reps, sets)]),
      ex('front_squat', 'Фронтальный присед (перенос на камни)', 'legs', 1.0, [s(Math.max(0.58, sq - 0.12), 4, deload ? 2 : 3)], { role: 'accessory' }),
      ex('hip_thrust', 'Ягодичный мост', 'legs', 0.6, [s(0.60, 8, 3)], { base: 'deadlift', role: 'accessory' }),
    ),
    day('event_day', deload ? 'лёг' : 'тяж',
      ex('car_deadlift_18', 'Автодедлифт 18″ (синглы)', 'strongman', 1.1, [s(taper ? 0.75 : 0.85, 1, deload ? 2 : 3)]),
      ex('atlas_stone_load', 'Атлас-камень (загрузка)', 'strongman', 1.0, [s(taper ? 0.65 : 0.75, 2, deload ? 2 : 3, { timeCapS: 60 })]),
      ex('husafell_carry', 'Хусафелл — холд 30с', 'strongman', 0.9, [s(Math.max(0.65, dl - 0.15), 1, deload ? 2 : 3, { timeCapS: 30 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 12 }, (_, i) => buildWeek(i + 1));

export const SS_SM_STATIC_12: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-static-12',
    title: 'Стронг статика — 12 недель (4 д/нед)',
    mode: 'strongman',
    weeks: 12,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    period: 'mixed',
    correctionPct: 0,
    equipment: ['barbell', 'log', 'stone'],
    needsSpecialty: true,
    description: 'Статический блок: лог-жим 5x5 → 2x1 (70→92%), становая (78→95%), присед (75→92%). Ивенты — автодедлифт, камни, холды рамы/хусафелл. Делоды нед.4/8, тейпер нед.12.',
    howItWorks: 'Каждая неделя = 4 дня: лог-жим / становая+аксель / присед / статические ивенты. Объём 5x5 → 3x3 → 2x1, прогрессия вшита, correctionPct=0. Без снарядов — фолбэк через STRONG_FALLBACK_COEFF с бейджем.',
    conditions: ['Знать ПМ лога/тяги/приседа', '4 д/нед', 'Спец-снаряды (лог/камень) или фолбэк'],
    tags: ['log', 'deadlift', 'static', 'events', 'peak'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Объём 5x5, делод нед.4' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Сила 4x3, делод нед.8' },
      { weekStart: 9, weekEnd: 11, phase: 'peak', title: 'Пик синглов' },
      { weekStart: 12, weekEnd: 12, phase: 'taper', title: 'Тейпер' },
    ],
    deloadWeeks: [4, 8],
    taperWeeks: [12],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
