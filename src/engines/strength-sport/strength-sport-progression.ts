/**
 * strength-sport-progression.ts — прогрессия ПМ для ТА/стронга.
 * Reuse LMS PM-кривая: PM_w = PM0 * (1+k)^(w-1), кап natural 1.25 / heavy 1.5.
 * k по уровню/режиму + outside/goal коррекция.
 */
import type { StrengthSportInput } from './strength-sport.types';

const LEVEL_K: Record<string, number> = {
  beginner: 0.012,
  intermediate: 0.007,
  advanced: 0.004,
  enhanced: 0.005,
};

// Per-lift коэффициент прогрессии (snatch техничен — медленнее, присед быстрее) — P0-3
const LIFT_K_FACTOR: Record<string, number> = {
  snatch: 0.45,
  hang_snatch: 0.45,
  power_snatch: 0.45,
  muscle_snatch: 0.40,
  snatch_pull: 0.60,
  snatch_balance: 0.50,
  overhead_squat_v2: 0.50,
  clean_and_jerk: 0.55,
  hang_clean: 0.55,
  power_clean: 0.55,
  muscle_clean: 0.40,
  clean_pull: 0.60,
  push_jerk: 0.55,
  split_jerk: 0.55,
  push_press: 0.65,
  back_squat: 1.0,
  front_squat: 0.85,
  squat: 1.0,
  hack_squat: 0.85,
  deadlift: 0.90,
  sumo_dl: 0.90,
  rdl: 0.75,
  log_press: 0.70,
  axle_press: 0.68,
  farmers_walk_heavy: 0.60,
  yoke_walk: 0.55,
  frame_carry: 0.58,
  husafell_carry: 0.57,
  atlas_stone_load: 0.60,
  sandbag_load: 0.60,
  stone_lift: 0.60,
  sandbag_shoulder: 0.60,
  keg_toss: 0.65,
  car_deadlift_18: 0.88,
};

function intensityK(input: StrengthSportInput): number {
  if (input.goal === 'technique') return 0.002;
  if (input.goal === 'peaking') return 0.008;
  const hasPED = (input.peds && input.peds.length > 0) || (input.pedDoses && Object.keys(input.pedDoses).length > 0);
  if (hasPED) {
    if (input.courseIntensity === 'heavy') return 0.012;
    if (input.courseIntensity === 'moderate') return 0.009;
    return 0.007;
  }
  // enhanced без PED = advanced (не быстрее)
  if (input.level === 'enhanced') return LEVEL_K['advanced'] ?? 0.004;
  return LEVEL_K[input.level] ?? 0.007;
}

function pmCap(k: number, weeks: number): number {
  const raw = Math.pow(1 + k, weeks - 1);
  if (k >= 0.01) return Math.min(raw, 1.5);
  if (k > 0.005) return Math.min(raw, 1.35);
  return Math.min(raw, 1.25);
}

/** PM на неделю w (1-индекс) — с per-lift коэффициентом P0-3 */
export function pmForWeek(pm0: number, week: number, input: StrengthSportInput, liftId?: string): number {
  if (!Number.isFinite(pm0) || pm0 <= 0) return 0;
  if (week <= 1) return pm0;
  let k = intensityK(input);
  if (liftId && LIFT_K_FACTOR[liftId] != null) k *= LIFT_K_FACTOR[liftId];
  else if (liftId && liftId.includes('snatch')) k *= 0.45;
  else if (liftId && liftId.includes('clean')) k *= 0.55;
  const cap = pmCap(k, input.weeks);
  const capped = pm0 * Math.min(Math.pow(1 + k, week - 1), cap);
  // outside high → чуть ниже прогрессия
  const outsidePenalty = input.outsideLoad && input.outsideLoad.sessionsPerWeek >= 4 ? 0.97 : 1;
  return Math.round(capped * outsidePenalty * 2) / 2; // шаг 0.5 кг
}

/** RIR по фазе/неделе для ТА/стронга — P0-2: для oly используем % шкалу, RIR вторичен */
export function rirForWeek(week: number, totalWeeks: number, goal: string, isOly?: boolean): number {
  const phase = phaseForWeek(week, totalWeeks, goal);
  if (goal === 'technique') return 4;
  if (isOly) {
    // ТА: RIR высокий (техника), только peaking синглы RIR 1
    if (phase === 'peaking') return 1;
    if (phase === 'deload') return 4;
    if (phase === 'accumulation') return 3;
    return 2;
  }
  if (goal === 'peaking' && phase === 'peaking') return 0;
  if (phase === 'accumulation') return goal === 'strength' ? 2 : 3;
  if (phase === 'intensification') return goal === 'strength' ? 1 : 2;
  if (phase === 'peaking') return 1;
  if (phase === 'deload') return 4;
  return 2;
}

/** Prilepin intensity zone для отчётности (P0-2) */
export function intensityZoneFor(pct: number): 'technique' | 'strength' | 'heavy' | 'max' {
  if (pct < 0.70) return 'technique';
  if (pct < 0.80) return 'strength';
  if (pct < 0.90) return 'heavy';
  return 'max';
}

/**
 * P0-1 Block-периодизация Torokhtiy 3/3/3/1 + адаптив для коротких циклов.
 * goal technique → accumulation дольше, peaking короче; goal peaking → taper обязателен.
 * mode strongman → GPP 40 / Strength 35 / Event-peak 20 (Winwood), иначе Torokhtiy.
 */
export function buildPhaseDistribution(totalWeeks: number, goal?: string, mode?: string): string[] {
  if (totalWeeks <= 3) return Array(totalWeeks).fill('accumulation');
  const out: string[] = [];
  // Последняя неделя — всегда deload (для всех целей кроме peaking где taper)
  const hasDeload = totalWeeks >= 4;
  const effective = hasDeload ? totalWeeks - 1 : totalWeeks;
  if (goal === 'technique') {
    // техника: 60% accumulation, 30% intensification, 10% deload
    const acc = Math.max(2, Math.round(effective * 0.6));
    const intens = Math.max(1, effective - acc);
    for (let i = 0; i < acc; i++) out.push('accumulation');
    for (let i = 0; i < intens; i++) out.push('intensification');
    if (hasDeload) out.push('deload');
    return out.slice(0, totalWeeks);
  }
  if (mode === 'strongman' && totalWeeks >= 8) {
    // Strongman: GPP/acc 40 / Strength 35 / Event-peak 20 (Winwood 2014)
    const acc = Math.max(2, Math.round(effective * 0.40));
    const intens = Math.max(2, Math.round(effective * 0.35));
    const peak = Math.max(1, effective - acc - intens);
    for (let i = 0; i < acc; i++) out.push('accumulation');
    for (let i = 0; i < intens; i++) out.push('intensification');
    for (let i = 0; i < peak; i++) out.push('peaking');
    if (hasDeload) out.push('deload');
    return out.slice(0, totalWeeks);
  }
  if (totalWeeks >= 10) {
    // Torokhtiy 10w: 3 / 3 / 3 / 1
    const acc = 3;
    const intens = 3;
    const peak = effective - acc - intens;
    for (let i = 0; i < acc; i++) out.push('accumulation');
    for (let i = 0; i < intens; i++) out.push('intensification');
    for (let i = 0; i < Math.max(1, peak); i++) out.push('peaking');
    if (hasDeload) out.push('deload');
    return out.slice(0, totalWeeks);
  }
  if (totalWeeks >= 8) {
    // 8-9w: 3 / 3 / 1-2 / 1
    const acc = 3;
    const intens = 3;
    const peak = effective - acc - intens;
    for (let i = 0; i < acc; i++) out.push('accumulation');
    for (let i = 0; i < intens; i++) out.push('intensification');
    for (let i = 0; i < Math.max(1, peak); i++) out.push('peaking');
    if (hasDeload) out.push('deload');
    return out.slice(0, totalWeeks);
  }
  if (totalWeeks >= 5) {
    const acc = 2;
    const peak = 1;
    const intens = effective - acc - peak;
    for (let i = 0; i < acc; i++) out.push('accumulation');
    for (let i = 0; i < Math.max(1, intens); i++) out.push('intensification');
    for (let i = 0; i < peak; i++) out.push('peaking');
    if (hasDeload) out.push('deload');
    return out.slice(0, totalWeeks);
  }
  // 4w: 2 acc, 1 intens, 1 deload
  for (let i = 0; i < 2; i++) out.push('accumulation');
  if (effective > 2) out.push('intensification');
  if (hasDeload) out.push('deload');
  return out.slice(0, totalWeeks);
}

export function phaseForWeek(week: number, totalWeeks: number, goal?: string, mode?: string): string {
  const dist = buildPhaseDistribution(totalWeeks, goal, mode);
  return dist[Math.max(0, Math.min(totalWeeks - 1, week - 1))] || 'accumulation';
}

/** Привязка к дате старта: taper неделя перед competitionDate (P0 fix: старта = peaking, не deload) */
export function phaseForDate(week: number, totalWeeks: number, goal?: string, competitionDate?: string, startDate?: string): string {
  if (!competitionDate || !startDate) return phaseForWeek(week, totalWeeks, goal);
  try {
    const start = new Date(startDate);
    const comp = new Date(competitionDate);
    const weekStart = new Date(start); weekStart.setDate(start.getDate() + (week - 1) * 7);
    const diffDays = Math.round((comp.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks <= 1 && diffWeeks >= 0) return 'peaking'; // неделя старта и за 1 нед до — пик
    if (goal === 'peaking' && diffWeeks <= 2 && diffWeeks >= 0) return 'peaking';
    if (diffWeeks < 0) return phaseForWeek(week, totalWeeks, goal); // после старта — обычная периодизация
  } catch {}
  return phaseForWeek(week, totalWeeks, goal);
}

/** Classic progression row для отчёта */
export function buildProgressionRow(pm0: number, input: StrengthSportInput): Array<{ week: number; pm: number; rir: number; phase: string }> {
  const out: Array<{ week: number; pm: number; rir: number; phase: string }> = [];
  for (let w = 1; w <= input.weeks; w++) {
    out.push({ week: w, pm: pmForWeek(pm0, w, input), rir: rirForWeek(w, input.weeks, input.goal), phase: phaseForWeek(w, input.weeks) });
  }
  return out;
}
