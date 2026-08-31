/**
 * strength-sport-mobility.ts — изолированная мобильность (не трогает bb-mobility).
 */
const RESTRICTED: Record<string, string[]> = {
  shoulder: ['snatch','hang_snatch','power_snatch','high_hang_snatch','deficit_snatch','block_snatch','pause_snatch','snatch_balance','overhead_squat_v2','log_press','axle_press','push_jerk','split_jerk','pause_jerk','behind_neck_jerk','push_press','circus_db_press','keg_toss'],
  hip: ['back_squat','front_squat','hack_squat','bulgarian_split','squat','overhead_squat_v2','snatch_balance','cossack_squat','pause_squat','tempo_squat','car_deadlift_18'],
  knee: ['back_squat','front_squat','hack_squat','bulgarian_split','squat','cossack_squat','pause_squat','tempo_squat','snatch_balance','car_deadlift_18'],
  ankle: ['overhead_squat_v2','snatch_balance','back_squat','front_squat','squat','car_deadlift_18'],
  wrist: ['clean_and_jerk','front_squat_clean_grip','hang_clean','power_clean','deficit_clean','block_clean','low_block_clean','pause_clean','front_squat','axle_press','circus_db_press'],
  lower_back: ['deadlift','sumo_dl','axle_deadlift','car_deadlift_18','yoke_walk','frame_carry','husafell_carry','atlas_stone_load','sandbag_load','farmers_walk_heavy','snatch_pull','clean_pull','deficit_pull','pause_pull','rdl','stone_lift','sandbag_shoulder','keg_toss'],
  thoracic: ['overhead_squat_v2','snatch_balance','log_press','axle_press','push_jerk','split_jerk'],
};
export function isMobilityRestricted(exId: string, restrictions: string[] | undefined): boolean {
  if (!restrictions || restrictions.length===0) return false;
  for (const r of restrictions) {
    const list = RESTRICTED[r.toLowerCase()] || RESTRICTED[r] || [];
    if (list.includes(exId)) return true;
  }
  return false;
}
export function filterByMobility(pool: string[], restrictions: string[] | undefined): string[] {
  if (!restrictions || restrictions.length===0) return pool;
  return pool.filter(id => !isMobilityRestricted(id, restrictions));
}

const AXIAL_HIGH_SS = new Set(['back_squat','front_squat','squat','deadlift','sumo_dl','axle_deadlift','car_deadlift_18','yoke_walk','atlas_stone_load','sandbag_load','front_squat_clean_grip','overhead_squat_v2','snatch_balance']);
const AXIAL_LOW_SS = new Set(['farmers_walk_heavy','frame_carry','husafell_carry','sandbag_carry','zercher_carry','sandbag_shoulder','keg_toss','stone_lift']);
export function isAxialLoadExerciseSS(id: string): boolean {
  if (AXIAL_HIGH_SS.has(id)) return true;
  if (AXIAL_LOW_SS.has(id)) return false; // low axial — не режем при грыже
  if ((id.includes('hack') && id.includes('ham')) || id.includes('ham_curl')) return false;
  if (id.includes('squat') || id.includes('deadlift') || id.includes('pull') ) return true;
  if (id.includes('yoke') || id.includes('stone') || id === 'atlas_stone_load' || id === 'sandbag_load') return true;
  return false;
}
export function isAxialHighLoadSS(id: string): boolean { return AXIAL_HIGH_SS.has(id) || id.includes('yoke') || id.includes('atlas_stone'); }
