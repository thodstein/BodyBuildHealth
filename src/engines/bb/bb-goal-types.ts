/**
 * bb-goal-types.ts - BBGoal training focus type + evidence-based RIR/reps tables (2022+).
 *
 * Sources:
 *   Schoenfeld 2021 (meta): 0-3 RIR optimal
 *   Roberts 2022 (meta): failure → RIR 3+ for hypertrophy
 *   Schoenfeld 2017: 6-30 reps for hypertrophy (RIR 0-3)
 *   Schoenfeld 2016: 1-6 reps for strength
 *   Helms 2022: evidence-based hypertrophy guidelines
 *   ACSM 2023: eccentric 2-4s per phase
 */

/** Training focus - NOT body-composition goal (those are BBGoal in bb-builder, e.g. mass/cut). */
export type BBTrainingFocus = 'strength' | 'hypertrophy' | 'endurance';

export interface FocusRirConfig {
  base: number;            // base RIR for accumulation phase
  driftPer2Weeks: number;  // RIR change every 2 weeks (negative = harder)
  pumpRir: number;         // RIR for pump work (metabolic stress)
}

export interface FocusRepsConfig {
  heavy: [number, number];  // heavy day rep range (mechanical tension)
  pump: [number, number];   // pump day rep range (metabolic stress)
  light: [number, number];  // light / general rep range
}

export const FOCUS_RIR_TABLE: Record<BBTrainingFocus, FocusRirConfig> = {
  // Strength: aggressive RIR drop — fast progression to failure (Schoenfeld 2017: 1-5 reps, RIR 0-2).
  // Drift -1 per 2 weeks: W1 RIR=1 → W3 RIR=0 → W5 RIR=0 (clamped).
  strength:    { base: 1, driftPer2Weeks: -1, pumpRir: 3 },
  // Hypertrophy: moderate RIR drop — Roberts 2022 meta: RIR 2-3 optimal, drift to RIR 0-1 by peak.
  // Drift -1 per 2 weeks: W1 RIR=2 → W3 RIR=1 → W5 RIR=0.
  hypertrophy: { base: 2, driftPer2Weeks: -1, pumpRir: 4 },
  // Endurance: no RIR drift — metabolic stress focus stays at RIR 3-4 throughout (Schoenfeld 2017: 15-30 reps).
  // Drift 0: RIR stays constant, progression via volume/reps only.
  endurance:   { base: 3, driftPer2Weeks: 0, pumpRir: 5 },
};

/** @deprecated не используется — reps берутся из PHASE_CONFIGS (periodization), tempo из bb-tempo-rest; оставлено для совместимости */
export const FOCUS_REPS_TABLE: Record<BBTrainingFocus, FocusRepsConfig> = {
  strength:    { heavy: [1, 5], pump: [8, 12],   light: [6, 10] },
  hypertrophy: { heavy: [5, 10], pump: [12, 20], light: [8, 15] },
  endurance:   { heavy: [8, 12], pump: [15, 30], light: [10, 20] },
};

/** @deprecated дублирует bb-tempo-rest.ts phaseTempo; каноника — bb-tempo-rest */
export const PHASE_TEMPO: Record<string, { notation: string; eccentric: number }> = {
  accumulation:     { notation: '3-1-1-0', eccentric: 3 },
  intensification:  { notation: '2-1-1-0', eccentric: 2 },
  peaking:          { notation: '2-0-1-0', eccentric: 2 },
  deload:           { notation: '4-2-2-0', eccentric: 4 },
};

/** @deprecated не используется */
export const LEVEL_REP_MOD: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  enhanced: 4,
};

/**
 * Focus-специфичные оверрайды фаз.
 * IUSCA 2021 + BJSM 2022 NMA: сила требует >80% 1RM (1-6 повт), гипертрофия 6-30 повт при RIR 0-3,
 * выносливость 12-30 повт. Wolf 2023: long-length partials эффективны для гипертрофии.
 * hypertrophy — инвариант текущих PHASE_CONFIGS (10-15/6-10/3-6/12-20).
 * strength — сдвиг к низким повторам и высокой интенсивности.
 * endurance — сдвиг к высоким повторам и метаболическому стрессу.
 */
export const FOCUS_PHASE_OVERRIDES: Record<BBTrainingFocus, Partial<Record<string, Partial<{ repRange: [number, number]; intensityMultiplier: number; volumeMultiplier: number }>>>> = {
  strength: {
    accumulation:    { repRange: [6, 10], intensityMultiplier: 0.85, volumeMultiplier: 0.90 },
    intensification: { repRange: [3, 6],  intensityMultiplier: 0.95, volumeMultiplier: 0.80 },
    peaking:         { repRange: [1, 3],  intensityMultiplier: 0.97, volumeMultiplier: 0.55 },
    deload:          { repRange: [8, 12], intensityMultiplier: 0.60, volumeMultiplier: 0.50 },
  },
  hypertrophy: {
    // инвариант — явные значения для прозрачности, совпадают с PHASE_CONFIGS
    accumulation:    { repRange: [10, 15], intensityMultiplier: 0.75, volumeMultiplier: 1.00 },
    intensification: { repRange: [6, 10],  intensityMultiplier: 0.85, volumeMultiplier: 0.85 },
    peaking:         { repRange: [3, 6],   intensityMultiplier: 0.95, volumeMultiplier: 0.65 },
    deload:          { repRange: [12, 20], intensityMultiplier: 0.55, volumeMultiplier: 0.50 },
  },
  endurance: {
    accumulation:    { repRange: [12, 20], intensityMultiplier: 0.70, volumeMultiplier: 1.00 },
    intensification: { repRange: [10, 15], intensityMultiplier: 0.75, volumeMultiplier: 0.85 },
    peaking:         { repRange: [8, 12],  intensityMultiplier: 0.80, volumeMultiplier: 0.65 },
    deload:          { repRange: [15, 25], intensityMultiplier: 0.50, volumeMultiplier: 0.50 },
  },
};
