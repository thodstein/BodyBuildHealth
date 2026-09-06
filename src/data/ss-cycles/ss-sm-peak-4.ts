/**
 * ss-sm-peak-4.ts — Стронг пик 4 недели (4 д/нед).
 * Короткий подводящий блок под старт: нед.1 тройки 85-90%, нед.2 синглы
 * 90-95%, нед.3 mock-соревнование (4 ивента как на старте), нед.4 тейпер
 * −50% объёма (80-85%, ивенты ≤70%). Ставится после базовых 8-12 нед.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

function buildWeek(w: number): SSDaySpec[] {
  if (w === 1) {
    return [
      day('squat_day', 'тяж',
        ex('deadlift', 'Тяга 87% 3x3', 'back', 1.4, [s(0.87, 3, 3)]),
        ex('back_squat', 'Присед 87% 3x3', 'legs', 1.2, [s(0.87, 3, 3)]),
      ),
      day('overhead_day', 'тяж',
        ex('log_press', 'Лог 87% 3x3', 'strongman', 1.4, [s(0.87, 3, 3)]),
        ex('pin_press', 'Дожим (локаут)', 'shoulders', 0.7, [s(0.78, 5, 3)], { base: 'bench', role: 'accessory' }),
      ),
      day('event_day', 'тяж',
        ex('farmers_walk_heavy', 'Фермер 3x50ft', 'strongman', 1.1, [s(0.80, 1, 3, { distanceM: 45, timeCapS: 60 })]),
        ex('atlas_stone_load', 'Камни 3x2', 'strongman', 1.1, [s(0.80, 2, 3, { timeCapS: 60 })]),
      ),
      day('deadlift_day', 'памп',
        ex('ohp', 'Жим стоя техника', 'shoulders', 0.6, [s(0.60, 6, 3)]),
        ex('row_bar', 'Тяга в наклоне', 'back', 0.6, [s(0.35, 10, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
      ),
    ];
  }
  if (w === 2) {
    return [
      day('squat_day', 'тяж',
        ex('deadlift', 'Тяга — сингл 92% + сбавки', 'back', 1.5, [s(0.90, 1, 2), s(0.92, 1, 1), s(0.85, 2, 2)]),
        ex('back_squat', 'Присед — сингл 92%', 'legs', 1.3, [s(0.90, 1, 2), s(0.92, 1, 1)]),
      ),
      day('overhead_day', 'тяж',
        ex('log_press', 'Лог — сингл 92%', 'strongman', 1.5, [s(0.90, 1, 2), s(0.92, 1, 1), s(0.85, 2, 2)]),
      ),
      day('event_day', 'тяж',
        ex('yoke_walk', 'Йок тяжёлый 2x20м', 'strongman', 1.2, [s(0.88, 1, 2, { distanceM: 20, timeCapS: 60 })]),
        ex('farmers_walk_heavy', 'Фермер тяжёлый 2x20м', 'strongman', 1.2, [s(0.88, 1, 2, { distanceM: 20, timeCapS: 60 })]),
      ),
      day('deadlift_day', 'лёг',
        ex('face_pull', 'Плечи — восстановление', 'shoulders', 0.3, [s(0.30, 15, 3)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
        ex('plank', 'Кор — восстановление', 'accessory', 0.2, [s(0, 30, 2)], { bodyweight: true, role: 'accessory' }),
      ),
    ];
  }
  if (w === 3) {
    return [
      day('squat_day', 'тяж',
        ex('deadlift', 'Mock: тяга на разы 60с', 'back', 1.3, [s(0.72, 8, 1, { timeCapS: 60 })]),
        ex('back_squat', 'Присед поддержка 85%', 'legs', 1.0, [s(0.85, 3, 2)]),
      ),
      day('overhead_day', 'тяж',
        ex('log_press', 'Mock: лог на разы 60с', 'strongman', 1.3, [s(0.68, 6, 1, { timeCapS: 60 })]),
      ),
      day('event_day', 'тяж',
        ex('farmers_walk_heavy', 'Mock: фермер на время', 'strongman', 1.2, [s(0.82, 1, 1, { distanceM: 20, timeCapS: 60 })]),
        ex('yoke_walk', 'Mock: йок на время', 'strongman', 1.2, [s(0.82, 1, 1, { distanceM: 20, timeCapS: 60 })]),
        ex('atlas_stone_load', 'Mock: камни 60с', 'strongman', 1.1, [s(0.78, 2, 1, { timeCapS: 60 })]),
      ),
      day('deadlift_day', 'лёг',
        ex('ohp', 'Жим лёгкий', 'shoulders', 0.5, [s(0.55, 8, 2)]),
      ),
    ];
  }
  return [
    day('squat_day', 'лёг',
      ex('deadlift', 'Тяга 82% (без максимумов)', 'back', 1.0, [s(0.82, 3, 2)]),
      ex('back_squat', 'Присед 82%', 'legs', 1.0, [s(0.82, 3, 2)]),
    ),
    day('overhead_day', 'лёг',
      ex('log_press', 'Лог 80% техника', 'strongman', 1.0, [s(0.80, 3, 2)]),
      ex('ohp', 'Жим стоя 55%', 'shoulders', 0.6, [s(0.55, 8, 2)]),
    ),
    day('event_day', 'лёг',
      ex('farmers_walk_heavy', 'Фермер 50% (походка)', 'strongman', 0.6, [s(0.50, 1, 2, { distanceM: 30 })]),
      ex('atlas_stone_load', 'Камни ≤70%', 'strongman', 0.6, [s(0.65, 2, 2, { timeCapS: 60 })]),
    ),
    day('deadlift_day', 'лёг',
      ex('face_pull', 'Пул-апарты', 'shoulders', 0.3, [s(0.30, 25, 2)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4].map(buildWeek);

export const SS_SM_PEAK_4: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-peak-4',
    title: 'Стронг пик — 4 недели (4 д/нед)',
    mode: 'strongman',
    weeks: 4,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'peak',
    correctionPct: 0,
    equipment: ['barbell'],
    needsSpecialty: true,
    description: 'Подводка к старту: тройки 87% → синглы 92% → mock-соревнование → тейпер −50%. Ставится после базовых 8-12 недель или соло перед стартом.',
    howItWorks: 'Нед.1 объёмные тройки, нед.2 тяжёлые синглы со сбавками, нед.3 полная симуляция (отдых между ивентами как на старте), нед.4 половина сетов 80-85%, ивенты ≤70%.',
    conditions: ['База за плечами (8+ нед)', 'Знать 1ПМ и контест-веса', '4 д/нед'],
    tags: ['strongman', 'peaking', 'mock', 'taper', 'singles'],
    phases: [
      { weekStart: 1, weekEnd: 1, phase: 'build', title: 'Тройки 87%' },
      { weekStart: 2, weekEnd: 2, phase: 'peak', title: 'Синглы 92%' },
      { weekStart: 3, weekEnd: 3, phase: 'peak', title: 'Mock-соревнование' },
      { weekStart: 4, weekEnd: 4, phase: 'taper', title: 'Тейпер −50%' },
    ],
    taperWeeks: [4],
    mockWeeks: [3],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
