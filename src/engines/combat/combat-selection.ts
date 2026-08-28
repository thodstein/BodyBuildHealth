/**
 * combat-selection.ts — зальный отбор для единоборств (изолировано).
 * ANGLE_CLASSES для шеи/хвата/ротации/ног, STRICT группы.
 */

export const CB_ANGLE_CLASSES: Record<string, Record<string, string[]>> = {
  upper_power: {
    push: ['bench_bar', 'ohp', 'push_press', 'landmine_press'],
    pull: ['row_bar', 'pullup', 'fat_bar_row', 'single_arm_row', 'towel_pullup'],
    neck: ['neck_harness_ext', 'neck_lateral_flex', 'neck_flexion', 'neck_rotation'],
    grip: ['gi_grip_pullup', 'plate_pinch', 'towel_pullup', 'rope_climb'],
    prehab: ['band_external_rotation', 'band_pull_apart', 'ytw_raise', 'face_pull'],
  },
  lower_power: {
    bilateral: ['squat', 'front_squat', 'rdl', 'trap_bar_dead', 'zercher_squat', 'hip_thrust'],
    unilateral: ['bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat', 'step_up'],
    posterior: ['nordic_curl', 'glute_ham_raise', 'rdl'],
    calf: ['calf_raise'],
    carry: ['sled_push', 'sled_pull'],
  },
  full_power: {
    push: ['bench_bar', 'ohp', 'push_press'],
    pull: ['row_bar', 'pullup', 'high_pull'],
    legs: ['squat', 'rdl', 'trap_bar_dead'],
    oly: ['hang_clean', 'high_pull', 'kb_swing'],
    neck_grip: ['neck_harness_ext', 'plate_pinch'],
  },
  full_conditioning: {
    neck: ['neck_harness_ext', 'neck_lateral_flex', 'neck_flexion', 'neck_rotation', 'neck_bridge_wrestler'],
    rotation: ['landmine_rotation', 'landmine_180', 'pallof_rotation_press', 'med_ball_rot_throw', 'sledge_hammer'],
    plyo: ['box_jump', 'depth_jump', 'broad_jump', 'med_ball_slam', 'med_ball_throw'],
    grip: ['gi_grip_pullup', 'plate_pinch', 'wrist_roller', 'wrist_flexion', 'towel_pullup'],
    core_anti: ['deadbug', 'hollow_hold', 'side_plank', 'ab_wheel', 'copenhagen_plank'],
    carry: ['suitcase_carry', 'farmer_carry', 'sled_push', 'sled_pull', 'battle_rope'],
  },
  neck_grip: {
    neck: ['neck_harness_ext', 'neck_lateral_flex', 'neck_flexion', 'neck_rotation', 'neck_bridge_wrestler'],
    grip: ['gi_grip_pullup', 'plate_pinch', 'wrist_roller', 'wrist_flexion', 'wrist_extension', 'towel_pullup', 'rope_climb', 'fat_bar_row', 'farmer_carry'],
  },
};

export const CB_STRICT_GROUPS: Record<string, string[]> = {
  neck_flex: ['neck_harness_ext', 'neck_lateral_flex', 'neck_bridge_wrestler', 'neck_flexion', 'neck_rotation'],
  grip: ['gi_grip_pullup', 'plate_pinch', 'wrist_roller', 'wrist_flexion', 'wrist_extension', 'towel_pullup', 'rope_climb', 'fat_bar_row', 'farmer_carry'],
  rotation: ['landmine_rotation', 'landmine_180', 'pallof_rotation_press', 'med_ball_throw', 'med_ball_slam', 'med_ball_rot_throw', 'sledge_hammer', 'battle_rope'],
  unilateral_leg: ['bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat', 'step_up'],
  plyo: ['box_jump', 'depth_jump', 'broad_jump'],
  core_anti: ['deadbug', 'hollow_hold', 'side_plank', 'ab_wheel', 'copenhagen_plank'],
  oly: ['hang_clean', 'high_pull', 'kb_swing'],
};

export function cbStrictGroupFor(id: string): string | null {
  for (const [g, ids] of Object.entries(CB_STRICT_GROUPS)) if (ids.includes(id)) return g;
  return null;
}

export const CB_TIER: Record<string, 1|2|3|4> = {
  // tier1 база 3-6 повт, tier2 аксессуар 8-12, tier3 explosive, tier4 exotic
  bench_bar:1, squat:1, front_squat:1, rdl:1, row_bar:1, pullup:1, ohp:1, trap_bar_dead:1,
  zercher_squat:2, bulgarian_split_heavy:2, single_leg_rdl_combat:2, cossack_squat:2, step_up:2, hip_thrust:2, calf_raise:2,
  face_pull:2, single_arm_row:2, fat_bar_row:2, landmine_press:2, push_press:2, landmine_rotation:2, landmine_180:2, pallof_rotation_press:2, suitcase_carry:2, farmer_carry:2, plate_pinch:2, wrist_flexion:2, wrist_extension:2, wrist_roller:2, band_external_rotation:2, band_pull_apart:2, ytw_raise:2,
  deadbug:2, hollow_hold:2, side_plank:2, copenhagen_plank:2, neck_harness_ext:2, neck_lateral_flex:2, neck_flexion:2, neck_rotation:2,
  hang_clean:3, high_pull:3, kb_swing:3, box_jump:3, broad_jump:3, med_ball_throw:3, med_ball_slam:3, med_ball_rot_throw:3, sledge_hammer:3, battle_rope:3,
  nordic_curl:4, glute_ham_raise:4, depth_jump:4, sled_push:4, sled_pull:4, ab_wheel:4, neck_bridge_wrestler:4, rope_climb:4, towel_pullup:4,
};

export function tierForCB(id: string): 1|2|3|4 { return CB_TIER[id] ?? 2; }

export function filterByTierCB(pool: string[], level: string, hasCable?: boolean, allowExotic?: boolean): string[] {
  let out = [...pool];
  const allowT4 = allowExotic || level === 'advanced' || level === 'enhanced';
  const allowT3 = level !== 'beginner';
  if (level === 'beginner') {
    out = out.filter(id => {
      const t = tierForCB(id);
      if (t === 4) return false;
      if (t === 3) return ['box_jump','broad_jump','kb_swing'].includes(id); // только безопасный плио
      return true;
    });
  } else if (level === 'intermediate') {
    out = out.filter(id => {
      const t = tierForCB(id);
      if (t === 4 && !allowT4) return !['neck_bridge_wrestler','depth_jump'].includes(id) ? true : false;
      // intermediate без depth_jump/neck_bridge по умолчанию
      return !['neck_bridge_wrestler','depth_jump'].includes(id);
    });
  }
  if (!allowT4) out = out.filter(id => tierForCB(id) !== 4);
  else if (level === 'intermediate' && !allowExotic) out = out.filter(id => !['neck_bridge_wrestler','depth_jump'].includes(id));
  if (!hasCable) out = out.filter(id => !['pallof_rotation_press','band_external_rotation','band_pull_apart'].includes(id));
  const hasSled = hasCable;
  if (!hasSled) out = out.filter(id => !['sled_push','sled_pull'].includes(id));
  // если фильтр вырезал всё — вернуть хотя бы tier1-2
  if (out.length === 0) return pool.filter(id => tierForCB(id) <= 2).slice(0, 3);
  return out;
}

export function filterByInjuryCB(pool: string[], injuries: any[] | undefined): string[] {
  if (!injuries || injuries.length===0) return pool;
  const txt = JSON.stringify(injuries).toLowerCase();
  let out=[...pool];
  if (txt.includes('neck')||txt.includes('ше')) out = out.filter(id=>!id.includes('neck'));
  if (txt.includes('knee')||txt.includes('колен')) out = out.filter(id=>!['squat','front_squat','bulgarian_split_heavy','cossack_squat','trap_bar_dead','zercher_squat','nordic_curl','glute_ham_raise','step_up','box_jump','depth_jump','broad_jump','sled_push'].includes(id));
  if (txt.includes('shoulder')||txt.includes('плеч')) out = out.filter(id=>!['bench_bar','ohp','push_press','landmine_press','hang_clean','high_pull','band_external_rotation','ytw_raise','rope_climb'].includes(id));
  if (txt.includes('wrist')||txt.includes('запяст')||txt.includes('кист')) out = out.filter(id=>!['gi_grip_pullup','plate_pinch','wrist_roller','wrist_flexion','wrist_extension','towel_pullup','rope_climb','fat_bar_row','sledge_hammer','battle_rope'].includes(id));
  if (txt.includes('back')||txt.includes('спин')||txt.includes('поясн')) out = out.filter(id=>!['rdl','trap_bar_dead','sled_pull','deadbug','ab_wheel','hang_clean'].includes(id));
  if (txt.includes('ankle')||txt.includes('голен')||txt.includes('лодыж')) out = out.filter(id=>!['cossack_squat','calf_raise','box_jump','depth_jump'].includes(id));
  return out;
}

export function selectDiverseCB(pool: string[], tag: string, count: number, favorite: Set<string>): string[] {
  const classes = CB_ANGLE_CLASSES[tag];
  if (!classes) return pool.slice(0,count);
  const chosen: string[]=[];
  const favFirst=[...pool].sort((a,b)=> (favorite.has(b)?1:0)-(favorite.has(a)?1:0));
  for (const [cls, ids] of Object.entries(classes)) {
    if (chosen.length>=count) break;
    const cand=favFirst.find(id=> ids.includes(id) && !chosen.includes(id));
    if (cand) chosen.push(cand);
  }
  for (const id of favFirst) { if (chosen.length>=count) break; if (!chosen.includes(id)) chosen.push(id); }
  return chosen.slice(0,count);
}
