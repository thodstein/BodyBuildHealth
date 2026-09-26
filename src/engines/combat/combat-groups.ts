/**
 * combat-groups.ts — ЕДИНЫЙ канон классификации упражнений по рабочим группам.
 *
 * Раньше группа определялась 7+ инлайн-цепочками `id.includes(...)` внутри
 * combat-finalize (шейная/хват/ротация) и отдельно в билдере (акценты) — они
 * разъезжались: `plyo`/`unilateral` раздували объём, но не имели лендмарки.
 * Теперь одна таблица на всех.
 */

export const CB_GROUP_IDS: Record<string, string[]> = {
  neck: [
    'neck_harness_ext', 'neck_lateral_flex', 'neck_flexion', 'neck_rotation',
    'neck_bridge_wrestler', 'neck_isometric_front', 'neck_isometric_back',
    'neck_isometric_side', 'neck_band_rotation_isometric', 'neck_eccentric_flexion',
    'neck_harness_rotation',
  ],
  grip: [
    'gi_grip_pullup', 'plate_pinch', 'wrist_roller', 'wrist_flexion',
    'wrist_extension', 'towel_pullup', 'rope_climb', 'fat_bar_row', 'farmer_carry',
  ],
  rotational: [
    'landmine_rotation', 'landmine_180', 'pallof_rotation_press', 'med_ball_throw',
    'med_ball_slam', 'med_ball_rot_throw', 'sledge_hammer', 'battle_rope',
  ],
  plyo: ['box_jump', 'depth_jump', 'broad_jump', 'med_ball_slam', 'med_ball_throw', 'med_ball_rot_throw', 'sledge_hammer', 'battle_rope'],
  unilateral: ['bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat', 'step_up', 'single_arm_row'],
  core_anti: ['deadbug', 'hollow_hold', 'side_plank', 'ab_wheel', 'copenhagen_plank'],
  prehab: ['face_pull', 'band_external_rotation', 'band_pull_apart', 'ytw_raise'],
};

/** Подстрочные маркеры — для id, которых ещё нет в каноническом списке.
 *  Узкие, чтобы не срабатывать на чужие движения. */
const CB_GROUP_MARKERS: Record<string, string[]> = {
  neck: ['neck'],
  grip: ['grip', 'pinch', 'wrist', 'farmer', 'towel', 'rope'],
  rotational: ['landmine', 'pallof', 'med_ball', 'sledge', 'battle', 'rotation'],
  plyo: ['box_jump', 'depth_jump', 'broad_jump'],
  unilateral: ['bulgarian', 'single_leg_rdl', 'cossack', 'step_up', 'single_arm_row'],
};

const ID_SETS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(CB_GROUP_IDS).map(([g, ids]) => [g, new Set(ids)]),
);

/** Принадлежит ли упражнение группе. Канон (точный id) → фолбэк (узкий маркер). */
export function inCombatGroup(id: string, group: string): boolean {
  const set = ID_SETS[group];
  if (set?.has(id)) return true;
  const markers = CB_GROUP_MARKERS[group];
  if (!markers) return false;
  return markers.some(m => id.includes(m));
}

export const COMBAT_VOLUME_GROUPS = ['neck', 'grip', 'rotational', 'plyo', 'unilateral', 'core_anti'] as const;
export type CombatVolumeGroup = typeof COMBAT_VOLUME_GROUPS[number];

/** Сеты группы за неделю — один источник для финализатора и UI. */
export function weekGroupSets(
  sessions: { exercises: { id: string; sets: number }[] }[],
  group: string,
): number {
  let total = 0;
  for (const sess of sessions) for (const ex of sess.exercises) if (inCombatGroup(ex.id, group)) total += ex.sets;
  return total;
}

/** Упражнения группы недели в порядке «самые объёмные первыми» (для MRV-трима). */
export function weekGroupExercises(
  sessions: { exercises: any[] }[],
  group: string,
): any[] {
  const out: any[] = [];
  for (const sess of sessions) for (const ex of sess.exercises) if (inCombatGroup(ex.id, group)) out.push(ex);
  return out.sort((a, b) => (b.sets || 0) - (a.sets || 0));
}
