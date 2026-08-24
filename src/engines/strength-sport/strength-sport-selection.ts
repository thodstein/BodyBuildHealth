/**
 * strength-sport-selection.ts — зальный отбор для ТА/стронга (изолировано).
 * ANGLE_CLASSES, STRICT_GROUPS, tier-like фильтр, injury/mobility.
 */

// Угловые классы: одно упражнение из класса на сессию (разнообразие стимула)
export const SS_ANGLE_CLASSES: Record<string, Record<string, string[]>> = {
  snatch_day: {
    full: ['snatch', 'hang_snatch', 'power_snatch'],
    pull: ['snatch_pull', 'clean_pull'],
    squat: ['back_squat', 'front_squat', 'overhead_squat_v2', 'snatch_balance'],
    accessory: ['muscle_snatch', 'row_bar', 'pullup'],
  },
  clean_day: {
    full: ['clean_and_jerk', 'hang_clean', 'power_clean'],
    jerk: ['push_jerk', 'split_jerk', 'push_press'],
    squat: ['front_squat', 'front_squat_clean_grip', 'back_squat'],
    pull: ['clean_pull', 'snatch_pull'],
  },
  overhead_day: {
    press: ['log_press', 'ohp', 'push_press', 'circus_db_press', 'push_jerk'],
    tricep: ['db_press', 'bench_bar'],
  },
  deadlift_day: {
    hinge: ['deadlift', 'sumo_dl', 'axle_deadlift', 'rdl'],
    carry: ['farmers_walk_heavy', 'yoke_walk'],
  },
  event_day: {
    carry: ['farmers_walk_heavy', 'yoke_walk', 'zercher_carry'],
    load: ['atlas_stone_load', 'stone_lift', 'sandbag_shoulder'],
    push: ['tire_flip', 'sled_push_sprint'],
  },
};

// Жёсткие группы: упражнение меняется только внутри группы
export const SS_STRICT_GROUPS: Record<string, string[]> = {
  snatch_full: ['snatch', 'hang_snatch', 'power_snatch'],
  clean_full: ['clean_and_jerk', 'hang_clean', 'power_clean'],
  jerk: ['push_jerk', 'split_jerk', 'push_press'],
  carry_heavy: ['farmers_walk_heavy', 'yoke_walk', 'zercher_carry'],
  stone: ['atlas_stone_load', 'stone_lift', 'sandbag_shoulder'],
};

export function strictGroupFor(id: string): string | null {
  for (const [g, ids] of Object.entries(SS_STRICT_GROUPS)) if (ids.includes(id)) return g;
  return null;
}

export function groupMembers(group: string): string[] {
  return SS_STRICT_GROUPS[group] || [];
}

// Tier-подобный фильтр: beginner без other/specialty и без сложных oly/стронг
const COMPLEX_IDS = new Set(['snatch', 'clean_and_jerk', 'snatch_balance', 'atlas_stone_load', 'yoke_walk', 'log_press']);

export function filterByTier(pool: string[], level: string, allowExotic?: boolean, hasSpecialty?: boolean): string[] {
  let out = [...pool];
  if (!allowExotic && level === 'beginner') out = out.filter(id => !COMPLEX_IDS.has(id));
  if (!hasSpecialty) out = out.filter(id => !['log_press','atlas_stone_load','yoke_walk','farmers_walk_heavy','circus_db_press','axle_deadlift'].includes(id));
  return out;
}

// Injury: простое правило — если injuries содержит knee/back/shoulder — убираем соответствующие паттерны
export function filterByInjury(pool: string[], injuries: any[] | undefined): string[] {
  if (!injuries || injuries.length === 0) return pool;
  const txt = JSON.stringify(injuries).toLowerCase();
  let out = [...pool];
  if (txt.includes('knee') || txt.includes('колен')) out = out.filter(id => !['back_squat','front_squat','hack_squat','bulgarian_split','squat'].includes(id));
  if (txt.includes('back') || txt.includes('спин') || txt.includes('поясниц')) out = out.filter(id => !['deadlift','sumo_dl','axle_deadlift','yoke_walk','atlas_stone_load'].includes(id));
  if (txt.includes('shoulder') || txt.includes('плеч')) out = out.filter(id => !['snatch','log_press','push_jerk','split_jerk','overhead_squat_v2'].includes(id));
  if (txt.includes('wrist') || txt.includes('запяст')) out = out.filter(id => !['clean_and_jerk','front_squat_clean_grip'].includes(id));
  return out;
}

// Diversity: выбрать по одному из каждого angle класса
export function selectDiverse(pool: string[], tag: string, count: number, favorite: Set<string>): string[] {
  const classes = SS_ANGLE_CLASSES[tag];
  if (!classes) return pool.slice(0, count);
  const chosen: string[] = [];
  const usedClass = new Set<string>();
  // сначала любимые
  const favFirst = [...pool].sort((a,b) => (favorite.has(b)?1:0)-(favorite.has(a)?1:0));
  // по классам
  for (const [cls, ids] of Object.entries(classes)) {
    if (chosen.length >= count) break;
    const cand = favFirst.find(id => ids.includes(id) && !chosen.includes(id));
    if (cand) { chosen.push(cand); usedClass.add(cls); }
  }
  // добиваем остатком
  for (const id of favFirst) {
    if (chosen.length >= count) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen.slice(0, count);
}
