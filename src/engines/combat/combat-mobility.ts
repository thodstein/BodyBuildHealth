/**
 * combat-mobility.ts — изолированная мобильность для единоборств.
 */
const RESTRICTED: Record<string, string[]> = {
  shoulder: ['bench_bar','ohp','pullup','gi_grip_pullup'],
  hip: ['cossack_squat','bulgarian_split_heavy'],
  knee: ['squat','front_squat','bulgarian_split_heavy','cossack_squat'],
  neck: ['neck_bridge_wrestler'],
  wrist: ['gi_grip_pullup','plate_pinch','wrist_roller','pullup'],
  lower_back: ['deadlift','rdl','suitcase_carry'],
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
