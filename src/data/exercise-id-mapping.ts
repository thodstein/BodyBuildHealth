/**
 * Exercise ID Mapping Bridge — связывает catalog ID (EXERCISE_CATALOG) с инженерными базами.
 *
 * Каждая запись: catalogId → { bio?, movement?, synergy?, joint? }
 * Используется TechniqueCalcTab и другими компонентами для кросс-ссылочного доступа.
 */
export interface ExerciseIdMapping {
  bio?: string;
  movement?: string;
  synergy?: string;
  joint?: string;
}

export const EXERCISE_ID_MAP: Record<string, ExerciseIdMapping> = {
  // ═══════════════════════ ГРУДЬ (chest) ═══════════════════════
  bench_bar: { bio: 'bench_press', movement: 'bench_press', synergy: 'bench_press', joint: 'bench_press' },
  bench_db: { bio: 'dumbbell_press', movement: 'dumbbell_bench', synergy: 'bench_press', joint: 'bench_press' },
  incline_bar: { bio: 'incline_bench', movement: 'bench_press', synergy: 'bench_press', joint: 'bench_press' },
  incline_db: { bio: 'incline_bench', movement: 'dumbbell_bench', synergy: 'bench_press', joint: 'bench_press' },
  decline_bar: { bio: 'bench_press', movement: 'bench_press', synergy: 'bench_press', joint: 'bench_press' },
  decline_db: { bio: 'dumbbell_press', movement: 'dumbbell_bench', synergy: 'bench_press', joint: 'bench_press' },
  dips_chest: { bio: 'bench_press', movement: 'push_up', synergy: 'bench_press', joint: 'bench_press' },
  fly_db: { bio: 'dumbbell_press', movement: 'bench_press' },
  cable_fly: { bio: 'dumbbell_press' },
  pec_deck: { bio: 'dumbbell_press' },
  cable_fly_low: { bio: 'dumbbell_press' },
  pushup: { movement: 'push_up' },
  pushup_deficit: { movement: 'push_up' },
  pushup_wide: { movement: 'push_up' },
  pushup_close: { movement: 'push_up' },
  svend_press: {},
  floor_press_bar: { bio: 'bench_press', movement: 'bench_press', synergy: 'bench_press', joint: 'bench_press' },
  floor_press_db: { bio: 'dumbbell_press', movement: 'dumbbell_bench' },
  guillotine_press: { bio: 'bench_press', movement: 'bench_press' },
  low_incline_db: { bio: 'incline_bench', movement: 'dumbbell_bench' },
  banded_pushup: { movement: 'push_up' },
  ring_pushup: { movement: 'push_up' },
  ring_fly: {},
  smith_bench: { bio: 'bench_press', movement: 'bench_press' },
  smith_incline: { bio: 'incline_bench', movement: 'bench_press' },

  // ═══════════════════════ СПИНА (back) ═══════════════════════
  deadlift: { bio: 'deadlift_conventional', movement: 'deadlift', synergy: 'deadlift', joint: 'deadlift' },
  sumo_dl: { bio: 'sumo_deadlift', movement: 'deadlift', synergy: 'deadlift', joint: 'deadlift' },
  pullup: { bio: 'pull_up', movement: 'pull_up', synergy: 'pull_up', joint: 'pull_up' },
  chinup: { bio: 'pull_up', movement: 'pull_up', synergy: 'pull_up', joint: 'pull_up' },
  pullup_neutral: { bio: 'pull_up', movement: 'pull_up', synergy: 'pull_up', joint: 'pull_up' },
  pullup_wide: { bio: 'pull_up', movement: 'pull_up', synergy: 'pull_up', joint: 'pull_up' },
  pulldown: { bio: 'lat_pulldown', movement: 'lat_pulldown', synergy: 'pull_up', joint: 'pull_up' },
  pulldown_rev: { bio: 'lat_pulldown', movement: 'lat_pulldown', synergy: 'pull_up', joint: 'pull_up' },
  pulldown_wide: { bio: 'lat_pulldown', movement: 'lat_pulldown' },
  pulldown_straight: { bio: 'lat_pulldown', movement: 'lat_pulldown' },
  pulldown_single: { bio: 'lat_pulldown' },
  row_bar: { bio: 'barbell_row', movement: 'barbell_row', synergy: 'barbell_row' },
  row_tbar: { bio: 'barbell_row', movement: 'barbell_row', synergy: 'barbell_row' },
  row_db: { bio: 'barbell_row', movement: 'barbell_row', synergy: 'barbell_row' },
  row_db_single: { bio: 'barbell_row', movement: 'barbell_row' },
  row_machine: { movement: 'seated_row', synergy: 'barbell_row' },
  row_cable: { bio: 'seated_cable_row', movement: 'seated_row', synergy: 'barbell_row' },
  seated_row: { bio: 'seated_cable_row', movement: 'seated_row', synergy: 'barbell_row' },
  seated_row_wide: { bio: 'seated_cable_row', movement: 'seated_row' },
  face_pull: { bio: 'face_pull', movement: 'face_pull' },
  straight_pull: { bio: 'lat_pulldown' },
  rack_pull: { bio: 'deadlift_conventional', movement: 'deadlift', synergy: 'deadlift', joint: 'deadlift' },
  defecit_dl: { bio: 'deadlift_conventional', movement: 'deadlift', synergy: 'deadlift', joint: 'deadlift' },
  snatch_dl: { bio: 'deadlift_conventional', movement: 'deadlift', synergy: 'deadlift' },
  trap_bar_dl: { bio: 'deadlift_conventional', movement: 'deadlift', synergy: 'deadlift', joint: 'deadlift' },
  deadlift_straight: { bio: 'romanian_deadlift', movement: 'romanian_deadlift' },
  hyperextension: { movement: 'romanian_deadlift' },
  reverse_hyper: {},
  good_morning: { bio: 'romanian_deadlift', movement: 'romanian_deadlift' },
  good_morning_seated: { movement: 'romanian_deadlift' },
  shrug_bar: { movement: 'deadlift', synergy: 'deadlift' },
  shrug_db: { movement: 'deadlift', synergy: 'deadlift' },
  banded_gm: {},

  // ═══════════════════════ НОГИ (legs) ═══════════════════════
  squat: { bio: 'back_squat', movement: 'back_squat', synergy: 'back_squat', joint: 'back_squat' },
  squat_bar: { bio: 'back_squat', movement: 'back_squat', synergy: 'back_squat', joint: 'back_squat' },
  squat_back: { bio: 'back_squat', movement: 'back_squat', synergy: 'back_squat', joint: 'back_squat' },
  squat_front: { bio: 'front_squat', movement: 'front_squat' },
  front_squat: { bio: 'front_squat', movement: 'front_squat' },
  squat_ssb: { bio: 'back_squat', movement: 'back_squat', synergy: 'back_squat' },
  hack_squat: { movement: 'leg_press' },
  hack_squat_bar: { movement: 'leg_press' },
  squat_pause: { bio: 'back_squat', movement: 'back_squat', synergy: 'back_squat', joint: 'back_squat' },
  squat_box: { bio: 'back_squat', movement: 'back_squat', synergy: 'back_squat' },
  leg_press: { bio: 'leg_press', movement: 'leg_press' },
  leg_press_single: { bio: 'leg_press', movement: 'leg_press' },
  leg_press_high: { bio: 'leg_press', movement: 'leg_press' },
  leg_press_close: { bio: 'leg_press', movement: 'leg_press' },
  rdl: { bio: 'romanian_deadlift', movement: 'romanian_deadlift' },
  rdl_db: { bio: 'romanian_deadlift', movement: 'romanian_deadlift' },
  rdl_single: { bio: 'romanian_deadlift', movement: 'romanian_deadlift' },
  lunge: { movement: 'walking_lunge' },
  lunge_reverse: { movement: 'walking_lunge' },
  lunge_side: {},
  walking_lunge: { movement: 'walking_lunge' },
  bulgarian_split: { bio: 'bulgarian_split_squat' },
  leg_ext: {},
  leg_ext_single: {},
  leg_curl: {},
  leg_curl_seated: {},
  leg_curl_standing: {},
  leg_curl_nordic: {},
  calf_raise: { bio: 'calf_raise' },
  calf_raise_seated: { bio: 'calf_raise' },
  calf_raise_single: { bio: 'calf_raise' },
  calf_press: { bio: 'calf_raise' },
  hip_thrust: { bio: 'hip_thrust', movement: 'hip_thrust' },
  glute_bridge: { bio: 'hip_thrust', movement: 'hip_thrust' },
  hip_thrust_single: { bio: 'hip_thrust', movement: 'hip_thrust' },
  adductor: {},
  abductor: {},
  sissy_squat: { movement: 'leg_press' },
  goblet_squat: { bio: 'goblet_squat', movement: 'goblet_squat' },
  step_up: { movement: 'walking_lunge' },

  // ═══════════════════════ ПЛЕЧИ (shoulders) ═══════════════════════
  ohp: { bio: 'overhead_press', movement: 'overhead_press', synergy: 'overhead_press', joint: 'overhead_press' },
  ohp_bar: { bio: 'overhead_press', movement: 'overhead_press', synergy: 'overhead_press', joint: 'overhead_press' },
  ohp_seated: { bio: 'overhead_press', movement: 'overhead_press', synergy: 'overhead_press', joint: 'overhead_press' },
  db_press: { bio: 'overhead_press', movement: 'overhead_press', synergy: 'overhead_press', joint: 'overhead_press' },
  push_press: { bio: 'overhead_press', movement: 'overhead_press', synergy: 'overhead_press' },
  lateral_raise: { bio: 'lateral_raise', movement: 'lateral_raise' },
  cable_lateral: { bio: 'lateral_raise', movement: 'lateral_raise' },
  lateral_raise_partial: { bio: 'lateral_raise', movement: 'lateral_raise' },
  rear_delt_fly: { bio: 'face_pull', movement: 'face_pull' },
  rear_delt_machine: { bio: 'face_pull' },
  upright_row: { bio: 'lateral_raise' },
  face_pull_sh: { bio: 'face_pull', movement: 'face_pull' },
  arnold_press: { bio: 'overhead_press', movement: 'overhead_press' },
  landmine_press: { bio: 'overhead_press', movement: 'overhead_press' },
  lu_raise: {},
  front_raise: {},
  cable_front_raise: {},
  banded_lateral: { bio: 'lateral_raise' },

  // ═══════════════════════ РУКИ (arms) ═══════════════════════
  curl_bar: { bio: 'bicep_curl', movement: 'bicep_curl' },
  curl_db: { bio: 'bicep_curl', movement: 'bicep_curl' },
  hammer_curl: { bio: 'bicep_curl', movement: 'bicep_curl' },
  preacher_curl: { bio: 'bicep_curl', movement: 'bicep_curl' },
  incline_db_curl: { bio: 'bicep_curl' },
  spider_curl: { bio: 'bicep_curl' },
  cable_curl: { bio: 'bicep_curl', movement: 'bicep_curl' },
  concentration_curl: { bio: 'bicep_curl' },
  reverse_curl: { movement: 'bicep_curl' },
  reverse_curl_bar: { movement: 'bicep_curl' },
  tricep_push: { bio: 'tricep_pushdown', movement: 'tricep_extension' },
  tricep_cable: { bio: 'tricep_pushdown', movement: 'tricep_extension' },
  rope_pushdown: { bio: 'tricep_pushdown', movement: 'tricep_extension' },
  db_skullcrusher: { movement: 'tricep_extension' },
  ohp_lying: { movement: 'tricep_extension' },
  dips_tricep: { movement: 'push_up' },
  kickback: {},
  overhead_tricep_ext: { movement: 'tricep_extension' },
  tricep_ext_seated: { movement: 'tricep_extension' },
  close_grip_bench: { bio: 'bench_press', movement: 'bench_press', synergy: 'bench_press', joint: 'bench_press' },
  jm_press: { movement: 'tricep_extension' },
  wrist_curl: {},
  wrist_curl_db: {},
  wrist_ext: {},
  wrist_ext_db: {},
  wrist_roller: {},

  // ═══════════════════════ КОР (core) ═══════════════════════
  plank: { bio: 'plank' },
  plank_side: {},
  ab_wheel: { bio: 'plank' },
  hanging_leg: {},
  knee_raise: {},
  cable_crunch: {},
  russian_twist: {},
  pallof_press: {},
  dead_bug: {},
  situp: {},
  situp_decline: {},
  situp_weighted: {},
  dragon_flag: {},
  ab_coaster: {},
  suitcase_carry: {},
  farmers_walk: {},
  l_sit: {},
  crunch: {},
  crunch_cable: {},
  hollow_hold: {},
  superman: {},
  bird_dog: {},
  v_up: {},
};

export function getMappedBioId(catalogId: string): string | undefined {
  return EXERCISE_ID_MAP[catalogId]?.bio;
}

export function getMappedMovementId(catalogId: string): string | undefined {
  return EXERCISE_ID_MAP[catalogId]?.movement;
}

export function getMappedSynergyId(catalogId: string): string | undefined {
  return EXERCISE_ID_MAP[catalogId]?.synergy;
}

export function getMappedJointId(catalogId: string): string | undefined {
  return EXERCISE_ID_MAP[catalogId]?.joint;
}

export function getMappedIds(catalogId: string): ExerciseIdMapping {
  return EXERCISE_ID_MAP[catalogId] || {};
}
