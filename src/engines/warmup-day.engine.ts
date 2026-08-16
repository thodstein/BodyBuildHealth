/**
 * Warmup Day Engine — разминка под целевые мышечные группы тренировочного дня.
 *
 * Для каждой группы (грудь/спина/квадрицепсы/бицепс бедра/ягодицы/плечи/
 * бицепс/трицепс/икры/кор) — суставная подготовка зоны (mobility) и
 * активация перед работой (activation). Композитные группы (legs/upper/
 * push/pull/fullbody/arms/lower) раскрываются в базовые.
 *
 * collectGroupPrep(groups, hasBand) — мерж с дедупликацией по id и приоритетом
 * порядка групп; ленточные упражнения заменяются bodyweight-вариантами без
 * резинки. Используется generateWarmup (warmup.engine) вместо фокус-строки.
 *
 * @module warmup-day-engine
 */

export interface WarmupPrepExercise {
  id: string;
  sets: number;
  reps: number;
  /** Требует резинку/кабель — без неё пропускается. */
  band?: boolean;
  note?: string;
}

export interface WarmupGroupPrep {
  mobility: WarmupPrepExercise[];
  activation: WarmupPrepExercise[];
}

/** Канонический порядок групп (приоритет при слиянии и для подписей). */
export const CANON_GROUP_ORDER = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'core', 'traps', 'forearms'] as const;
export type CanonGroup = typeof CANON_GROUP_ORDER[number];

export const GROUP_LABELS: Record<string, string> = {
  chest: 'грудь', back: 'спина', quads: 'квадрицепсы', hamstrings: 'бицепс бедра', glutes: 'ягодицы',
  shoulders: 'плечи', biceps: 'бицепс', triceps: 'трицепс', calves: 'икры', core: 'кор', traps: 'трапеции', forearms: 'предплечья',
};

export const WARMUP_GROUP_PREP: Record<string, WarmupGroupPrep> = {
  chest: {
    mobility: [
      { id: 'shoulder_circle', sets: 1, reps: 10, note: 'освобождает плечевой пояс' },
      { id: 'thoracic_rotation', sets: 1, reps: 8 },
      { id: 'wall_pec_stretch', sets: 1, reps: 6, note: 'растяжка груди, пауза 2-3 сек' },
    ],
    activation: [
      { id: 'pushup_light', sets: 1, reps: 8, note: 'лёгкие отжимания: грудные «включились»' },
      { id: 'wall_slide', sets: 1, reps: 10 },
    ],
  },
  back: {
    mobility: [
      { id: 'thoracic_rotation', sets: 1, reps: 8 },
      { id: 'cat_camel', sets: 1, reps: 8 },
      { id: 'hip_hinge_prep', sets: 1, reps: 8, note: 'учит разгибанию из таза' },
    ],
    activation: [
      { id: 'scapular_pull', sets: 1, reps: 8, note: 'подтягивание лопаток вниз-назад' },
      { id: 'band_pull_apart', sets: 1, reps: 12, band: true },
      { id: 'wall_slide', sets: 1, reps: 10 },
    ],
  },
  quads: {
    mobility: [
      { id: 'hip_circle', sets: 1, reps: 10 },
      { id: 'ankle_mobility', sets: 1, reps: 10 },
      { id: 'leg_swings', sets: 1, reps: 10 },
    ],
    activation: [
      { id: 'air_squat', sets: 1, reps: 10, note: 'приседания без веса, полная амплитуда' },
      { id: 'lateral_band_walk', sets: 1, reps: 8, band: true },
    ],
  },
  hamstrings: {
    mobility: [
      { id: 'hip_hinge_prep', sets: 1, reps: 8 },
      { id: 'worlds_greatest', sets: 1, reps: 5, note: 'на каждую сторону' },
    ],
    activation: [
      { id: 'glute_bridge', sets: 1, reps: 10, note: 'пауза 2 сек вверху' },
      { id: 'rdl_light', sets: 1, reps: 8, note: 'лёгкая румынская тяга: натяжение задней цепи' },
    ],
  },
  glutes: {
    mobility: [
      { id: 'hip_circle', sets: 1, reps: 10 },
      { id: '90_90_switch', sets: 1, reps: 8, note: 'переход бёдер через сед' },
    ],
    activation: [
      { id: 'glute_bridge', sets: 1, reps: 12, note: 'сжатие ягодицы вверху' },
      { id: 'banded_clam', sets: 1, reps: 12, band: true },
    ],
  },
  shoulders: {
    mobility: [
      { id: 'shoulder_circle', sets: 1, reps: 10 },
      { id: 'wall_slide', sets: 1, reps: 10 },
      { id: 'thoracic_rotation', sets: 1, reps: 8 },
    ],
    activation: [
      { id: 'external_rotation', sets: 1, reps: 12, band: true },
      { id: 'band_pull_apart', sets: 1, reps: 12, band: true },
      { id: 'ytw', sets: 1, reps: 6, note: 'Y-T-W лёжа, без веса' },
    ],
  },
  biceps: {
    mobility: [
      { id: 'arm_circles', sets: 1, reps: 10 },
      { id: 'wrist_circles', sets: 1, reps: 10 },
    ],
    activation: [
      { id: 'band_curl_light', sets: 1, reps: 12, band: true, note: 'лёгкие сгибания с резинкой' },
    ],
  },
  triceps: {
    mobility: [
      { id: 'arm_circles', sets: 1, reps: 10 },
      { id: 'wrist_circles', sets: 1, reps: 10 },
    ],
    activation: [
      { id: 'band_pushdown_light', sets: 1, reps: 12, band: true, note: 'лёгкие разгибания с резинкой' },
    ],
  },
  calves: {
    mobility: [
      { id: 'ankle_mobility', sets: 1, reps: 10 },
      { id: 'calf_stretch', sets: 1, reps: 6, note: 'пауза 3-5 сек, стопа на стену' },
    ],
    activation: [
      { id: 'calf_raise', sets: 1, reps: 15, note: 'подъёмы на носки, пауза вверху' },
    ],
  },
  core: {
    mobility: [
      { id: 'cat_camel', sets: 1, reps: 8 },
    ],
    activation: [
      { id: 'bird_dog', sets: 1, reps: 8, note: 'на каждую сторону' },
      { id: 'dead_bug', sets: 1, reps: 8 },
    ],
  },
  traps: {
    mobility: [
      { id: 'shoulder_circle', sets: 1, reps: 10 },
      { id: 'neck_cars', sets: 1, reps: 5, note: 'медленно, полный круг' },
    ],
    activation: [
      { id: 'scapular_pull', sets: 1, reps: 10 },
    ],
  },
  forearms: {
    mobility: [
      { id: 'wrist_circles', sets: 1, reps: 10 },
    ],
    activation: [
      { id: 'wrist_flex_ext', sets: 1, reps: 10, note: 'сгибание-разгибание кисти, без веса' },
    ],
  },
};

/** Композитные группы → базовые. */
const COMPOSITE_GROUPS: Record<string, CanonGroup[]> = {
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves'],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps', 'forearms'],
  arms: ['biceps', 'triceps', 'forearms'],
  fullbody: ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'core'],
  full_body: ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'core'],
  fullbody_2: ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'core'],
};

const GROUP_SYNONYMS: Record<string, string> = {
  'грудь': 'chest', 'спина': 'back', 'ноги': 'legs', 'низ': 'lower', 'верх': 'upper', 'плечи': 'shoulders',
  'руки': 'arms', 'бицепс': 'biceps', 'трицепс': 'triceps', 'икры': 'calves', 'пресс': 'core', 'кор': 'core',
  'ягодицы': 'glutes', 'квадрицепсы': 'quads', 'квадры': 'quads', 'задняя': 'hamstrings', 'бицепс бедра': 'hamstrings',
  'грудные': 'chest', 'широчайшие': 'back', 'трапеции': 'traps', 'предплечья': 'forearms',
};

/** Паттерны каталога упражнений → канонические группы. */
const PATTERN_TO_GROUP: Record<string, CanonGroup[]> = {
  press_compound: ['chest', 'shoulders', 'triceps'], hor_push: ['chest'], inc_push: ['chest'], decl_push: ['chest'],
  dip_push: ['chest', 'triceps'], vert_push: ['shoulders', 'triceps'], ohp_var: ['shoulders'],
  vert_pull: ['back', 'biceps'], hor_pull: ['back', 'biceps'], lat_iso: ['back'], erector_iso: ['back'], low_back_iso: ['back'],
  squat: ['quads', 'glutes'], squat_var: ['quads'], squat_compound: ['quads', 'glutes'], lunge: ['quads', 'glutes'], lunge_var: ['quads'],
  quad_iso: ['quads'], leg_iso: ['quads', 'hamstrings'], hip_hinge: ['hamstrings', 'glutes'], ham_iso: ['hamstrings'],
  glute_compound: ['glutes'], glute_iso: ['glutes'],
  delt_iso: ['shoulders'], front_delt_iso: ['shoulders'], lat_delt_iso: ['shoulders'], rear_delt_iso: ['shoulders'], rear_iso: ['shoulders'],
  bicep_curl: ['biceps'], bicep_curl_iso: ['biceps'], bicep_iso: ['biceps'], arm_iso: ['biceps', 'triceps'], ab_iso: ['biceps', 'triceps'],
  tricep_compound: ['triceps'], tricep_iso: ['triceps'], tricep_long: ['triceps'], tricep_pushdown: ['triceps'],
  calf_iso: ['calves'], core_compound: ['core'], core_iso: ['core'], core_flex: ['core'], core_anti_ext: ['core'],
  core_rot: ['core'], core_stab: ['core'], trap_iso: ['traps'], forearm_iso: ['forearms'], wrist_curl: ['forearms'], wrist_ext: ['forearms'],
  neck_iso: ['traps'],
};

function canonicalize(g: string): CanonGroup[] {
  const key = String(g || '').trim().toLowerCase();
  if (!key) return [];
  if (COMPOSITE_GROUPS[key]) return COMPOSITE_GROUPS[key];
  if (GROUP_SYNONYMS[key]) return canonicalize(GROUP_SYNONYMS[key]);
  if (PATTERN_TO_GROUP[key]) return PATTERN_TO_GROUP[key];
  if (CANON_GROUP_ORDER.includes(key as CanonGroup)) return [key as CanonGroup];
  return [];
}

/** Нормализация группы дня → канонические группы (общая для warmup/cooldown). */
export function canonicalizeGroups(g: string): CanonGroup[] {
  return canonicalize(g);
}

/** Разминка для набора групп дня: мерж с дедупликацией, приоритетом и фильтром ленты. */
export function collectGroupPrep(groups: string[], hasBand = true): WarmupGroupPrep {
  const seenMob = new Set<string>();
  const seenAct = new Set<string>();
  const mobility: WarmupPrepExercise[] = [];
  const activation: WarmupPrepExercise[] = [];
  for (const g of groups) {
    for (const canon of canonicalize(g)) {
      const prep = WARMUP_GROUP_PREP[canon];
      if (!prep) continue;
      for (const ex of prep.mobility) {
        if (ex.band && !hasBand) continue;
        if (seenMob.has(ex.id)) continue;
        seenMob.add(ex.id);
        mobility.push(ex);
      }
      for (const ex of prep.activation) {
        if (ex.band && !hasBand) continue;
        if (seenAct.has(ex.id)) continue;
        seenAct.add(ex.id);
        activation.push(ex);
      }
    }
  }
  // Лимит объёма: не больше 7 суставных и 5 активационных упражнений
  return {
    mobility: mobility.slice(0, 7),
    activation: activation.slice(0, 5),
  };
}

/** Русские подписи групп для заметки блока («подготовка: грудь, спина»). */
export function prepGroupLabels(groups: string[]): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const g of groups) {
    for (const canon of canonicalize(g)) {
      if (seen.has(canon)) continue;
      seen.add(canon);
      labels.push(GROUP_LABELS[canon] || canon);
    }
  }
  return labels.join(', ');
}
