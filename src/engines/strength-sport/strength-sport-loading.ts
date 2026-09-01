/**
 * strength-sport-loading.ts — зальная нагрузка для ТА/стронга (изолировано).
 * Tempo/rest/phase mapping как bb-tempo-rest но доменный.
 */

export type DayCharacter = 'тяж' | 'памп' | 'лёг';
export interface LoadingOut { reps: [number, number]; rir: number; pct: number; tempo: string; rest: number; }

const PCT_BY_PHASE: Record<string, number> = {
  accumulation: 0.75, intensification: 0.85, peaking: 0.92, deload: 0.60, transition: 0.65,
};
const PCT_BY_PHASE_WL: Record<string, number> = {
  accumulation: 0.75, intensification: 0.82, peaking: 0.88, deload: 0.60, transition: 0.65,
};

const TEMPO_OVERRIDES: Record<string,string> = {
  snatch:'X-0-X-0', hang_snatch:'X-0-X-0', power_snatch:'X-0-X-0', muscle_snatch:'X-0-X-0', high_hang_snatch:'X-0-X-0', deficit_snatch:'X-0-X-0', block_snatch:'X-0-X-0', pause_snatch:'X-0-X-0', snatch_pull:'X-0-X-0', clean_pull:'X-0-X-0', hang_clean:'X-0-X-0', power_clean:'X-0-X-0', muscle_clean:'X-0-X-0', deficit_clean:'X-0-X-0', block_clean:'X-0-X-0', low_block_clean:'X-0-X-0', pause_clean:'X-0-X-0', pause_jerk:'X-0-X-0', push_jerk:'X-0-X-0', split_jerk:'X-0-X-0', push_press:'X-0-X-0',
  rdl:'3-1-1-0', bulgarian_split:'3-0-1-0', cossack_squat:'3-0-1-0', overhead_squat_v2:'3-0-1-0', snatch_balance:'3-0-1-0',
  log_press:'2-0-1-0', axle_press:'2-0-1-0', viking_press:'2-0-1-0', yoke_walk:'brace 2с — walk', farmers_walk_heavy:'1-0-1-0', frame_carry:'1-0-1-0', husafell_carry:'1-0-1-0', conan_wheel:'brace 2с — walk', shield_carry:'brace 2с — walk', duck_walk:'brace 2с — walk', atlas_stone_load:'lap 2с — load', atlas_stone_over_bar:'lap 2с — load', natural_stone_shoulder:'lap 3с — shoulder', sandbag_load:'lap 2с — load', sandbag_over_bar:'lap 2с — load', keg_toss:'X-0-X-0', keg_over_bar:'lap 1с — load', car_deadlift_18:'2-0-1-0', car_deadlift_side:'2-0-1-0', tire_flip:'1-0-1-0', sled_push_sprint:'1-0-1-0', sandbag_shoulder:'2-0-X-0', truck_pull:'1-0-1-0', arm_over_arm:'1-0-1-0', circus_db_medley:'2-0-1-0',
  bench_bar:'2-0-1-0', squat:'2-0-1-0', back_squat:'2-0-1-0', front_squat:'2-0-1-0', deadlift:'2-0-1-0', sumo_dl:'2-0-1-0',
};
export function tempoForSS(id: string, character: DayCharacter, phase: string): string {
  const isExplosive = id && TEMPO_OVERRIDES[id] === 'X-0-X-0';
  if (phase === 'deload') return isExplosive ? 'X-0-X-0' : '3-1-1-0';
  if (id && TEMPO_OVERRIDES[id]) return TEMPO_OVERRIDES[id];
  if (character==='тяж') return '2-0-1-0';
  if (character==='памп') return '2-0-1-1';
  return '2-0-1-0';
}
// P0-6: рест по ивентам + по % — памп всегда короче (даже для стронга)
export function restForSS(character: DayCharacter, isPrimary: boolean, id?: string, pct?: number): number {
  const strongCarry = id && ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','zercher_carry','sled_push_sprint','tire_flip','atlas_stone_load','atlas_stone_over_bar','stone_lift','sandbag_shoulder','sandbag_load','sandbag_over_bar','keg_toss','keg_over_bar','sandbag_carry','car_deadlift_18','car_deadlift_side','conan_wheel','shield_carry','duck_walk','truck_pull','arm_over_arm','natural_stone_shoulder'].some(k => id.includes(k));
  const strongPress = id && ['log_press','axle_press','circus_db_press','circus_db_medley','viking_press','axle_deadlift','car_deadlift_18','car_deadlift_side'].some(k => id.includes(k));
  const p = pct ?? 0.80;
  if (character === 'памп') {
    if (strongCarry) return p >= 0.85 ? 180 : 120;
    if (strongPress) return 120;
    return 75;
  }
  if (strongCarry) {
    if (p >= 0.90) return isPrimary ? 480 : 360; // 8 / 6 мин для 90%+
    if (p >= 0.80) return isPrimary ? 360 : 300; // 6 / 5
    return isPrimary ? 300 : 240;
  }
  if (strongPress) {
    if (p >= 0.90) return isPrimary ? 300 : 240;
    if (p >= 0.80) return isPrimary ? 240 : 180;
    return isPrimary ? 180 : 120;
  }
  if (p >= 0.90) return isPrimary ? 240 : 180;
  if (p >= 0.80) return isPrimary ? 180 : 120;
  if (isPrimary && character==='тяж') return 180;
  if (character==='тяж') return 120;
  return 90;
}
export function pctForSS(phase: string, goal: string, tag?: string): number {
  if (goal==='technique') return 0.65;
  const isWL = tag === 'snatch_day' || tag === 'clean_day' || tag === 'oly_day' || tag === 'technique_day';
  if (isWL) return PCT_BY_PHASE_WL[phase] || 0.75;
  return PCT_BY_PHASE[phase] || 0.78;
}
/**
 * Prilepin детальная таблица — оптимальные повторы по % (Soviet manual, Takano)
 * Для WL — скорректировано: 70% 3-6 у Takano, не 2-4
 */
export function optimalRepsForPct(pct: number, isWL: boolean): [number, number] {
  if (isWL) {
    if (pct < 0.70) return [3, 6];
    if (pct < 0.80) return [2, 4];
    if (pct < 0.90) return [1, 3];
    return [1, 2];
  } else {
    if (pct < 0.70) return [5, 8];
    if (pct < 0.80) return [3, 6];
    if (pct < 0.90) return [2, 5];
    return [1, 3];
  }
}

export function repsForSS(tag: string, phase: string, goal: string, isPrimary: boolean): [number, number] {
  if (goal==='technique') return [1,2];
  const isWL = tag==='snatch_day' || tag==='clean_day' || tag==='oly_day' || tag==='technique_day';
  const pct = pctForSS(phase, goal, tag);
  // Prilepin-коррекция для WL vs силовых — PRO: primary тоже Prilepin, не фикс 1-3
  const pri = optimalRepsForPct(pct, isWL);
  if (tag==='snatch_day' || tag==='clean_day' || tag==='oly_day') return pri;
  if (tag==='technique_day') return [1,2];
  if (tag==='event_day') return isPrimary ? [1,3] : [6,10];
  if (phase==='peaking') return isPrimary ? [1,3] : pri;
  if (phase==='accumulation') return isPrimary ? pri : [8,12];
  if (phase==='intensification') return isPrimary ? pri : [6,10];
  if (phase==='deload') return isPrimary ? [2,4] : [8,12];
  return pri;
}

export function computeSSLoading(tag: string, phase: string, goal: string, isPrimary: boolean, character: DayCharacter, id?: string): LoadingOut {
  const reps = repsForSS(tag, phase, goal, isPrimary);
  const pct = pctForSS(phase, goal, tag);
  const tempo = tempoForSS(id || '', character, phase);
  const rest = restForSS(character, isPrimary, id, pct);
  return { reps, rir: 2, pct, tempo, rest };
}
