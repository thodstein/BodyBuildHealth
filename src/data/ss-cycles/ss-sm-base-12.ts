/**
 * ss-sm-base-12.ts — Стронг база 12 недель (4 д/нед, волны 3+1).
 * Обезличенный аналог открытой 12-недельной стронг-программы (4 дня:
 * Пн жим стоя/взятие, Вт присед, Чт жим+йок, Сб тяга+ивенты).
 * Нед.1-5 закодированы дословно по недельным раскладкам источника
 * (пирамиды фронтального 55/65/75 и 65/75/85, тяга 80% 5x5 → дефицит
 * 85% 6x2 → блок 75% AMRAP, делод 60%); нед.6-12 — повтор волн 3+1
 * по правилу самого источника (+2.5-5кг на присед/тягу каждую 4-ю неделю).
 * Подстановки источника: front carry→мешок, тяга в наклоне→блок, AMRAP,
 * подтягивания→резина (удвоить повторы — см. howItWorks).
 * Источник: открытая 12-week beginner strongman program (Scribd).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const pressAccessories = (): SSExerciseSpec[] => [
  ex('pullup', 'Подтягивания (или резина ×2 повторы)', 'back', 0.6, [s(0, 5, 5)], { bodyweight: true }),
  ex('face_pull', 'Протяжка к лицу', 'shoulders', 0.4, [s(0.30, 20, 5)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
  ex('ohp', 'Жим сидя с пола (Z-press)', 'shoulders', 0.7, [s(0.50, 8, 2)]),
  ex('lateral_raise', 'Подъёмы через стороны 3-направления', 'shoulders', 0.4, [s(0.15, 10, 3)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
  ex('hammer_curl', 'Молотки', 'shoulders', 0.4, [s(0.20, 12, 3)], { base: 'bench', role: 'accessory' }),
  ex('tricep_pushdown', 'Трицепс на блоке', 'shoulders', 0.4, [s(0.15, 20, 3)], { base: 'bench', role: 'accessory' }),
];

const legFinisher = (): SSExerciseSpec[] => [
  ex('rdl', 'Наклоны/GHR (задняя цепь)', 'legs', 0.6, [s(0.40, 8, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
  ex('ab_rollout', 'Ролик для пресса', 'accessory', 0.3, [s(0, 8, 3)], { bodyweight: true, role: 'accessory' }),
];

// bump — шаг правила источника (+2.5кг ≈ +0.025 к % приседа/тяги каждую волну)
function monday(w: number, bump: number): SSDaySpec {
  if (w === 1) return day('overhead_day', 'тяж',
    ex('clean_and_jerk', 'Взятие + жим (Clean & Press) 6x3', 'olympic', 1.3, [s(0.75, 3, 6)]),
    ...pressAccessories());
  if (w === 2) return day('overhead_day', 'тяж',
    ex('clean_and_jerk', 'Взятие + жим 80-85% 5x5', 'olympic', 1.3, [s(0.80, 5, 3), s(0.85, 5, 2)]),
    ex('pullup', 'Подтягивания 5x8', 'back', 0.6, [s(0, 8, 5)], { bodyweight: true }),
    ex('face_pull', 'Протяжка к лицу', 'shoulders', 0.4, [s(0.30, 20, 5)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
    ex('ohp', 'Жим сидя с пола (Z-press)', 'shoulders', 0.7, [s(0.50, 8, 2)]),
    ex('lateral_raise', 'Подъёмы 3-направления', 'shoulders', 0.4, [s(0.15, 10, 3)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
    ex('hammer_curl', 'Молотки', 'shoulders', 0.4, [s(0.20, 12, 3)], { base: 'bench', role: 'accessory' }),
    ex('tricep_pushdown', 'Трицепс на блоке', 'shoulders', 0.4, [s(0.15, 20, 3)], { base: 'bench', role: 'accessory' }));
  if (w === 3) return day('overhead_day', 'тяж',
    ex('ohp', 'Жим стоя со стоек x5', 'shoulders', 1.2, [s(0.78 + bump, 5, 3)]),
    ex('pullup', 'Подтягивания 5x10', 'back', 0.6, [s(0, 10, 5)], { bodyweight: true }),
    ex('face_pull', 'Протяжка к лицу', 'shoulders', 0.4, [s(0.30, 20, 5)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
    ex('ohp', 'Жим сидя с пола (Z-press)', 'shoulders', 0.7, [s(0.50, 8, 2)]),
    ex('lateral_raise', 'Подъёмы 3-направления', 'shoulders', 0.4, [s(0.15, 10, 3)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
    ex('hammer_curl', 'Молотки', 'shoulders', 0.4, [s(0.20, 12, 3)], { base: 'bench', role: 'accessory' }),
    ex('tricep_pushdown', 'Трицепс на блоке', 'shoulders', 0.4, [s(0.15, 20, 3)], { base: 'bench', role: 'accessory' }));
  if (w === 4) return day('overhead_day', 'лёг',
    ex('ohp', 'Жим со стоек 60% 3x5 (делод)', 'shoulders', 0.8, [s(0.60, 5, 3)]),
    ex('rope_climb', 'Канат x5', 'back', 0.5, [s(0, 1, 5)], { bodyweight: true, role: 'accessory' }),
    ex('pullup', 'Подтягивания 3x5', 'back', 0.5, [s(0, 5, 3)], { bodyweight: true }),
    ex('face_pull', 'Протяжка к лицу 3x20', 'shoulders', 0.4, [s(0.30, 20, 3)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
    ex('db_press', 'Жим гантелей сидя 3x10', 'shoulders', 0.6, [s(0.50, 10, 3)], { base: 'bench', role: 'accessory' }));
  // Волна 2 (нед.5 показана в источнике, нед.6-7 — её продолжением)
  return day('overhead_day', 'тяж',
    ex('clean_and_jerk', 'Взятие + жим 75-85% 3x3', 'olympic', 1.3, [s(0.75, 3, 1), s(0.80, 3, 1), s(0.85, 3, 1)]),
    ...pressAccessories());
}

function tuesday(w: number, bump: number): SSDaySpec {
  const waveW = w <= 4 ? w : w <= 8 ? w - 4 : w - 8; // 1..3 build, 4 делод — волны повторяются
  const paused = waveW === 1
    ? [s(0.55, 5, 1), s(0.65, 5, 1), s(0.75, 5, 1)]
    : waveW === 2 ? [s(0.60, 3, 1), s(0.70, 3, 1), s(0.80, 3, 1)]
    : [s(0.65, 5, 1), s(0.75, 3, 1), s(0.85, 1, 1)];
  const bsq = waveW === 4 ? [s(0.60, 5, 5)]
    : waveW === 1 ? [s(0.65 + bump, 8, 2)]
    : waveW === 2 ? [s(0.70 + bump, 8, 2)]
    : [s(0.75 + bump, 8, 2)];
  if (waveW === 4) {
    return day('squat_day', 'лёг',
      ex('back_squat', 'Присед 60% 5x5 (делод)', 'legs', 0.8, bsq),
      ex('bulgarian_split', 'Выпады с весом тела 2x50м', 'legs', 0.4, [s(0, 20, 2)], { bodyweight: true, role: 'accessory' }),
      ex('sled_push_sprint', 'Сани/покрышка 5x25м', 'strongman', 0.5, [s(0.55, 1, 5, { distanceM: 25 })]),
      ex('plank', 'Планка 3x60с', 'accessory', 0.2, [s(0, 60, 3)], { bodyweight: true, role: 'accessory' }));
  }
  const carry = waveW === 2
    ? ex('sandbag_carry', 'Фронтальная переноска 2x50м', 'strongman', 0.8, [s(0.65, 1, 2, { distanceM: 50, timeCapS: 90 })])
    : ex('tire_flip', 'Покрышка 2x25м', 'strongman', 0.9, [s(0.70, 1, 2, { distanceM: 25, timeCapS: 60 })]);
  return day('squat_day', 'тяж',
    ex('front_squat', 'Фронтальный с паузой (пирамида)', 'legs', 1.2, paused),
    ex('back_squat', 'Присед задний 2x8', 'legs', 1.2, bsq),
    carry,
    ex('bulgarian_split', 'Выпады со штангой', 'legs', 0.6, [s(0.30, waveW === 1 ? 8 : 10, 3)], { base: 'backSquat', role: 'accessory' }),
    ...(waveW === 3
      ? [ex('sled_push_sprint', 'Сани/покрышка 5x50м, отдых 2 мин', 'strongman', 0.7, [s(0.65, 1, 5, { distanceM: 50, timeCapS: 120 })])]
      : [ex('sled_drag', 'Тяга покрышки спиной 2x25м', 'strongman', 0.6, [s(0.60, 1, 2, { distanceM: 25, timeCapS: 60 })])]),
    ex('plank', 'Планка с весом 3x60с', 'accessory', 0.3, [s(0, 60, 3)], { bodyweight: true, role: 'accessory' }));
}

function thursday(w: number, _bump: number): SSDaySpec {
  const waveW = w <= 4 ? w : w <= 8 ? w - 4 : w - 8;
  if (waveW === 4) {
    return day('overhead_day', 'лёг',
      ex('db_press', 'Жим гантелей наклонный 2x20', 'shoulders', 0.5, [s(0.50, 20, 2)], { base: 'bench', role: 'accessory' }),
      ex('row_db', 'Тяга гантели 2x20', 'back', 0.4, [s(0.25, 20, 2)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
      ex('hammer_curl', 'Молотки 3x12', 'shoulders', 0.3, [s(0.20, 12, 3)], { base: 'bench', role: 'accessory' }),
      ex('db_shrug', 'Шраги 3x12', 'back', 0.3, [s(0.40, 12, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
      ex('tricep_pushdown', 'Трицепс 3x15', 'shoulders', 0.3, [s(0.15, 15, 3)], { base: 'bench', role: 'accessory' }),
      ex('farmers_walk_heavy', 'Фермер 5x25м', 'strongman', 0.6, [s(0.65, 1, 5, { distanceM: 25, timeCapS: 60 })]));
  }
  const ohpSets = waveW === 1 ? [s(0.60, 10, 5)] : waveW === 2 ? [s(0.62, 10, 4)] : [s(0.65, 8, 5)];
  const dbSets = waveW === 1 ? [s(0.55, 15, 2)] : waveW === 2 ? [s(0.55, 10, 4)] : [s(0.55, 12, 3)];
  const rowSets = waveW === 1 ? [s(0.30, 15, 2)] : waveW === 2 ? [s(0.30, 10, 4)] : [s(0.30, 12, 3)];
  return day('overhead_day', 'тяж',
    ex('ohp', 'Жим стоя строго', 'shoulders', 1.1, ohpSets),
    ex('yoke_walk', 'Йок 5x25м', 'strongman', 1.1, [s(0.75, 1, 5, { distanceM: 25, timeCapS: 60 })]),
    ex('db_press', 'Жим гантелей наклонный', 'shoulders', 0.7, dbSets, { base: 'bench', role: 'accessory' }),
    ex('row_db', 'Тяга гантели', 'back', 0.6, rowSets, { base: 'deadlift', baseMult: 1, role: 'accessory' }),
    ex('hammer_curl', 'Молотки 3x12', 'shoulders', 0.4, [s(0.20, 12, 3)], { base: 'bench', role: 'accessory' }),
    ex('db_shrug', 'Шраги 3x10-12', 'back', 0.4, [s(0.40, 12, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
    ex('tricep_pushdown', 'Трицепс 3x15', 'shoulders', 0.4, [s(0.15, 15, 3)], { base: 'bench', role: 'accessory' }));
}

function saturday(w: number, bump: number): SSDaySpec {
  if (w === 4 || w === 8 || w === 12) {
    return day('deadlift_day', 'лёг',
      ex('deadlift', 'Тяга 60% 3x5 (делод)', 'back', 0.8, [s(0.60, 5, 3)]),
      ...legFinisher(),
      ex('atlas_stone_load', 'Мяч/камень переноска 25м 3x8', 'strongman', 0.5, [s(0.55, 1, 3, { distanceM: 25, timeCapS: 60 })]));
  }
  if (w === 1 || w === 5 || w === 9) {
    return day('deadlift_day', 'тяж',
      ex('deadlift', `Тяга ${(0.80 + bump).toFixed(2)} 5x5`, 'back', 1.4, [s(0.80 + bump, 5, 5)]),
      ex('farmers_walk_heavy', 'Движущийся ивент 2x50м', 'strongman', 1.0, [s(0.75, 1, 2, { distanceM: 50, timeCapS: 60 })]),
      ex('atlas_stone_load', 'Загрузка 5x2 на 50"', 'strongman', 1.1, [s(0.70, 2, 5, { timeCapS: 60 })]),
      ...legFinisher());
  }
  if (w === 2 || w === 6 || w === 10) {
    return day('deadlift_day', 'тяж',
      ex('deadlift', `Тяга с дефицита ${(0.85 + bump).toFixed(2)} 6x2`, 'back', 1.4, [s(0.85 + bump, 2, 6)]),
      ex('farmers_walk_heavy', 'Движущийся ивент 2x50м (быстро)', 'strongman', 1.0, [s(0.78, 1, 2, { distanceM: 50, timeCapS: 45 })]),
      ex('atlas_stone_load', 'Загрузка 2xAMRAP 45с', 'strongman', 1.1, [s(0.75, 3, 2, { timeCapS: 45 })]),
      ...legFinisher());
  }
  return day('deadlift_day', 'тяж',
    ex('deadlift', `Тяга с блоков ${(0.75 + bump).toFixed(2)} AMRAP`, 'back', 1.4, [s(0.75 + bump, 5, 1, { amrap: true })]),
    ex('farmers_walk_heavy', 'Движущийся ивент 3x25м (быстро)', 'strongman', 1.0, [s(0.80, 1, 3, { distanceM: 25, timeCapS: 30 })]),
    ex('atlas_stone_load', 'Мяч на макс. высоту x5 (лёгкий)', 'strongman', 1.0, [s(0.70, 1, 5, { timeCapS: 60 })]),
    ...legFinisher());
}

function buildWeek(w: number): SSDaySpec[] {
  // Шаг правила источника: +2.5-5кг на присед/тягу каждую 4-ю неделю
  const bump = w <= 4 ? 0 : w <= 8 ? 0.025 : 0.05;
  const waveW = w <= 4 ? w : w <= 8 ? w - 4 : w - 8;
  return [monday(waveW === 4 && w > 4 ? 4 : (w === 5 ? 5 : waveW), bump), tuesday(w, bump), thursday(w, bump), saturday(w, bump)];
}

const weeks: SSDaySpec[][] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(buildWeek);

export const SS_SM_BASE_12: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-base-12',
    title: 'Стронг база 4×/нед — 12 недель (волны 3+1)',
    mode: 'strongman',
    weeks: 12,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate'],
    period: 'mixed',
    correctionPct: 0,
    equipment: ['barbell', 'dumbbell'],
    needsSpecialty: true,
    description: 'Пн взятие+жим, Вт присед с паузой + покрышка, Чт жим + йок, Сб тяга + движущийся/загрузочный ивенты. Волны 3+1 с делодом 60%; шаг +2.5-5кг на присед/тягу каждую волну. Нед.1-5 дословно, нед.6-12 — по правилу источника.',
    howItWorks: 'Пирамиды фронтального 55/65/75 → 60/70/80 → 65/75/85 (5/3/1); тяга 80% 5x5 → дефицит 85% 6x2 → блок 75% AMRAP; суперсеты 2a/2b идут последовательно; подтягивания→резина с удвоением повторов.',
    conditions: ['Штанга + гантели как минимум', 'Покрышка/йок/фермер желательны (иначе фолбэк)', '4 д/нед'],
    tags: ['strongman', 'beginner', 'waves', 'deload', 'events'],
    phases: [
      { weekStart: 1, weekEnd: 3, phase: 'base', title: 'Волна 1 (дословно)' },
      { weekStart: 4, weekEnd: 4, phase: 'deload', title: 'Делод 60%' },
      { weekStart: 5, weekEnd: 7, phase: 'build', title: 'Волна 2 (+шаг)' },
      { weekStart: 8, weekEnd: 8, phase: 'deload', title: 'Делод 60%' },
      { weekStart: 9, weekEnd: 11, phase: 'peak', title: 'Волна 3 (+2 шага)' },
      { weekStart: 12, weekEnd: 12, phase: 'deload', title: 'Делод 60%' },
    ],
    deloadWeeks: [4, 8, 12],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
