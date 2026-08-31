/**
 * combat-mobility.ts — изолированная мобильность для единоборств.
 */
const RESTRICTED: Record<string, string[]> = {
  shoulder: ['bench_bar','ohp','pullup','gi_grip_pullup','push_press','landmine_press','hang_clean','high_pull','towel_pullup','rope_climb','band_external_rotation'],
  hip: ['cossack_squat','bulgarian_split_heavy','single_leg_rdl_combat','step_up','zercher_squat'],
  knee: ['squat','front_squat','bulgarian_split_heavy','cossack_squat','trap_bar_dead','zercher_squat','nordic_curl','glute_ham_raise','box_jump','depth_jump','broad_jump','sled_push'],
  neck: ['neck_bridge_wrestler','neck_harness_ext','neck_flexion','neck_rotation','neck_lateral_flex'],
  wrist: ['gi_grip_pullup','plate_pinch','wrist_roller','wrist_flexion','wrist_extension','towel_pullup','rope_climb','fat_bar_row','sledge_hammer','battle_rope','pullup'],
  lower_back: ['deadlift','rdl','single_leg_rdl_combat','trap_bar_dead','sled_pull','hang_clean','high_pull','sledge_hammer'],
  ankle: ['cossack_squat','calf_raise','box_jump','depth_jump','broad_jump','sled_push','single_leg_rdl_combat'],
};
export function isMobilityRestrictedCB(exId: string, restrictions: string[] | undefined): boolean {
  if (!restrictions || restrictions.length===0) return false;
  for (const r of restrictions) {
    const list = RESTRICTED[r.toLowerCase()] || [];
    if (list.includes(exId)) return true;
  }
  return false;
}
export function filterByMobilityCB(pool: string[], restrictions: string[] | undefined): string[] {
  if (!restrictions || restrictions.length===0) return pool;
  return pool.filter(id => !isMobilityRestrictedCB(id, restrictions));
}

const AXIAL_IDS_CB = new Set(['squat','front_squat','trap_bar_dead','zercher_squat','hang_clean','high_pull','yoke_walk','farmer_carry','farmers_walk_heavy','atlas_stone_load','log_press','yoke','stone','farmers_walk']);
export function isAxialLoadExerciseCB(id: string): boolean {
  // core явно не осевые — исключаем до проверки dead/squat
  if (['deadbug','ab_wheel','hollow_hold','side_plank','copenhagen_plank','deadbug','suitcase_carry','pallof_rotation_press','plate_pinch'].includes(id)) return false;
  if (AXIAL_IDS_CB.has(id)) return true;
  const low = id.toLowerCase();
  // осевая компрессия: присед/тяга + тяж. переноски/камни/йок (JSI >2.5×BW)
  if ((low.includes('squat') || low.includes('dead') || low.includes('yoke') || low.includes('stone') || low.includes('atlas') || low.includes('log_press')) && !low.includes('bug')) return true;
  // carry: farmer/yoke тяжёлые — осевые; suitcase — нет (односторонний anti-lateral)
  if (low.includes('carry')) {
    if (low.includes('suitcase')) return false;
    if (low.includes('farmer') || low.includes('farmers') || low.includes('yoke') || low.includes('sled')) return low.includes('farmer') || low.includes('farmers') || low.includes('yoke') ? true : low.includes('sled') ? true : false;
  }
  if (low.includes('farmer') || low.includes('farmers') || low.includes('yoke')) return true;
  return false;
}
