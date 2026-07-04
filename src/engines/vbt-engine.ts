/**
 * VBT (Velocity Based Training) Engine
 * Maps concentric velocity to estimated %1RM and predicts target weights.
 */

export type VBTIntent = 'strength' | 'hypertrophy' | 'power' | 'endurance';

export interface VBTProfile {
  minVelocity: number; // Velocity at 100% 1RM (m/s)
  maxVelocity: number; // Velocity at 0% load (m/s)
}

// Typical profiles for main lifts
export const LIFT_VBT_PROFILES: Record<string, VBTProfile> = {
  squat: { minVelocity: 0.15, maxVelocity: 1.1 },
  bench: { minVelocity: 0.12, maxVelocity: 0.9 },
  deadlift: { minVelocity: 0.10, maxVelocity: 1.0 },
  default: { minVelocity: 0.15, maxVelocity: 1.0 },
};

export const INTENT_VELOCITY_RANGES: Record<VBTIntent, { min: number; max: number; typical: number }> = {
  strength: { min: 0.15, max: 0.35, typical: 0.25 },
  hypertrophy: { min: 0.4, max: 0.7, typical: 0.55 },
  power: { min: 0.7, max: 1.1, typical: 0.9 },
  endurance: { min: 1.1, max: 1.5, typical: 1.3 },
};

/**
 * Predicts %1RM based on current velocity and lift profile.
 * Formula: %1RM = 1 - (currentVelocity - minVelocity) / (maxVelocity - minVelocity)
 */
export function predictPercentage(velocity: number, lift: string = 'default'): number {
  const profile = LIFT_VBT_PROFILES[lift] || LIFT_VBT_PROFILES.default;
  const pct = 1 - (velocity - profile.minVelocity) / (profile.maxVelocity - profile.minVelocity);
  return Math.max(0, Math.min(1, pct));
}

/**
 * Predicts target weight based on intended velocity.
 * TargetWeight = 1RM * predictPercentage(targetVelocity, lift)
 */
export function predictTargetWeight(oneRM: number, targetVelocity: number, lift: string = 'default'): number {
  const pct = predictPercentage(targetVelocity, lift);
  return Math.round(oneRM * pct * 0.5) * 2; // Rounded to 2.5 or similar if needed, here simple rounding
}

/**
 * Returns a recommended velocity range based on intent.
 */
export function getRecommendedVelocity(intent: VBTIntent): { min: number; max: number; typical: number } {
  return INTENT_VELOCITY_RANGES[intent];
}
