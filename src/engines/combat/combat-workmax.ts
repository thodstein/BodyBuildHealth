/**
 * combat-workmax.ts — веса для единоборств из профиля (workMax).
 * Изолировано. Не трогает bb/strength-sport.
 * Логика: сначала точный workMaxByExercise[id], затем групповой workMax[muscle],
 * затем эвристика от bodyweight/дефолтов.
 */

export type CombatWorkMax = Record<string, number>;
export type CombatWorkMaxByExercise = Record<string, number>;

const DEFAULTS: Record<string, number> = {
  bench_bar: 80,
  row_bar: 70,
  squat: 90,
  front_squat: 85,
  rdl: 80,
  ohp: 50,
  pullup: 0,
  gi_grip_pullup: 0,
  face_pull: 30,
  neck_harness_ext: 10,
  neck_lateral_flex: 8,
  neck_bridge_wrestler: 0,
  plate_pinch: 0,
  landmine_rotation: 20,
  landmine_180: 20,
  pallof_rotation_press: 15,
  suitcase_carry: 24,
  med_ball_throw: 8,
  wrist_roller: 5,
  // новые
  hang_clean: 60,
  high_pull: 60,
  push_press: 55,
  trap_bar_dead: 100,
  zercher_squat: 70,
  nordic_curl: 0,
  glute_ham_raise: 0,
  step_up: 40,
  hip_thrust: 80,
  kb_swing: 24,
  box_jump: 0,
  depth_jump: 0,
  broad_jump: 0,
  med_ball_slam: 8,
  med_ball_rot_throw: 6,
  farmer_carry: 32,
  sled_push: 80,
  sled_pull: 60,
  fat_bar_row: 60,
  towel_pullup: 0,
  rope_climb: 0,
  wrist_flexion: 10,
  wrist_extension: 8,
  neck_flexion: 10,
  neck_rotation: 8,
  deadbug: 0,
  hollow_hold: 0,
  side_plank: 0,
  ab_wheel: 0,
  copenhagen_plank: 0,
  band_external_rotation: 0,
  band_pull_apart: 0,
  ytw_raise: 0,
  single_arm_row: 32,
  landmine_press: 30,
  battle_rope: 0,
  sledge_hammer: 8,
};

// маппинг combat id → ключи workMax (групповые)
const MUSCLE_FOR: Record<string, string> = {
  bench_bar: 'chest',
  row_bar: 'back',
  ohp: 'shoulders',
  pullup: 'back',
  gi_grip_pullup: 'back',
  face_pull: 'shoulders',
  squat: 'quads',
  front_squat: 'quads',
  rdl: 'hamstrings',
  bulgarian_split_heavy: 'quads',
  single_leg_rdl_combat: 'hamstrings',
  cossack_squat: 'quads',
  calf_raise: 'calves',
  neck_harness_ext: 'neck',
  neck_lateral_flex: 'neck',
  neck_bridge_wrestler: 'neck',
  neck_flexion: 'neck',
  neck_rotation: 'neck',
  plate_pinch: 'grip',
  wrist_roller: 'grip',
  wrist_flexion: 'grip',
  wrist_extension: 'grip',
  towel_pullup: 'grip',
  rope_climb: 'grip',
  fat_bar_row: 'back',
  single_arm_row: 'back',
  hang_clean: 'legs',
  high_pull: 'back',
  push_press: 'shoulders',
  trap_bar_dead: 'legs',
  zercher_squat: 'quads',
  nordic_curl: 'hamstrings',
  glute_ham_raise: 'hamstrings',
  step_up: 'quads',
  hip_thrust: 'glutes',
  landmine_rotation: 'core',
  landmine_180: 'core',
  pallof_rotation_press: 'core',
  suitcase_carry: 'core',
  farmer_carry: 'grip',
  sled_push: 'legs',
  sled_pull: 'back',
  med_ball_throw: 'core',
  med_ball_slam: 'core',
  med_ball_rot_throw: 'core',
  deadbug: 'core',
  hollow_hold: 'core',
  side_plank: 'core',
  ab_wheel: 'core',
  copenhagen_plank: 'core',
  band_external_rotation: 'shoulders',
  band_pull_apart: 'shoulders',
  ytw_raise: 'shoulders',
  landmine_press: 'shoulders',
  kb_swing: 'core',
  box_jump: 'legs',
  depth_jump: 'legs',
  broad_jump: 'legs',
  battle_rope: 'core',
  sledge_hammer: 'core',
};

// bodyweight эвристики (когда нет workMax)
const BW_COEFF: Record<string, number> = {
  squat: 1.1,
  front_squat: 1.0,
  bench_bar: 1.0,
  row_bar: 0.9,
  ohp: 0.6,
  rdl: 1.0,
  bulgarian_split_heavy: 0.5,
  single_leg_rdl_combat: 0.4,
};

export function getCombatWorkMax(
  exId: string,
  workMaxByExercise?: CombatWorkMaxByExercise | null,
  workMax?: CombatWorkMax | null,
  bodyweight?: number | null
): number | null {
  // 1) точный по упражнению
  if (workMaxByExercise) {
    // пробуем точный ключ и нормализованный lower
    const exact = workMaxByExercise[exId];
    if (typeof exact === 'number' && Number.isFinite(exact) && exact > 0) return exact;
    const low = workMaxByExercise[exId.toLowerCase()];
    if (typeof low === 'number' && Number.isFinite(low) && low > 0) return low;
  }
  // 2) групповой workMax (chest/back/quads etc)
  if (workMax) {
    const muscle = MUSCLE_FOR[exId];
    if (muscle && typeof workMax[muscle] === 'number' && workMax[muscle] > 0) {
      // для группового — применяем коэф (чтоб не отдавать присед 120 на жим)
      // но для основных — 1:1
      const coeffs: Record<string, number> = {
        chest: exId === 'bench_bar' ? 1 : 0.85,
        back: exId === 'row_bar' || exId === 'pullup' ? 1 : 0.9,
        shoulders: exId === 'ohp' ? 1 : 0.9,
        quads: exId === 'squat' || exId === 'front_squat' ? 1 : 0.85,
        hamstrings: exId === 'rdl' || exId.includes('rdl') ? 1 : 0.85,
      };
      const c = coeffs[muscle] ?? 1;
      return Math.round((workMax[muscle] * c) / 2.5) * 2.5;
    }
    // также пробуем общие ключи squat/bench/deadlift
    const alias: Record<string, string[]> = {
      bench_bar: ['bench', 'chest', 'push'],
      squat: ['squat', 'quads', 'legs'],
      front_squat: ['frontSquat', 'squat', 'quads'],
      rdl: ['deadlift', 'hamstrings', 'hinge'],
      ohp: ['overheadPress', 'shoulders', 'press'],
      row_bar: ['row', 'back'],
      pullup: ['pullup', 'back'],
    };
    const al = alias[exId];
    if (al) for (const k of al) if (typeof (workMax as any)[k] === 'number' && (workMax as any)[k] > 0) return (workMax as any)[k];
  }
  // 3) bodyweight эвристика
  if (typeof bodyweight === 'number' && Number.isFinite(bodyweight) && bodyweight > 30) {
    const coeff = BW_COEFF[exId];
    if (coeff) return Math.round((bodyweight * coeff) / 2.5) * 2.5;
  }
  // 4) дефолт
  if (DEFAULTS[exId] != null) return DEFAULTS[exId];
  return null;
}

export function weightForCombatExerciseResolved(
  exId: string,
  opts: { workMaxByExercise?: CombatWorkMaxByExercise | null; workMax?: CombatWorkMax | null; bodyweight?: number | null; goalMult?: number; outsideMult?: number }
): number {
  const bw = getCombatWorkMax(exId, opts.workMaxByExercise, opts.workMax, opts.bodyweight);
  const base = bw ?? DEFAULTS[exId] ?? 50;
  // bodyweight / hold
  if (exId === 'pullup' || exId === 'gi_grip_pullup' || exId.includes('pinch') || exId.includes('carry') && exId !== 'suitcase_carry') {
    // carry — keep weight, pullup/pinch — bodyweight (0)
    if (exId.includes('pullup') || exId.includes('pinch') || exId.includes('roller')) return 0;
  }
  const gm = opts.goalMult ?? 1;
  const om = opts.outsideMult != null && opts.outsideMult < 0.75 ? 0.93 : 1;
  return Math.round((base * gm * om) / 2.5) * 2.5;
}
