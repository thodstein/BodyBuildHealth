/**
 * workmax-exercises.ts — рабочие максимумы по КОНКРЕТНЫМ упражнениям.
 * Профиль хранит веса упражнений (training.workMaxByExercise: Record<id упражнения, кг>),
 * а для совместимости с движками (BB-авто и др., ожидающими workMax по мышцам)
 * вычисляется производное поле training.workMax: Record<мышца, кг>.
 *
 * Категории = ключи мышц BB-авто (BB_WM_KEYS): chest/back/quads/hamstrings/shoulders/
 * biceps/triceps/glutes/calves/abs. В каждой — 5-7 упражнений.
 * Имена встроены (стабильны), при наличии в EXERCISE_CATALOG берётся каноническое имя
 * из каталога (fallback на встроенное).
 */

import { EXERCISE_CATALOG } from '../core/exercise-catalog';

export interface WorkMaxExerciseOption {
  id: string;
  name: string;
}

export interface WorkMaxCategory {
  id: string; // ключ мышцы (совпадает с workMax-ключами движков)
  label: string;
  icon: string;
  exercises: WorkMaxExerciseOption[];
}

const FALLBACK_NAMES: Record<string, string> = {
  // Грудь
  bench_bar: 'Жим штанги лёжа',
  bench_db: 'Жим гантелей лёжа',
  incline_bar: 'Жим штанги на наклонной (30°)',
  incline_db: 'Жим гантелей на наклонной (30°)',
  dips_chest: 'Отжимания на брусьях (грудной стиль)',
  fly_db: 'Разводка гантелей лёжа',
  pec_deck: 'Сведение в тренажёре Butterfly',
  // Спина
  deadlift: 'Становая тяга (классика)',
  pullup: 'Подтягивания (прямой хват)',
  pulldown: 'Тяга верхнего блока (прямой)',
  row_bar: 'Тяга штанги в наклоне (прямой хват)',
  row_db: 'Тяга гантели в наклоне одной рукой',
  seated_row: 'Тяга горизонтального блока',
  straight_pull: 'Пуловер в блоке прямые руки',
  // Квадрицепсы
  squat: 'Приседания со штангой',
  front_squat: 'Фронтальные приседания',
  hack_squat: 'Гакк-приседания',
  leg_press: 'Жим ногами (45°)',
  leg_ext: 'Разгибания ног в тренажёре',
  bulgarian_split: 'Болгарские сплит-приседания',
  // Бицепс бедра
  rdl: 'Румынская тяга',
  rdl_db: 'Румынская тяга с гантелями',
  leg_curl: 'Сгибания ног в тренажёре лёжа',
  leg_curl_seated: 'Сгибания ног сидя',
  good_morning: 'Гудморнинг (наклоны со штангой)',
  // Ягодицы
  hip_thrust: 'Ягодичный мост со штангой',
  glute_bridge: 'Ягодичный мост на полу',
  lunge: 'Выпады с гантелями',
  walking_lunge: 'Ходьба выпадами',
  cable_kickback: 'Отведение ноги назад в блоке',
  // Плечи
  ohp: 'Армейский жим стоя',
  db_press: 'Жим гантелей сидя',
  ohp_seated: 'Армейский жим сидя',
  push_press: 'Жимовой швунг',
  lateral_raise: 'Махи гантелями в стороны',
  cable_lateral: 'Отведение в кроссовере (снизу)',
  rear_delt_fly: 'Махи в наклоне на заднюю дельту',
  // Бицепс
  curl_bar: 'Подъём штанги на бицепс стоя',
  curl_db: 'Подъём гантелей на бицепс стоя',
  hammer_curl: 'Молотки (нейтральный хват)',
  preacher_curl: 'Подъём на скамье Скотта',
  incline_db_curl: 'Подъём гантелей на наклонной скамье',
  spider_curl: 'Паучий подъём (лёжа лицом вниз)',
  cable_curl: 'Сгибания на бицепс в блоке',
  // Трицепс
  tricep_push: 'Французский жим лёжа (EZ-гриф)',
  db_skullcrusher: 'Французский жим гантелями',
  ohp_lying: 'Жим лёжа узким хватом',
  tricep_cable: 'Разгибания на трицепс в верхнем блоке',
  rope_pushdown: 'Разгибания трицепса канатной рукояткой',
  overhead_tricep_ext: 'Разгибания из-за головы в блоке',
  dips_tricep: 'Отжимания на брусьях (трицепсовый стиль)',
  // Икры
  calf_raise: 'Подъёмы на носки стоя',
  calf_raise_seated: 'Подъёмы на носки сидя',
  calf_raise_single: 'Подъём на носки одной ногой',
  donkey_calf_raise: 'Ослячий подъём на носки',
  seated_calf: 'Подъёмы на носки сидя (в тренажёре)',
  // Пресс
  plank: 'Планка',
  ab_wheel: 'Ролик для пресса (ab wheel)',
  hanging_leg: 'Подъём ног в висе',
  knee_raise: 'Подъём коленей в висе',
  cable_crunch: 'Скручивания в верхнем блоке',
  russian_twist: 'Русский твист (с весом)',
  pallof_press: 'Паллоф-пресс (антиротация)',
};

const catalogName = (id: string): string | null => {
  const ex = EXERCISE_CATALOG.find((e) => e.id === id);
  return ex ? ex.name : null;
};

/** Имя упражнения: каноническое из каталога, fallback на встроенное. */
export const exerciseNameOf = (id: string): string =>
  catalogName(id) || FALLBACK_NAMES[id] || id;

const pick = (ids: string[]): WorkMaxExerciseOption[] =>
  ids.map((id) => ({ id, name: exerciseNameOf(id) }));

/** Категории (группы мышц) с 5-7 упражнениями каждая. */
export const WORKMAX_CATEGORIES: WorkMaxCategory[] = [
  {
    id: 'chest',
    label: 'Грудь',
    icon: '🏋️',
    exercises: pick(['bench_bar', 'bench_db', 'incline_bar', 'incline_db', 'dips_chest', 'fly_db', 'pec_deck']),
  },
  {
    id: 'back',
    label: 'Спина',
    icon: '🎣',
    exercises: pick(['deadlift', 'pullup', 'pulldown', 'row_bar', 'row_db', 'seated_row', 'straight_pull']),
  },
  {
    id: 'quads',
    label: 'Квадрицепсы',
    icon: '🦵',
    exercises: pick(['squat', 'front_squat', 'hack_squat', 'leg_press', 'leg_ext', 'bulgarian_split']),
  },
  {
    id: 'hamstrings',
    label: 'Бицепс бедра',
    icon: '🦿',
    exercises: pick(['rdl', 'rdl_db', 'leg_curl', 'leg_curl_seated', 'good_morning']),
  },
  {
    id: 'glutes',
    label: 'Ягодицы',
    icon: '🍑',
    exercises: pick(['hip_thrust', 'glute_bridge', 'lunge', 'walking_lunge', 'cable_kickback']),
  },
  {
    id: 'shoulders',
    label: 'Плечи',
    icon: '💪',
    exercises: pick(['ohp', 'db_press', 'ohp_seated', 'push_press', 'lateral_raise', 'cable_lateral', 'rear_delt_fly']),
  },
  {
    id: 'biceps',
    label: 'Бицепс',
    icon: '🏹',
    exercises: pick(['curl_bar', 'curl_db', 'hammer_curl', 'preacher_curl', 'incline_db_curl', 'spider_curl', 'cable_curl']),
  },
  {
    id: 'triceps',
    label: 'Трицепс',
    icon: '🔱',
    exercises: pick(['tricep_push', 'db_skullcrusher', 'ohp_lying', 'tricep_cable', 'rope_pushdown', 'overhead_tricep_ext', 'dips_tricep']),
  },
  {
    id: 'calves',
    label: 'Икры',
    icon: '🦶',
    exercises: pick(['calf_raise', 'calf_raise_seated', 'calf_raise_single', 'donkey_calf_raise', 'seated_calf']),
  },
  {
    id: 'abs',
    label: 'Пресс',
    icon: '🧱',
    exercises: pick(['plank', 'ab_wheel', 'hanging_leg', 'knee_raise', 'cable_crunch', 'russian_twist', 'pallof_press']),
  },
];

const CATEGORY_BY_EXERCISE: Record<string, string> = WORKMAX_CATEGORIES.reduce(
  (acc, cat) => {
    for (const ex of cat.exercises) acc[ex.id] = cat.id;
    return acc;
  },
  {} as Record<string, string>,
);

/** Мышца (ключ workMax) для упражнения. */
export const exerciseToMuscle = (exerciseId: string): string => CATEGORY_BY_EXERCISE[exerciseId] || '';

/** Сколько упражнений заполнено. */
export const countFilledWorkMaxExercises = (byExercise: Record<string, number> | undefined): number =>
  byExercise ? Object.values(byExercise).filter((v) => Number.isFinite(v) && v > 0).length : 0;

/**
 * Конвертация весов упражнений → workMax по мышцам.
 * Для каждой категории берётся МАКСИМАЛЬНЫЙ заполненный вес упражнения этой мышцы
 * (не «средний» — максимум отражает реальный потолок нагрузки);
 * если в категории ничего не заполнено — сохраняется прежнее значение (prevMuscle),
 * чтобы не затирать legacy-ввод и ввод из ББ-авто.
 */
export const exerciseWorkMaxToMuscle = (
  byExercise: Record<string, number> | undefined,
  prevMuscle: Record<string, number> | undefined = {},
): Record<string, number> => {
  const result: Record<string, number> = { ...(prevMuscle || {}) };
  if (!byExercise) return result;
  for (const cat of WORKMAX_CATEGORIES) {
    let max = 0;
    for (const ex of cat.exercises) {
      const v = byExercise[ex.id];
      if (Number.isFinite(v) && (v as number) > 0 && (v as number) > max) max = v as number;
    }
    if (max > 0) result[cat.id] = max;
  }
  return result;
};

/** Валидация категорий: 5-7 упражнений, ключи уникальны, имена непустые. */
export const validateWorkMaxCategories = (): { ok: boolean; issues: string[] } => {
  const issues: string[] = [];
  const seenIds = new Set<string>();
  for (const cat of WORKMAX_CATEGORIES) {
    if (cat.exercises.length < 5 || cat.exercises.length > 7) {
      issues.push(`${cat.label}: ${cat.exercises.length} упражнений (нужно 5-7)`);
    }
    for (const ex of cat.exercises) {
      if (!ex.name || !ex.name.trim()) issues.push(`${cat.label}: «${ex.id}» без имени`);
      if (seenIds.has(ex.id)) issues.push(`дубль упражнения «${ex.id}»`);
      seenIds.add(ex.id);
    }
  }
  return { ok: issues.length === 0, issues };
};
