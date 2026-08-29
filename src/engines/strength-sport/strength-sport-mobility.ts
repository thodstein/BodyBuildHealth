/**
 * strength-sport-mobility.ts — изолированная мобильность (не трогает bb-mobility).
 */
const RESTRICTED: Record<string, string[]> = {
  shoulder: ['snatch','hang_snatch','power_snatch','high_hang_snatch','deficit_snatch','block_snatch','pause_snatch','snatch_balance','overhead_squat_v2','log_press','push_jerk','split_jerk','pause_jerk','behind_neck_jerk','push_press'],
  hip: ['back_squat','front_squat','hack_squat','bulgarian_split','squat','overhead_squat_v2','snatch_balance','cossack_squat','pause_squat','tempo_squat'],
  knee: ['back_squat','front_squat','hack_squat','bulgarian_split','squat','cossack_squat','pause_squat','tempo_squat','snatch_balance'],
  ankle: ['overhead_squat_v2','snatch_balance','back_squat','front_squat','squat'],
  wrist: ['clean_and_jerk','front_squat_clean_grip','hang_clean','power_clean','deficit_clean','block_clean','low_block_clean','pause_clean','front_squat'],
  lower_back: ['deadlift','sumo_dl','axle_deadlift','yoke_walk','atlas_stone_load','farmers_walk_heavy','snatch_pull','clean_pull','deficit_pull','pause_pull','rdl','stone_lift','sandbag_shoulder'],
  thoracic: ['overhead_squat_v2','snatch_balance','log_press','push_jerk','split_jerk'],
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

const AXIAL_IDS_SS = new Set(['back_squat','front_squat','squat','deadlift','sumo_dl','axle_deadlift','yoke_walk','atlas_stone_load','front_squat_clean_grip','overhead_squat_v2','snatch_balance']);
export function isAxialLoadExerciseSS(id: string): boolean {
  if (AXIAL_IDS_SS.has(id)) return true;
  // гаки на бицепс бедра — не осевые (как в BB fix 1.4) — скобки обязательны
  if ((id.includes('hack') && id.includes('ham')) || id.includes('ham_curl')) return false;
  if (id.includes('squat') || id.includes('deadlift') || id.includes('pull') || id.includes('yoke') || id.includes('stone') || id.includes('carry') ) {
    return true;
  }
  return false;
}
