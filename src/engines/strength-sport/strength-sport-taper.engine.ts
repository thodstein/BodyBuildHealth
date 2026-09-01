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
