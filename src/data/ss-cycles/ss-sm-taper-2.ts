/**
 * ss-sm-taper-2.ts — Стронг тейпер к старту, 2 недели (4 д/нед).
 * Острый тейпер стронгмена: объём срезан, интенсивность сохранена, ивенты —
 * на opener-весах (репетиция). Нед.1 — 85% 2x2 лог/становая + фермер 85%;
 * нед.2 — opener 90% синглы + камни легко, свежесть.
 * Источник: открытые тейпер-протоколы стронгмена (Winwood 2014/Sports Med 2026).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

function buildWeek(w: number): SSDaySpec[] {
  const opener = w === 2;
  const c = opener ? 0.90 : 0.85;
  const ev = opener ? 0.90 : 0.85;
  return [
    day('overhead_day', 'тяж',
      ex('log_press', opener ? 'Лог-жим — opener 90% (репетиция)' : 'Лог-жим 85% (объём срезан)', 'strongman', 1.4, [s(c, opener ? 1 : 2, 2)]),
      ex('axle_press', 'Аксель-жим (поддержание)', 'strongman', 1.0, [s(Math.max(0.70, c - 0.12), 2, 2)], { role: 'accessory' }),
    ),
    day('deadlift_day', 'тяж',
      ex('deadlift', opener ? 'Становая — opener 90%' : 'Становая 85% (объём срезан)', 'back', 1.4, [s(c, opener ? 1 : 2, 2)]),
      ex('axle_deadlift', 'Аксель-становая (поддержание)', 'strongman', 1.0, [s(Math.max(0.68, c - 0.12), 2, 2)], { role: 'accessory' }),
    ),
    day('event_day', 'тяж',
      ex('farmers_walk_heavy', `Фермер 20м @${Math.round(ev * 100)}% (opener)`, 'strongman', 1.2, [s(ev, 1, opener ? 2 : 3, { distanceM: 20, timeCapS: 60 })]),
      ex('yoke_walk', `Йок 20м @${Math.round(ev * 100)}%`, 'strongman', 1.1, [s(Math.max(0.72, ev - 0.08), 1, opener ? 1 : 2, { distanceM: 20, timeCapS: 60 })]),
      ex('atlas_stone_load', opener ? 'Камень — легко (техника)' : 'Камень 2x2 (объём срезан)', 'strongman', 1.0, [s(Math.max(0.62, ev - 0.15), 2, opener ? 1 : 2, { timeCapS: 60 })]),
    ),
    day('squat_day', 'памп',
      ex('front_squat', 'Фронтальный присед (поддержание)', 'legs', 1.1, [s(opener ? 0.75 : 0.80, 2, 2)]),
      ex('back_squat', 'Присед (лёгкий)', 'legs', 1.0, [s(opener ? 0.70 : 0.75, 2, 2)]),
      ex('plank_walkout', 'Планка-ходьба (кор)', 'legs', 0.3, [s(0, 10, 2)], { bodyweight: true, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 2 }, (_, i) => buildWeek(i + 1));

export const SS_SM_TAPER_2: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-taper-2',
    title: 'Стронг тейпер к старту — 2 недели (4 д/нед)',
    mode: 'strongman',
    weeks: 2,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'peak',
    correctionPct: 0,
    equipment: ['barbell', 'log', 'yoke', 'farmers', 'stone'],
    needsSpecialty: true,
    description: 'Острый тейпер: объём срезан, интенсивность сохранена, ивенты на opener-весах. Нед.1 — 85% 2x2 + фермер/йок 85%; нед.2 — opener 90% синглы + камни легко. Без максимумов.',
    howItWorks: 'Каждая неделя = 4 дня: лог / становая / ивенты / ноги-лёгкие. Объём падает, % держатся (85→90%). Ставится последним блоком перед стартом (Winwood/cessation).',
    conditions: ['Знать ПМ лога/тяги/ивентов', '4 д/нед', 'Последний блок перед стартом', 'Спец-снаряды или фолбэк'],
    tags: ['taper', 'peak', 'competition', 'opener', 'log', 'events'],
    phases: [
      { weekStart: 1, weekEnd: 1, phase: 'peak', title: 'Нед −2: 85% 2x2, объём срезан' },
      { weekStart: 2, weekEnd: 2, phase: 'taper', title: 'Нед −1: opener 90%, свежесть' },
    ],
    taperWeeks: [2],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
