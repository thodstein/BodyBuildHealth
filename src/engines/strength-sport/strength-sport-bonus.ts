/**
 * strength-sport-bonus.ts — lengthened bonus для отбора (изолировано).
 * Упражнения в растянутой позиции получают +10 к скору отбора.
 */
const LENGTHENED = new Set(['rdl','romanian','snatch_pull','clean_pull','bulgarian_split','cossack_squat','overhead_squat_v2','snatch_balance','deficit_pull','deficit_snatch','deficit_clean']);
export function lengthenedBonus(id: string): number {
  const low = id.toLowerCase();
  for (const k of LENGTHENED) if (low.includes(k)) return 10;
  return 0;
}
