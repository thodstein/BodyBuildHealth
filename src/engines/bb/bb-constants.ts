/**
 * bb-constants.ts — магические числа ББ-авто, вынесенные в константы.
 * Единый источник для всех множителей, порогов и лимитов.
 */

// MRV tolerance (допуск на превышение MRV)
export const BB_MRV_TOLERANCE = 1.15;

// Session limits
export const BB_SESSION_EXERCISE_LIMIT = 10;
export const BB_EXERCISE_SET_CAP = 5;

// Taper curve (кривая тейпера)
export const BB_TAPER_CURVE = [0.90, 0.85, 0.70, 0.60] as const;

// Grade thresholds (пороги грейдов)
export const BB_GRADE_THRESHOLDS = {
  A: 85,
  B: 65,
  C: 45,
} as const;

// PED multipliers (множители MRV для PED)
export const BB_PED_MRV_MULTIPLIERS = {
  AAS: 1.35,
  insulin: 1.28,
  MGF: 1.10,
  IGF1: 1.18,
  GH: 1.22,
} as const;

// PED diminishing returns
export const BB_PED_DIMINISHING = 0.85;

// ACWR thresholds
export const BB_ACWR_CAUTION = 1.3;
export const BB_ACWR_DANGER = 1.5;

// Volume mode multipliers
export const BB_VOLUME_MODE_MULTIPLIERS = {
  high: 1.25,
  normal: 1.0,
} as const;

// Enhanced multipliers (для enhanced уровня)
export const BB_ENHANCED_MULTIPLIERS = {
  chest: 2.20,
  back: 1.80,
  quads: 1.45,
  hams: 1.60,
  delts: 1.35,
  arms: 1.12,
} as const;

// Phase equipment preferences
export const BB_PHASE_EQUIPMENT_PREF: Record<string, string[]> = {
  accumulation: ['cable', 'dumbbell', 'machine', 'barbell'],
  intensification: ['barbell', 'machine', 'dumbbell', 'cable'],
  peaking: ['barbell', 'machine', 'dumbbell', 'cable'],
  deload: ['cable', 'bodyweight', 'dumbbell', 'machine'],
};

// Workout character multipliers (тяж/памп)
export const BB_CHARACTER_MULTIPLIERS = {
  heavy: 0.65,
  pump: 0.35,
} as const;

// RIR drift per 2 weeks
export const BB_RIR_DRIFT_PER_2_WEEKS = -1;

// Deload RIR
export const BB_DELOAD_RIR = 4;

// Female posterior boost
export const BB_FEMALE_POSTERIOR_BOOST = 1.2;

// Packing cap
export const BB_PACKING_CAP = 5;

// Blast/Cruise
export const BB_BLAST_CRUISE_ENABLED = true;
