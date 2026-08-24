/**
 * combat-selection.ts — зальный отбор для единоборств (изолировано).
 * ANGLE_CLASSES для шеи/хвата/ротации/ног, STRICT группы.
 */

export const CB_ANGLE_CLASSES: Record<string, Record<string, string[]>> = {
  upper_power: {
    push: ['bench_bar', 'ohp'],
    pull: ['row_bar', 'pullup'],
    neck: ['neck_harness_ext', 'neck_lateral_flex'],
    grip: ['gi_grip_pullup', 'plate_pinch'],
  },
  lower_power: {
    bilateral: ['squat', 'front_squat', 'rdl'],
    unilateral: ['bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat'],
    calf: ['calf_raise'],
  },
  full_conditioning: {
    neck: ['neck_harness_ext', 'neck_lateral_flex', 'neck_bridge_wrestler'],
    rotation: ['landmine_rotation', 'landmine_180', 'pallof_rotation_press'],
    grip: ['gi_grip_pullup', 'plate_pinch', 'wrist_roller'],
    carry: ['suitcase_carry'],
  },
};

export const CB_STRICT_GROUPS: Record<string, string[]> = {
  neck_flex: ['neck_harness_ext', 'neck_lateral_flex', 'neck_bridge_wrestler'],
  grip: ['gi_grip_pullup', 'plate_pinch', 'wrist_roller'],
  rotation: ['landmine_rotation', 'landmine_180', 'pallof_rotation_press', 'med_ball_throw'],
  unilateral_leg: ['bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat'],
};

export function cbStrictGroupFor(id: string): string | null {
  for (const [g, ids] of Object.entries(CB_STRICT_GROUPS)) if (ids.includes(id)) return g;
  return null;
}

export function filterByTierCB(pool: string[], level: string, hasCable?: boolean): string[] {
  let out = [...pool];
  if (level === 'beginner') out = out.filter(id => id !== 'neck_bridge_wrestler');
  if (!hasCable) out = out.filter(id => id !== 'pallof_rotation_press');
  return out;
}

export function filterByInjuryCB(pool: string[], injuries: any[] | undefined): string[] {
  if (!injuries || injuries.length===0) return pool;
  const txt = JSON.stringify(injuries).toLowerCase();
  let out=[...pool];
  if (txt.includes('neck')||txt.includes('ше')) out = out.filter(id=>!id.includes('neck'));
  if (txt.includes('knee')||txt.includes('колен')) out = out.filter(id=>!['squat','front_squat','bulgarian_split_heavy','cossack_squat'].includes(id));
  if (txt.includes('shoulder')||txt.includes('плеч')) out = out.filter(id=>!['bench_bar','ohp'].includes(id));
  if (txt.includes('wrist')||txt.includes('запяст')||txt.includes('кист')) out = out.filter(id=>!['gi_grip_pullup','plate_pinch','wrist_roller'].includes(id));
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
