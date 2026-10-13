/**
 * strength-sport-taper.engine.ts — Winwood precise taper для стронга (PRO).
 * n=454, step 52%, vol -45.5±12.9%, cess 3.9±1.8д, last heavy: yoke/stone/deadlift дольше.
 */

export interface TaperEventCessation {
  event: string;
  cessationDays: number; // дней до старта прекратить тяжёлые
  lastHeavyPct: number; // % от ПМ на последней тяжёлой
}

export const TAPER_CESSATION_DAYS: Record<string, number> = {
  yoke_walk: 7,
  atlas_stone_load: 7,
  atlas_stone_over_bar: 7,
  natural_stone_shoulder: 7,
  stone_lift: 7,
  sandbag_load: 7,
  sandbag_over_bar: 7,
  deadlift: 7,
  deadlift_max: 7,
  car_deadlift_18: 7,
  car_deadlift_side: 7,
  axle_deadlift: 6,
  frame_carry: 6,
  husafell_carry: 6,
  conan_wheel: 6,
  shield_carry: 6,
  truck_pull: 6,
  log_press: 5,
  axle_press: 5,
  viking_press: 5,
  circus_db_press: 5,
  circus_db_medley: 5,
  farmers_walk_heavy: 5,
  zercher_carry: 5,
  // PRO (замер Winwood 2018 n=454): squat 6.6±3.2д, bench 5.7±2.1д —
  // в таблице их не было, присед получал дефолт 5 и резался раньше времени.
  back_squat: 6,
  front_squat: 6,
  squat: 6,
  hack_squat: 6,
  bench_bar: 5,
  // PRO: олимпийская классика 5.1±1.5д — тоже была на дефолте 5 (совпало
  // случайно, но явная запись защищает от смены дефолта).
  snatch: 5,
  clean_and_jerk: 5,
  push_jerk: 5,
  split_jerk: 5,
  pause_jerk: 5,
  push_press: 5,
  keg_toss: 4,
  keg_over_bar: 4,
  sandbag_toss: 4,
  tire_flip: 4,
  sled_push_sprint: 3,
  sandbag_carry: 3,
  duck_walk: 3,
  arm_over_arm: 3,
  sled_drag: 3,
  sled_push: 3,
};

/**
 * PRO: половая поправка длительности тейпера (Winwood 2018, n=454).
 * Стронг: женщины 9.5±5.5д vs мужчины 8.3±4.8д (женский тейпер ДЛЬШНЕ);
 * ТА: женщины 5.3±1.8д vs мужчины 8.6±4.6д (женский КОРОЧЕ — и это measured,
 * не оценка). Поэтому поправка считается отдельно по режиму, а не «женщине
 * всегда меньше»: силовой экстрим и ТА расходятся в разные стороны.
 */
export function taperLengthDaysFor(mode: string, sex?: string): number {
  if (mode === 'weightlifting') return sex === 'female' ? 5 : 8;
  if (mode === 'strongman') return sex === 'female' ? 10 : 8;
  return 7;
}

// Winwood step taper: volume -45.5%, frequency same/down, intensity ~50% last week, assistance 0
export interface TaperWeekPlan {
  weekFromEnd: number; // 1 = последняя, 2 = предпоследняя
  volumeMult: number;
  intensityPctMult: number;
  assistance: 'normal' | 'reduced' | 'none';
  heavyEvents: string[]; // какие тяжёлые ещё можно
}

export const WINWOOD_TAPER: Record<number, TaperWeekPlan> = {
  1: { weekFromEnd: 1, volumeMult: 0.45, intensityPctMult: 0.50, assistance: 'none', heavyEvents: [] }, // последняя: лёгкая техника
  2: { weekFromEnd: 2, volumeMult: 0.55, intensityPctMult: 0.75, assistance: 'reduced', heavyEvents: ['farmers_walk_heavy','log_press','tire_flip'] }, // предпоследняя: умеренно
};

// Pritchard IWF WL taper: vol -40% int 88-92% 10-14д (для ТА distinct от Winwood SM)
export const WL_TAPER: Record<number, TaperWeekPlan> = {
  1: { weekFromEnd: 1, volumeMult: 0.60, intensityPctMult: 0.90, assistance: 'reduced', heavyEvents: ['snatch','clean_and_jerk','front_squat'] },
  2: { weekFromEnd: 2, volumeMult: 0.70, intensityPctMult: 0.92, assistance: 'reduced', heavyEvents: ['snatch','clean_and_jerk','back_squat','snatch_pull','clean_pull'] },
};

export function taperForWLWeekFromEnd(weekFromEnd: number): TaperWeekPlan {
  if (weekFromEnd <= 1) return WL_TAPER[1];
  if (weekFromEnd === 2) return WL_TAPER[2];
  return { weekFromEnd, volumeMult: 1, intensityPctMult: 1, assistance: 'normal', heavyEvents: [] };
}

// Auto-deload weeks 4,7,11 (StrongmanPlan) — если totalWeeks≥8
export function autoDeloadWeeks(totalWeeks: number): number[] {
  const cand = [4,7,11];
  return cand.filter(w=> w < totalWeeks && w >= 4);
}
export function isAutoDeloadWeek(week: number, totalWeeks: number): boolean {
  return autoDeloadWeeks(totalWeeks).includes(week);
}

// Planner PRO P5: Torokhtiy 4-фаз — мягкий тапер нед.10 ×0.65 (vs Winwood 0.45).
export const TORO_TAPER = { weekFromEnd: 1, volumeMult: 0.65, intensityPctMult: 0.65, assistance: 'reduced' } as const;

/** Множитель объёма тапер-недели по block-модели; null = Winwood у вызывателя (strong5/wave). */
export function taperMultForWeek(blockModel: string | undefined, weekFromEnd: number): number | null {
  if (blockModel === 'toro4' && weekFromEnd <= 1) return TORO_TAPER.volumeMult;
  return null;
}

// Planner PRO P7: половой cessation (syst.review Sports Medicine 2026: М 4.5 / Ж 3.9).
// Без пола — база таблицы, байт-в-байт.
export function cessationDaysFor(eventId: string, sex?: string): number {
  const base = TAPER_CESSATION_DAYS[eventId] ?? 5;
  if (sex === 'male') return base + 1;
  return base;
}

export const OPENER_SINGLE_NOTE = 'Opener 90% 1×1 — репетиция старта (последняя неделя)';

export function taperForWeekFromEnd(weekFromEnd: number): TaperWeekPlan {
  if (weekFromEnd <= 1) return WINWOOD_TAPER[1];
  if (weekFromEnd === 2) return WINWOOD_TAPER[2];
  return { weekFromEnd, volumeMult: 1, intensityPctMult: 1, assistance: 'normal', heavyEvents: [] };
}

export function isEventCessated(eventId: string, daysOut: number): boolean {
  const need = TAPER_CESSATION_DAYS[eventId] ?? 5;
  return daysOut < need;
}

export function taperDaysOutFor(competitionDate: string, sessionDateISO: string): number | null {
  try {
    const comp = new Date(competitionDate);
    const sess = new Date(sessionDateISO);
    return Math.round((comp.getTime() - sess.getTime()) / (86400000));
  } catch { return null; }
}

export function buildTaperRationale(weeks: number, competitionDate?: string): string[] {
  const lines: string[] = [];
  if (competitionDate) {
    lines.push(`Taper Winwood: step 8.6д, vol -45.5% (−12.9%), cess 3.9д — последняя нед intensity 50%`);
    lines.push(`Cessation: йок/камень/тяга 7д, лог/фермер 5д, покрышка/броски 4д, сани 3д`);
  } else if (weeks >= 8) {
    lines.push(`Taper: 2 нед step — W-2 vol 55% int 75% assist reduced, W-1 vol 45% int 50% assist none (Winwood n=454)`);
  }
  return lines;
}
