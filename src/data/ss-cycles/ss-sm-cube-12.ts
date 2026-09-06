/**
 * ss-sm-cube-12.ts — Стронг Куб 12 недель (4 д/нед).
 * Обезличенный аналог открытой Cube-методики для стронга:
 * ротация Heavy / Explosive / Rep по трём столпам (присед / жим стоя /
 * тяга) — в неделю только ОДИН день тяжелее 85%; ивенты ротируются
 * (фермер/йок/камни + agility-футворк). Три 3-недельные волны с ростом
 * нагрузки и срезом повторов + делод (нед.10) + mock (нед.11) + тейпер (нед.12).
 * Источник: открытые материалы Cube Method for Strongman.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

type Style = 'heavy' | 'explosive' | 'rep';
// Ротация стилей внутри волны: [присед, жим, тяга]
const ROT: Style[][] = [
  ['heavy', 'explosive', 'rep'],
  ['explosive', 'rep', 'heavy'],
  ['rep', 'heavy', 'explosive'],
];
// Нагрузка по волне (0,1,2) и стилю
function styleSets(style: Style, wave: number): SSSetSpec[] {
  const bump = wave * 0.03;
  if (style === 'heavy') return [s(0.85 + bump, wave === 2 ? 1 : 3, wave === 2 ? 5 : 4)];
  if (style === 'explosive') return [s(Math.min(0.72, 0.62 + bump), 2, 8)];
  return [s(Math.min(0.82, 0.72 + bump), wave === 2 ? 6 : 8, 3)];
}

const EVENTS: Array<{ id: string; name: string }> = [
  { id: 'farmers_walk_heavy', name: 'Фермер' },
  { id: 'yoke_walk', name: 'Йок' },
  { id: 'atlas_stone_load', name: 'Камни' },
];

function buildWeek(w: number): SSDaySpec[] {
  // Нед.10 делод, нед.11 mock, нед.12 тейпер
  if (w === 10) {
    return [
      day('squat_day', 'лёг',
        ex('back_squat', 'Присед 60% (делод)', 'legs', 0.8, [s(0.60, 5, 3)]),
        ex('front_squat', 'Фронтальный 55%', 'legs', 0.7, [s(0.55, 5, 2)]),
      ),
      day('overhead_day', 'лёг',
        ex('log_press', 'Лог 60% (делод)', 'strongman', 0.8, [s(0.60, 5, 3)]),
        ex('ohp', 'Жим стоя 55%', 'shoulders', 0.6, [s(0.55, 5, 2)]),
      ),
      day('deadlift_day', 'лёг',
        ex('deadlift', 'Тяга 60% (делод)', 'back', 0.8, [s(0.60, 5, 3)]),
      ),
      day('event_day', 'лёг',
        ex('sandbag_carry', 'Мешок лёгкий (футворк)', 'strongman', 0.6, [s(0.55, 1, 3, { distanceM: 20, timeCapS: 60 })]),
      ),
    ];
  }
  if (w === 11) {
    return [
      day('squat_day', 'тяж',
        ex('back_squat', 'Присед — проходка', 'legs', 1.4, [s(0.90, 1, 2), s(0.95, 1, 1)]),
        ex('deadlift', 'Тяга — проходка', 'back', 1.4, [s(0.90, 1, 2), s(0.95, 1, 1)]),
      ),
      day('overhead_day', 'тяж',
        ex('log_press', 'Лог — проходка', 'strongman', 1.4, [s(0.90, 1, 2), s(0.95, 1, 1)]),
      ),
      day('event_day', 'тяж',
        ex('farmers_walk_heavy', 'Mock: фермер 60с', 'strongman', 1.2, [s(0.80, 1, 1, { distanceM: 20, timeCapS: 60 })]),
        ex('yoke_walk', 'Mock: йок 60с', 'strongman', 1.2, [s(0.80, 1, 1, { distanceM: 20, timeCapS: 60 })]),
        ex('atlas_stone_load', 'Mock: камни 60с', 'strongman', 1.1, [s(0.80, 2, 1, { timeCapS: 60 })]),
      ),
      day('deadlift_day', 'лёг',
        ex('face_pull', 'Плечи — восстановление', 'shoulders', 0.3, [s(0.30, 15, 3)], { base: 'overheadPress', baseMult: 1 }),
        ex('plank', 'Кор — восстановление', 'accessory', 0.2, [s(0, 30, 2)], { bodyweight: true }),
      ),
    ];
  }
  if (w === 12) {
    return [
      day('squat_day', 'лёг',
        ex('back_squat', 'Присед 80% (тейпер)', 'legs', 0.9, [s(0.80, 3, 2)]),
        ex('front_squat', 'Фронтальный 75%', 'legs', 0.8, [s(0.75, 3, 2)]),
      ),
      day('overhead_day', 'лёг',
        ex('log_press', 'Лог 80% (тейпер)', 'strongman', 0.9, [s(0.80, 3, 2)]),
      ),
      day('event_day', 'лёг',
        ex('farmers_walk_heavy', 'Фермер ≤70% (тейпер)', 'strongman', 0.7, [s(0.65, 1, 2, { distanceM: 20 })]),
        ex('atlas_stone_load', 'Камни ≤70% (тейпер)', 'strongman', 0.7, [s(0.65, 2, 2, { timeCapS: 60 })]),
      ),
      day('deadlift_day', 'лёг',
        ex('deadlift', 'Тяга 80% (без максимумов)', 'back', 0.9, [s(0.80, 2, 2)]),
      ),
    ];
  }
  const wave = Math.floor((w - 1) / 3); // 0,1,2
  const rot = ROT[(w - 1) % 3];
  const ev = EVENTS[(w - 1) % 3];
  const ev2 = EVENTS[w % 3];
  return [
    day('squat_day', rot[0] === 'explosive' ? 'памп' : 'тяж',
      ex('back_squat', `Присед — ${rot[0] === 'heavy' ? 'тяжёлый' : rot[0] === 'explosive' ? 'скоростной' : 'повторный'}`, 'legs', 1.3, styleSets(rot[0], wave)),
      ex('front_squat', 'Фронтальный (подсобка)', 'legs', 0.9, [s(0.65, 5, 3)]),
      ex('box_jump', 'Футворк: прыжки/шаги (agility)', 'legs', 0.4, [s(0, 5, 3)], { bodyweight: true }),
    ),
    day('overhead_day', rot[1] === 'explosive' ? 'памп' : 'тяж',
      ex('log_press', `Лог — ${rot[1] === 'heavy' ? 'тяжёлый' : rot[1] === 'explosive' ? 'скоростной' : 'повторный'}`, 'strongman', 1.3, styleSets(rot[1], wave)),
      ex('ohp', 'Жим стоя (подсобка)', 'shoulders', 0.9, [s(0.68, 6, 3)]),
      ex('pin_press', 'Дожим (локаут)', 'shoulders', 0.7, [s(0.62, 8, 3)], { base: 'bench' }),
    ),
    day('deadlift_day', rot[2] === 'explosive' ? 'памп' : 'тяж',
      ex('deadlift', `Тяга — ${rot[2] === 'heavy' ? 'тяжёлая' : rot[2] === 'explosive' ? 'скоростная' : 'повторная'}`, 'back', 1.3, styleSets(rot[2], wave)),
      ex('rdl', 'Румынская (задняя цепь)', 'legs', 0.7, [s(0.60, 8, 3)]),
    ),
    day('event_day', 'тяж',
      ex(ev.id, `${ev.name} — ротация недели`, 'strongman', 1.2, [s(0.75 + wave * 0.03, 1, 4, { distanceM: 20, timeCapS: 60 })]),
      ex(ev2.id, `${ev2.name} — второй ивент`, 'strongman', 1.0, [s(0.70 + wave * 0.03, 1, 3, { distanceM: 20, timeCapS: 60 })]),
      ex('atlas_stone_load', 'Камни/мешок — загрузка', 'strongman', 0.9, [s(0.70, 2, 3, { timeCapS: 60 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(buildWeek);

export const SS_SM_CUBE_12: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-cube-12',
    title: 'Стронг Куб — 12 недель (4 д/нед)',
    mode: 'strongman',
    weeks: 12,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced', 'enhanced'],
    period: 'mixed',
    correctionPct: 0,
    equipment: ['barbell', 'log', 'yoke', 'stone'],
    needsSpecialty: true,
    description: 'Куб-ротация: присед/лог/тяга ходят по Heavy/Explosive/Rep (в неделю лишь один день >85%). Ивенты ротируются фермер/йок/камни + agility. Волны 1-9 с ростом, нед.10 делод, нед.11 mock, нед.12 тейпер.',
    howItWorks: 'Стиль недели по таблице ROT; нагрузка растёт по волнам (+3%/волна, повторы падают). Без снарядов — фолбэк с бейджем (йок→фермер).',
    conditions: ['Стаж от года', '4 д/нед', 'Знать 1ПМ трёх столпов'],
    tags: ['cube', 'rotation', 'strongman', 'events', 'mock', 'taper'],
    phases: [
      { weekStart: 1, weekEnd: 3, phase: 'base', title: 'Волна 1' },
      { weekStart: 4, weekEnd: 6, phase: 'build', title: 'Волна 2 (+3%)' },
      { weekStart: 7, weekEnd: 9, phase: 'build', title: 'Волна 3 (+6%)' },
      { weekStart: 10, weekEnd: 10, phase: 'deload', title: 'Делод 55-60%' },
      { weekStart: 11, weekEnd: 11, phase: 'peak', title: 'Mock-соревнование' },
      { weekStart: 12, weekEnd: 12, phase: 'taper', title: 'Тейпер 80%, ивенты ≤70%' },
    ],
    deloadWeeks: [10],
    taperWeeks: [12],
    mockWeeks: [11],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
