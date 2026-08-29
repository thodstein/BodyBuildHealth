/**
 * combat-loading.ts — зальная нагрузка для единоборств (изолировано).
 * reps/rir — deprecated, делегируют в combat-periodization
 */
import { repsForCombatPhase, rirForCombatPhase } from './combat-periodization.engine';
export type DayCharacter = 'тяж' | 'памп' | 'лёг';
export interface LoadingOut { reps: [number, number]; rir: number; tempo: string; rest: number; }

const TEMPO_OVERRIDES_CB: Record<string,string> = {
  neck_harness_ext:'2-1-1-0', neck_lateral_flex:'2-1-1-0', neck_bridge_wrestler:'2-1-1-0', neck_flexion:'2-1-1-0', neck_rotation:'2-1-2-0',
  landmine_rotation:'1-0-1-0', landmine_180:'1-0-1-0', pallof_rotation_press:'2-1-1-1', suitcase_carry:'1-0-1-0', farmer_carry:'1-0-1-0', sled_push:'1-0-1-0', sled_pull:'2-0-1-0',
  med_ball_throw:'X-0-X-0', med_ball_slam:'X-0-X-0', med_ball_rot_throw:'X-0-X-0', battle_rope:'1-0-1-0', sledge_hammer:'X-0-X-0',
  bench_bar:'2-0-1-0', squat:'2-0-1-0', front_squat:'2-0-1-0', zercher_squat:'3-0-1-0', trap_bar_dead:'2-0-1-0', rdl:'3-1-1-0', bulgarian_split_heavy:'3-0-1-0', cossack_squat:'3-0-1-0', step_up:'2-0-1-0', hip_thrust:'2-1-1-0', nordic_curl:'3-0-1-0', glute_ham_raise:'3-0-1-0',
  pullup:'2-0-1-0', gi_grip_pullup:'2-0-1-0', towel_pullup:'2-0-1-0', rope_climb:'2-0-1-0', row_bar:'2-0-1-0', fat_bar_row:'2-0-1-0', single_arm_row:'2-0-1-0', ohp:'2-0-1-0', push_press:'X-0-X-0', landmine_press:'2-0-1-0',
  hang_clean:'X-0-X-0', high_pull:'X-0-X-0', kb_swing:'X-0-X-0', box_jump:'X-0-X-0', depth_jump:'X-0-X-0', broad_jump:'X-0-X-0',
  deadbug:'3-1-1-1', hollow_hold:'2-0-1-0', side_plank:'1-0-1-0', ab_wheel:'3-0-1-0', copenhagen_plank:'1-0-1-0',
  wrist_flexion:'2-1-1-0', wrist_extension:'2-1-1-0', wrist_roller:'2-1-1-0', plate_pinch:'1-0-1-0',
  band_external_rotation:'2-1-1-0', band_pull_apart:'2-1-1-0', ytw_raise:'2-1-1-0', face_pull:'2-0-1-0',
};
export function tempoForCB(id: string, isPrimary: boolean, character: DayCharacter): string {
  if (id && TEMPO_OVERRIDES_CB[id]) return TEMPO_OVERRIDES_CB[id];
  if (isPrimary && character==='тяж') return 'X-0-X-0';
  return '2-0-1-0';
}
export function restForCB(isPrimary: boolean, character: DayCharacter, exId?: string): number {
  if (exId && ['box_jump','depth_jump','broad_jump','med_ball_throw','med_ball_slam','med_ball_rot_throw','hang_clean','high_pull','sledge_hammer'].includes(exId)) return isPrimary ? 120 : 90;
  if (exId && ['deadbug','hollow_hold','side_plank','ab_wheel','copenhagen_plank','wrist_flexion','band_external_rotation'].includes(exId)) return 60;
  if (exId && ['farmer_carry','suitcase_carry','sled_push','sled_pull'].includes(exId)) return 90;
  return isPrimary && character==='тяж' ? 150 : 75;
}
/** @deprecated — используйте repsForCombatPhase из combat-periodization */
export function repsForCB(goal: string, character: DayCharacter): [number, number] {
  const ph = goal === 'weight_cut' ? 'gpp' as const : goal === 'endurance' ? 'accumulation' as const : 'power' as const;
  return repsForCombatPhase(ph as any, character, goal);
}
/** @deprecated — используйте rirForCombatPhase */
export function rirForCB(goal: string, phase: string, character: DayCharacter): number {
  return rirForCombatPhase(phase as any, character, goal);
}
