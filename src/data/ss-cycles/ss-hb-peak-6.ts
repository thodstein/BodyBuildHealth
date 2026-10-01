/**
 * ss-hb-peak-6.ts — Гибридный пик, 6 недель (4 д/нед).
 * Подводка к старту «штанга + экстрим»: классика ТА-лайт (power-варианты) +
 * ивенты на соревновательных весах; нед.5 — mock-соревнование (заявки 90/96/101%),
 * нед.6 — тейпер (Winwood/cessation). % растут 78→90%, объём падает.
 * Источник: открытые гибридные пиковые блоки.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const OLY = [0.78, 0.82, 0.86, 0.90, 0.90, 0.65];
const MAIN = [0.80, 0.84, 0.88, 0.90, 0.90, 0.68];
const DELOAD: number[] = [];

function buildWeek(w: number): SSDaySpec[] {
  const o = OLY[w - 1];
  const p = MAIN[w - 1];
  const taper = w === 6;
  const mock = w === 5;
  const reps = w <= 3 ? 2 : 1;
  const sets = taper ? 1 : w <= 3 ? 3 : 2;
  const dist = (pct: number, d: number): SSSetSpec[] => [{ pct, reps: 1, sets: taper ? 1 : 2, distanceM: d, timeCapS: 60 }];
  return [
    day('oly_day', taper ? 'лёг' : 'тяж',
      mock
        ? ex('snatch', 'Рывок — заявка (opener/2-й/3-й)', 'olympic', 1.4, [s(0.90, 1, 1), s(0.96, 1, 1), s(1.01, 1, 1)])
        : ex('snatch', 'Рывок классический', 'olympic', 1.4, [s(o, reps, sets)]),
      mock
        ? ex('clean_and_jerk', 'Толчок — заявка (opener/2-й/3-й)', 'olympic', 1.4, [s(0.90, 1, 1), s(0.96, 1, 1), s(1.01, 1, 1)])
        : ex('clean_and_jerk', 'Толчок классический', 'olympic', 1.4, [s(o, reps, sets)]),
      ex('front_squat', 'Фронтальный присед (поддержание)', 'legs', 1.0, [s(Math.max(0.70, o - 0.10), 2, 2)]),
    ),
    day('overhead_day', taper ? 'лёг' : 'тяж',
      mock
        ? ex('log_press', 'Лог-жим — заявка (opener/2-й/3-й)', 'strongman', 1.3, [s(0.90, 1, 1), s(0.96, 1, 1), s(1.01, 1, 1)])
        : ex('log_press', 'Лог-жим', 'strongman', 1.3, [s(p + 0.02, reps, sets)]),
      ex('axle_press', 'Аксель-жим (поддержание)', 'strongman', 1.0, [s(Math.max(0.72, p - 0.08), 2, 2)], { role: 'accessory' }),
      ex('pin_press', 'Дожим с пинов', 'chest', 0.6, [s(0.70, 5, 2)], { base: 'bench', role: 'accessory' }),
    ),
    day('deadlift_day', taper ? 'лёг' : 'тяж',
      mock
        ? ex('deadlift_max', 'Становая макс — заявка', 'strongman', 1.4, [s(0.92, 1, 1), s(0.98, 1, 1)])
        : ex('deadlift', 'Становая тяга', 'back', 1.4, [s(Math.min(0.92, p + 0.02), reps, sets)]),
      ex('power_clean', 'Взятие силовое (скорость)', 'olympic', 1.0, [s(Math.max(0.70, o - 0.08), 2, 2)], { role: 'accessory' }),
      ex('back_squat', 'Присед (поддержание)', 'legs', 1.1, [s(Math.max(0.70, p - 0.10), 2, 2)]),
    ),
    day('event_day', taper ? 'лёг' : 'тяж',
      ex('farmers_walk_heavy', `Фермер 20м @${Math.round((taper ? 0.80 : p) * 100)}%`, 'strongman', 1.2, dist(taper ? 0.80 : p, 20)),
      ex('yoke_walk', `Йок 20м @${Math.round((taper ? 0.78 : p - 0.02) * 100)}%`, 'strongman', 1.1, dist(taper ? 0.78 : Math.max(0.72, p - 0.02), 20)),
      ex('atlas_stone_load', mock ? 'Камень — серия (mock)' : 'Камень/мешок — загрузка', 'strongman', 1.0, [s(taper ? 0.62 : Math.max(0.70, p - 0.08), 2, taper ? 1 : 3, { timeCapS: 60 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 6 }, (_, i) => buildWeek(i + 1));

export const SS_HB_PEAK_6: SSCycleTemplate = {
  meta: {
    id: 'ss-hb-peak-6',
    title: 'Гибрид пик — 6 недель (4 д/нед)',
    mode: 'hybrid',
    weeks: 6,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    period: 'peak',
    correctionPct: 0,
    equipment: ['barbell', 'log', 'yoke', 'farmers', 'stone'],
    needsSpecialty: true,
    description: 'Гибридный пик: классика ТА 2x1-3x2 (78→90%) + лог/становая/ивенты на соревновательных весах. Нед.5 — mock (заявки 90/96/101%), нед.6 — тейпер.',
    howItWorks: 'Каждая неделя = 4 дня: классика-заявки / лог / становая / ивенты. Объём падает, % растут; mock нед.5 симулирует старт, тейпер нед.6 по Winwood.',
    conditions: ['Опытный гибрид', '4 д/нед', 'Спец-снаряды или фолбэк', 'Соревновательный сезон'],
    tags: ['hybrid', 'peak', 'competition', 'mock', 'events'],
    phases: [
      { weekStart: 1, weekEnd: 3, phase: 'build', title: 'Наращивание 3x2, 78-86%' },
      { weekStart: 4, weekEnd: 4, phase: 'peak', title: 'Пик 2x1, 90%' },
      { weekStart: 5, weekEnd: 5, phase: 'test', title: 'Mock-соревнование' },
      { weekStart: 6, weekEnd: 6, phase: 'taper', title: 'Тейпер' },
    ],
    taperWeeks: [6],
    mockWeeks: [5],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
