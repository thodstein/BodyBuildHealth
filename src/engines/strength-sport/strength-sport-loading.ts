/**
 * strength-sport-loading.ts — зальная нагрузка для ТА/стронга (изолировано).
 * Tempo/rest/phase mapping как bb-tempo-rest но доменный.
 */

export type DayCharacter = 'тяж' | 'памп' | 'лёг';
export interface LoadingOut { reps: [number, number]; rir: number; pct: number; tempo: string; rest: number; }

const PCT_BY_PHASE: Record<string, number> = {
  accumulation: 0.75, intensification: 0.85, peaking: 0.92, deload: 0.60, transition: 0.65,
};

const TEMPO_OVERRIDES: Record<string,string> = {
  snatch:'X-0-X-0', hang_snatch:'X-0-X-0', power_snatch:'X-0-X-0', muscle_snatch:'X-0-X-0', snatch_pull:'X-0-X-0', clean_pull:'X-0-X-0', hang_clean:'X-0-X-0', power_clean:'X-0-X-0', muscle_clean:'X-0-X-0', push_jerk:'X-0-X-0', split_jerk:'X-0-X-0', push_press:'X-0-X-0',
  rdl:'3-1-1-0', bulgarian_split:'3-0-1-0', cossack_squat:'3-0-1-0', overhead_squat_v2:'3-0-1-0', snatch_balance:'3-0-1-0',
  log_press:'2-0-1-0', yoke_walk:'1-0-1-0', farmers_walk_heavy:'1-0-1-0', atlas_stone_load:'2-0-1-0', tire_flip:'1-0-1-0', sled_push_sprint:'1-0-1-0',
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
// P0-6: рест по ивентам + по % (90%+ дольше) — Rest Timer Science, памп всегда 75 кроме стронга
export function restForSS(character: DayCharacter, isPrimary: boolean, id?: string, pct?: number): number {
  const strongCarry = id && ['yoke_walk','farmers_walk_heavy','zercher_carry','sled_push_sprint','tire_flip','atlas_stone_load','stone_lift','sandbag_shoulder'].some(k => id.includes(k));
  const strongPress = id && ['log_press','circus_db_press','axle_deadlift'].some(k => id.includes(k));
  const p = pct ?? 0.80;
  if (character === 'памп') {
    if (strongCarry) return p >= 0.90 ? 360 : 300;
    if (strongPress) return 180;
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
export function pctForSS(phase: string, goal: string): number {
  if (goal==='technique') return 0.65;
  return PCT_BY_PHASE[phase] || 0.78;
}
/**
 * Prilepin детальная таблица — оптимальные повторы по % (Soviet manual)
 * Для WL (взрывные) — меньше повторов, для силовых — больше
 */
export function optimalRepsForPct(pct: number, isWL: boolean): [number, number] {
  if (isWL) {
    if (pct < 0.70) return [3, 5];
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
  if (goal==='technique') return [1,3];
  const isWL = tag==='snatch_day' || tag==='clean_day' || tag==='oly_day' || tag==='technique_day';
  const pct = pctForSS(phase, goal);
  // Prilepin-коррекция для WL vs силовых
  const pri = optimalRepsForPct(pct, isWL);
  if (tag==='snatch_day' || tag==='clean_day' || tag==='oly_day') return isPrimary ? [1,3] : pri;
  if (tag==='technique_day') return [1,2];
  if (tag==='event_day') return isPrimary ? [1,5] : [6,10];
  if (phase==='peaking') return isPrimary ? [1,3] : pri;
  if (phase==='accumulation') return isPrimary ? pri : [8,12];
  if (phase==='intensification') return isPrimary ? pri : [6,10];
  if (phase==='deload') return isPrimary ? [3,5] : [8,12];
  return pri;
}

export function computeSSLoading(tag: string, phase: string, goal: string, isPrimary: boolean, character: DayCharacter, id?: string): LoadingOut {
  const reps = repsForSS(tag, phase, goal, isPrimary);
  const pct = pctForSS(phase, goal);
  const tempo = tempoForSS(id || '', character, phase);
  const rest = restForSS(character, isPrimary, id, pct);
  // RIR will be set via rirForWeek outside (needs week)
  return { reps, rir: 2, pct, tempo, rest };
}
