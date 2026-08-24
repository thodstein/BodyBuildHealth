/**
 * strength-sport-specialization.ts — специализация зала (изолировано).
 * Фокус 1 лифт/ивент → ×1.25 объём, остальные ×0.9 (как bb-specialization 1.2/0.85).
 */
export type Focus = 'snatch' | 'clean' | 'squat' | 'overhead' | 'carry' | 'stone' | null;

export function volumeMultForExercise(id: string, focus: Focus): number {
  if (!focus) return 1;
  const map: Record<string, string[]> = {
    snatch: ['snatch','hang_snatch','power_snatch','muscle_snatch','snatch_pull','snatch_balance','overhead_squat_v2'],
    clean: ['clean_and_jerk','hang_clean','power_clean','muscle_clean','clean_pull','push_jerk','split_jerk'],
    squat: ['back_squat','front_squat','squat','hack_squat','leg_press'],
    overhead: ['log_press','ohp','push_press','circus_db_press','push_jerk'],
    carry: ['farmers_walk_heavy','yoke_walk','zercher_carry','sled_push_sprint'],
    stone: ['atlas_stone_load','stone_lift','sandbag_shoulder'],
  };
  const foc = map[focus] || [];
  if (foc.includes(id)) return 1.25;
  // если фокус выбран — остальные чуть ниже
  return 0.92;
}

export function isFocusExercise(id: string, focus: Focus): boolean {
  if (!focus) return false;
  return volumeMultForExercise(id, focus) > 1;
}
