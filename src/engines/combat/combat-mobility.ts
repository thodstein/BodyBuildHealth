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

const AXIAL_IDS_CB = new Set(['squat','front_squat','trap_bar_dead','zercher_squat','hang_clean','high_pull']);
export function isAxialLoadExerciseCB(id: string): boolean {
  // core явно не осевые — исключаем до проверки dead/squat
  if (['deadbug','ab_wheel','hollow_hold','side_plank','copenhagen_plank','deadbug'].includes(id)) return false;
  if (AXIAL_IDS_CB.has(id)) return true;
  // dead — но не deadbug (уже исключён)
  if ((id.includes('squat') || id.includes('dead') || id.includes('yoke') || id.includes('stone')) && !id.includes('bug')) return true;
  if (id.includes('carry') && !['suitcase_carry','farmer_carry','deadbug','ab_wheel'].includes(id)) {
    // carry с нагрузкой может быть осевым, но suitcase/farmer — удержание, не осевая компрессия позвоночника как squat
    return id.includes('sled');
  }
  return false;
}
