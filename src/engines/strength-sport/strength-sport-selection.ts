/**
 * strength-sport-selection.ts — зальный отбор для ТА/стронга (изолировано).
 * ANGLE_CLASSES, STRICT_GROUPS, tier-like фильтр, injury/mobility.
 */

// Угловые классы: одно упражнение из класса на сессию — PRO: покрытие всех 11 тегов
export const SS_ANGLE_CLASSES: Record<string, Record<string, string[]>> = {
  snatch_day: {
    full: ['snatch', 'hang_snatch', 'power_snatch', 'high_hang_snatch', 'deficit_snatch', 'block_snatch', 'pause_snatch'],
    pull: ['snatch_pull', 'pause_pull', 'deficit_pull', 'clean_pull'],
    squat: ['back_squat', 'front_squat', 'overhead_squat_v2', 'snatch_balance', 'tempo_squat', 'pause_squat'],
    accessory: ['muscle_snatch', 'row_bar', 'pullup'],
  },
  clean_day: {
    full: ['clean_and_jerk', 'hang_clean', 'power_clean', 'deficit_clean', 'block_clean', 'low_block_clean', 'pause_clean'],
    jerk: ['push_jerk', 'split_jerk', 'pause_jerk', 'push_press', 'jerk_recovery', 'behind_neck_jerk'],
    squat: ['front_squat', 'front_squat_clean_grip', 'back_squat', 'tempo_squat', 'pause_squat'],
    pull: ['clean_pull', 'pause_pull', 'snatch_pull', 'deficit_pull'],
  },
  overhead_day: {
    press: ['log_press', 'axle_press', 'ohp', 'push_press', 'circus_db_press', 'push_jerk', 'pause_jerk', 'pin_press'],
    tricep: ['db_press', 'bench_bar', 'pin_press'],
    carry: ['farmers_walk_heavy', 'zercher_carry', 'husafell_carry'],
  },
  deadlift_day: {
    hinge: ['deadlift', 'sumo_dl', 'axle_deadlift', 'car_deadlift_18', 'rdl', 'deficit_pull', 'pause_pull'],
    carry: ['farmers_walk_heavy', 'yoke_walk', 'zercher_carry', 'frame_carry', 'husafell_carry'],
    pull: ['row_bar', 'pullup', 'snatch_pull', 'clean_pull'],
  },
  event_day: {
    carry: ['farmers_walk_heavy', 'yoke_walk', 'zercher_carry', 'frame_carry', 'husafell_carry', 'sandbag_carry'],
    load: ['atlas_stone_load', 'stone_lift', 'sandbag_shoulder', 'sandbag_load', 'keg_toss'],
    push: ['tire_flip', 'sled_push_sprint', 'car_deadlift_18'],
  },
  strength_day: {
    squat: ['back_squat', 'front_squat', 'pause_squat', 'tempo_squat', 'hack_squat'],
    hinge: ['deadlift', 'sumo_dl', 'rdl', 'axle_deadlift'],
    press: ['bench_bar', 'ohp', 'pin_press', 'db_press', 'push_press'],
    pull: ['row_bar', 'pullup', 'snatch_pull', 'clean_pull'],
  },
  squat_day: {
    squat: ['squat', 'back_squat', 'front_squat', 'hack_squat', 'pause_squat', 'tempo_squat', 'overhead_squat_v2'],
    accessory: ['bulgarian_split', 'calf_raise', 'leg_press'],
  },
  pull_day: {
    pull: ['snatch_pull', 'clean_pull', 'pause_pull', 'deficit_pull', 'rdl', 'deadlift'],
    row: ['row_bar', 'row_db', 'pullup'],
  },
  accessory_day: {
    press: ['db_press', 'ohp', 'lateral_raise', 'face_pull'],
    squat: ['pause_squat', 'tempo_squat', 'hip_thrust'],
    pull: ['row_db', 'pullup'],
  },
  technique_day: {
    full: ['hang_snatch', 'hang_clean', 'high_hang_snatch', 'muscle_snatch', 'muscle_clean'],
    balance: ['snatch_balance', 'overhead_squat_v2', 'jerk_dip'],
    pause: ['pause_snatch', 'pause_clean', 'pause_jerk'],
  },
  oly_day: {
    snatch: ['snatch', 'hang_snatch', 'power_snatch', 'deficit_snatch', 'block_snatch', 'pause_snatch'],
    clean: ['clean_and_jerk', 'hang_clean', 'power_clean', 'deficit_clean', 'block_clean'],
    squat: ['back_squat', 'front_squat', 'overhead_squat_v2', 'snatch_balance'],
    jerk: ['push_jerk', 'split_jerk', 'pause_jerk', 'push_press'],
  },
};

// Жёсткие группы: упражнение меняется только внутри группы — PRO расширение 10→12
export const SS_STRICT_GROUPS: Record<string, string[]> = {
  snatch_full: ['snatch', 'hang_snatch', 'power_snatch', 'deficit_snatch', 'block_snatch', 'pause_snatch'],
  clean_full: ['clean_and_jerk', 'hang_clean', 'power_clean', 'deficit_clean', 'block_clean', 'pause_clean'],
  jerk: ['push_jerk', 'split_jerk', 'push_press', 'jerk_recovery', 'behind_neck_jerk'],
  carry_heavy: ['farmers_walk_heavy', 'yoke_walk', 'zercher_carry', 'frame_carry', 'husafell_carry', 'sandbag_carry', 'shield_carry', 'duck_walk'],
  carry_drag: ['truck_pull', 'arm_over_arm', 'sled_drag', 'sled_push', 'sled_push_sprint'],
  stone: ['atlas_stone_load', 'atlas_stone_over_bar', 'stone_lift', 'sandbag_shoulder', 'sandbag_load', 'sandbag_over_bar', 'natural_stone_shoulder', 'keg_over_bar', 'keg_load', 'tire_flip', 'keg_toss', 'circus_db_medley'],
  squat: ['back_squat', 'front_squat', 'front_squat_clean_grip', 'hack_squat', 'overhead_squat_v2', 'pause_squat'],
  press_overhead_log: ['log_press', 'axle_press', 'push_press', 'ohp', 'viking_press'],
  press_db: ['circus_db_press', 'circus_db_medley', 'db_press', 'bench_bar'],
  pull: ['snatch_pull', 'clean_pull', 'pause_pull', 'rdl', 'deficit_pull'],
  deadlift_variant: ['deadlift', 'sumo_dl', 'axle_deadlift', 'car_deadlift_18', 'car_deadlift_side', 'deadlift_max'],
  overhead_medley: ['log_press', 'axle_press', 'viking_press', 'circus_db_press'],
};

export function strictGroupFor(id: string): string | null {
  for (const [g, ids] of Object.entries(SS_STRICT_GROUPS)) if (ids.includes(id)) return g;
  return null;
}

export function groupMembers(group: string): string[] {
  return SS_STRICT_GROUPS[group] || [];
}

// Tier-фильтр PRO: beginner — только power/muscle вариации, не классика
const COMPLEX_IDS = new Set(['snatch', 'clean_and_jerk', 'snatch_balance', 'atlas_stone_load', 'atlas_stone_over_bar', 'yoke_walk', 'log_press', 'axle_press', 'car_deadlift_18', 'frame_carry', 'husafell_carry', 'sandbag_load', 'keg_toss', 'deficit_snatch', 'block_snatch', 'pause_snatch', 'high_hang_snatch', 'deficit_clean', 'block_clean', 'low_block_clean', 'pause_clean', 'pause_jerk', 'tempo_squat', 'conan_wheel', 'truck_pull', 'viking_press', 'natural_stone_shoulder']);
const EXOTIC_STRONG = new Set(['log_press','axle_press','atlas_stone_load','atlas_stone_over_bar','yoke_walk','farmers_walk_heavy','circus_db_press','axle_deadlift','tire_flip','stone_lift','sandbag_shoulder','husafell_carry','frame_carry','sandbag_load','sandbag_over_bar','keg_toss','keg_over_bar','car_deadlift_18','car_deadlift_side','conan_wheel','shield_carry','truck_pull','arm_over_arm','viking_press','natural_stone_shoulder','circus_db_medley']);

export function filterByTier(pool: string[], level: string, allowExotic?: boolean, hasSpecialty?: boolean): string[] {
  let out = [...pool];
  if (!allowExotic) {
    if (level === 'beginner') {
      // beginner WL: только power/muscle, без классики и блоков
      out = out.filter(id => !['snatch','clean_and_jerk','snatch_balance','deficit_snatch','block_snatch','pause_snatch','high_hang_snatch','deficit_clean','block_clean','low_block_clean','pause_clean','pause_jerk','atlas_stone_over_bar','conan_wheel','truck_pull','viking_press','natural_stone_shoulder'].includes(id));
      // но оставляем хотя бы одно если всё вырезано — power_snatch/muscle_snatch
      if (out.length === 0) out = pool.filter(id => ['power_snatch','muscle_snatch','power_clean','muscle_clean','hang_snatch','hang_clean'].includes(id));
    }
    else if (level === 'intermediate') out = out.filter(id => !['yoke_walk','atlas_stone_load','atlas_stone_over_bar','log_press','snatch_balance','conan_wheel','truck_pull'].includes(id));
  }
  if (!hasSpecialty) out = out.filter(id => !EXOTIC_STRONG.has(id));
  return out;
}

// Injury: P1 graded vs exclude — только exclude удаляет, graded идёт через gentleFactor 0.6
export function filterByInjury(pool: string[], injuries: any[] | undefined): string[] {
  if (!injuries || injuries.length === 0) return pool;
  const hasExclude = injuries.some((it:any)=>{
    if(typeof it === 'string') return it.toLowerCase().includes('исключ') || it.toLowerCase().includes('exclude') || it.includes('⛔');
    return it?.exclude === true || it?.type === 'exclude' || String(it?.severity||'').toLowerCase()==='high' || String(it?.mode||'').toLowerCase()==='exclude';
  });
  if (!hasExclude) return pool;
  // точный парсинг локаций без ложных kneeling и т.п. — разбиваем по словам
  const txt = JSON.stringify(injuries).toLowerCase();
  const hasWord = (w: string) => new RegExp(`\\b${w}\\b`).test(txt);
  let out = [...pool];
  if (hasWord('knee') || txt.includes('колен') || txt.includes('мениск') || txt.includes('acl')) out = out.filter(id => !['back_squat','front_squat','hack_squat','bulgarian_split','squat','overhead_squat_v2','snatch_balance','pause_squat','tempo_squat'].includes(id));
  if (hasWord('back') || txt.includes('спин') || txt.includes('поясниц')) out = out.filter(id => !['deadlift','sumo_dl','axle_deadlift','car_deadlift_18','yoke_walk','frame_carry','husafell_carry','atlas_stone_load','sandbag_load','sandbag_shoulder','keg_toss','snatch_pull','clean_pull','deficit_pull','pause_pull','rdl'].includes(id));
  if (hasWord('shoulder') || txt.includes('плеч')) out = out.filter(id => !['snatch','deficit_snatch','block_snatch','pause_snatch','high_hang_snatch','log_press','push_jerk','split_jerk','overhead_squat_v2','jerk_recovery','behind_neck_jerk','push_press','snatch_balance'].includes(id));
  if (hasWord('wrist') || txt.includes('запяст')) out = out.filter(id => !['clean_and_jerk','front_squat_clean_grip','hang_clean','power_clean','deficit_clean','block_clean','low_block_clean','pause_clean'].includes(id));
  return out;
}

// Diversity: выбрать по одному из каждого angle класса
export function selectDiverse(pool: string[], tag: string, count: number, favorite: Set<string>): string[] {
  const classes = SS_ANGLE_CLASSES[tag];
  if (!classes) {
    const withBonus = [...pool].sort((a,b) => {
      const fav = (favorite.has(b)?1:0) - (favorite.has(a)?1:0);
      if (fav !== 0) return fav;
      const lb = (id:string)=> ['rdl','snatch_pull','clean_pull','bulgarian','cossack','overhead_squat','snatch_balance','deficit'].some(k=> id.includes(k)) ? 10 : 0;
      return lb(b) - lb(a);
    });
    return withBonus.slice(0, count);
  }
  const chosen: string[] = [];
  const favFirst = [...pool].sort((a,b) => {
    const fav = (favorite.has(b)?1:0)-(favorite.has(a)?1:0);
    if (fav!==0) return fav;
    const lb = (id:string)=> ['rdl','snatch_pull','clean_pull','bulgarian','cossack','overhead_squat','snatch_balance','deficit'].some(k=> id.includes(k)) ? 10 : 0;
    return lb(b)-lb(a);
  });
  for (const [cls, ids] of Object.entries(classes)) {
    if (chosen.length >= count) break;
    const cand = favFirst.find(id => ids.includes(id) && !chosen.includes(id));
    if (cand) { chosen.push(cand); }
  }
  for (const id of favFirst) {
    if (chosen.length >= count) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen.slice(0, count);
}
