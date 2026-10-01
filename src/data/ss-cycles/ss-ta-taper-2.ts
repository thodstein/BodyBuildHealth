/**
 * ss-ta-taper-2.ts — ТА тейпер к старту, 2 недели (4 д/нед).
 * Профессиональный острый тейпер: объём срезан, интенсивность сохранена
 * (Bosquet 2005/Winwood): нед.1 — 2x2 85% классика + 3x2 присед;
 * нед.2 — opener-синглы 90% (репетиция старта), минимальный объём.
 * Без максимумов, без отказа.
 * Источник: открытые тейпер-протоколы ТА (2-недельный острый тейпер).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

function buildWeek(w: number): SSDaySpec[] {
  const opener = w === 2;
  const c = opener ? 0.90 : 0.85;
  const sq = opener ? 0.75 : 0.80;
  const reps = opener ? 1 : 2;
  const sets = opener ? 2 : 2;
  return [
    day('snatch_day', 'тяж',
      ex('snatch', opener ? 'Рывок — opener 90% (репетиция старта)' : 'Рывок 85% (объём срезан)', 'olympic', 1.4, [s(c, reps, opener ? 1 : sets), s(Math.max(0.70, c - 0.10), 2, opener ? 1 : sets)]),
      ex('snatch_pull', 'Рывковая тяга (короткая)', 'olympic', 1.0, [s(0.88, 2, 2)]),
      ex('back_squat', 'Присед (поддержание)', 'legs', 1.2, [s(sq, 2, sets)]),
    ),
    day('clean_day', 'тяж',
      ex('clean_and_jerk', opener ? 'Толчок — opener 90% (репетиция старта)' : 'Толчок 85% (объём срезан)', 'olympic', 1.4, [s(c, reps, opener ? 1 : sets), s(Math.max(0.70, c - 0.10), 2, opener ? 1 : sets)]),
      ex('clean_pull', 'Толчковая тяга (короткая)', 'olympic', 1.0, [s(0.88, 2, 2)]),
      ex('front_squat', 'Фронтальный присед (поддержание)', 'legs', 1.1, [s(Math.max(0.68, sq - 0.05), 2, 2)]),
    ),
    day('technique_day', 'памп',
      ex('power_snatch', 'Рывок силовой (скорость)', 'olympic', 1.0, [s(0.70, 2, 2)]),
      ex('power_clean', 'Взятие силовое (скорость)', 'olympic', 1.0, [s(0.70, 2, 2)]),
      ex('jerk_dip', 'Полуприсед толчковый (техника)', 'olympic', 0.6, [s(0.75, 3, 2)], { role: 'accessory' }),
    ),
    day('accessory_day', 'памп',
      ex('back_squat', 'Присед (лёгкий)', 'legs', 1.0, [s(Math.max(0.60, sq - 0.15), 2, 2)]),
      ex('overhead_squat_v2', 'Присед оверхед (подвижность)', 'legs', 0.7, [s(0.50, 2, 2)], { role: 'accessory' }),
      ex('face_pull', 'Тяга к лицу (плечо)', 'shoulders', 0.4, [s(0.30, 12, 2)], { base: 'overheadPress', baseMult: 0.4, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 2 }, (_, i) => buildWeek(i + 1));

export const SS_TA_TAPER_2: SSCycleTemplate = {
  meta: {
    id: 'ss-ta-taper-2',
    title: 'ТА тейпер к старту — 2 недели (4 д/нед)',
    mode: 'weightlifting',
    weeks: 2,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'peak',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'Острый тейпер: объём срезан, интенсивность сохранена. Нед.1 — 85% 2x2 + присед 3x2; нед.2 — opener-синглы 90% (репетиция старта), минимальный объём. Без максимумов и отказа.',
    howItWorks: 'Каждая неделя = 4 дня: рывок / толчок / техника-power / присед-лёгкий. Объём падает, % держатся (85→90%), RIR высокий. Ставится последним блоком сезона перед стартом.',
    conditions: ['Знать ПМ классики', '4 д/нед', 'Последний блок перед стартом'],
    tags: ['taper', 'peak', 'competition', 'opener', 'snatch', 'clean-jerk'],
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
