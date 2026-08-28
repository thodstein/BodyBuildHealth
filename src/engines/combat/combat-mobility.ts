/**
 * combat-mobility.ts — изолированная мобильность для единоборств.
 */
const RESTRICTED: Record<string, string[]> = {
  shoulder: ['bench_bar','ohp','pullup','gi_grip_pullup','push_press','landmine_press','hang_clean','high_pull','towel_pullup','rope_climb','band_external_rotation'],
  hip: ['cossack_squat','bulgarian_split_heavy','step_up','zercher_squat'],
  knee: ['squat','front_squat','bulgarian_split_heavy','cossack_squat','trap_bar_dead','zercher_squat','nordic_curl','box_jump','depth_jump','broad_jump','sled_push'],
  neck: ['neck_bridge_wrestler','neck_harness_ext','neck_flexion','neck_rotation','neck_lateral_flex'],
  wrist: ['gi_grip_pullup','plate_pinch','wrist_roller','wrist_flexion','wrist_extension','towel_pullup','rope_climb','fat_bar_row','sledge_hammer','battle_rope','pullup'],
  lower_back: ['deadlift','rdl','trap_bar_dead','suitcase_carry','farmer_carry','sled_pull','deadbug','ab_wheel','hang_clean','high_pull'],
  ankle: ['cossack_squat','calf_raise','box_jump','depth_jump','broad_jump','sled_push'],
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
