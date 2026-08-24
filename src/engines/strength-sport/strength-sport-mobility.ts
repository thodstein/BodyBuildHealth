/**
 * strength-sport-mobility.ts — изолированная мобильность (не трогает bb-mobility).
 */
const RESTRICTED: Record<string, string[]> = {
  shoulder: ['snatch','hang_snatch','power_snatch','snatch_balance','overhead_squat_v2','log_press','push_jerk','split_jerk'],
  hip: ['deep_squat','cossack_squat','bulgarian_split','hack_squat'],
  knee: ['back_squat','front_squat','hack_squat','bulgarian_split','squat','cossack_squat'],
  ankle: ['overhead_squat_v2','snatch_balance'],
  wrist: ['clean_and_jerk','front_squat_clean_grip','hang_clean','power_clean'],
  lower_back: ['deadlift','sumo_dl','axle_deadlift','yoke_walk','atlas_stone_load','snatch_pull','clean_pull'],
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
