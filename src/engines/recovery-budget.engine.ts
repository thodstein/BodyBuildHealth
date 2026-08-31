/**
 * recovery-budget.engine.ts — единый расчёт recovery/nutrition мультипликаторов.
 * Вынесено из копипасты strength-sport-builder:202-216 и combat-builder:233-248 + BB-аналога.
 * Учитывает RED-S пол (female 1400ккал, жиры ≥0.8г/кг) как в bb-contest-prep.
 */

export interface RecoveryInput {
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  hrvGrade?: 'optimal' | 'caution' | 'dangerous';
}

export function computeRecoveryMultiplier(input: RecoveryInput): number {
  let v = 1;
  if (input.bodyFat != null) v *= input.bodyFat > 25 ? 0.9 : input.bodyFat > 20 ? 0.95 : 1;
  if (input.leanMass != null) v *= input.leanMass >= 90 ? 1.15 : input.leanMass >= 75 ? 1.05 : input.leanMass >= 60 ? 1 : 0.9;
  if (input.hrvGrade) v *= input.hrvGrade === 'dangerous' ? 0.85 : input.hrvGrade === 'caution' ? 0.95 : 1.05;
  else if (input.hrvMs != null) v *= input.hrvMs > 70 ? 1.1 : input.hrvMs >= 50 ? 1 : 0.85;
  if (input.sleepHours != null) v *= input.sleepHours >= 7 ? 1.05 : input.sleepHours >= 6 ? 1 : 0.85;
  if (input.stressLevel != null) v *= input.stressLevel < 3 ? 1.05 : input.stressLevel < 6 ? 1 : 0.85;
  return Math.max(0.6, Math.min(1.5, v));
}

export interface NutritionInput {
  calorieSurplus?: number;
  proteinPerKg?: number;
  female?: boolean;
  fatsPerKg?: number;
  kcal?: number;
}

export function computeNutritionMultiplier(input: NutritionInput): number {
  let v = 1;
  if (input.calorieSurplus != null) {
    if (input.calorieSurplus < -500 && input.female) v *= 0.92;
    v *= input.calorieSurplus > 300 ? 1.1 : input.calorieSurplus > 100 ? 1.05 : input.calorieSurplus < -200 ? 0.8 : 1.0;
  }
  if (input.proteinPerKg != null) {
    if (input.female && input.proteinPerKg < 1.0) v *= 0.90;
    v *= input.proteinPerKg >= 2.0 ? 1.1 : input.proteinPerKg >= 1.6 ? 1.05 : input.proteinPerKg < 1.0 ? 0.85 : 1.0;
  }
  if (input.fatsPerKg != null) {
    const need = input.female ? 0.8 : 0.6;
    if (input.fatsPerKg < need) v *= input.female ? 0.92 : 0.95;
    if (input.fatsPerKg < 0.5) v *= 0.90;
  }
  // абсолютный RED-S floor — если передан kcal
  if (input.kcal != null) {
    const floor = input.female ? 1400 : 1500;
    if (input.kcal < floor) v *= 0.85;
    else if (input.kcal < floor + 200) v *= 0.95;
  }
  return Math.max(0.6, Math.min(1.5, v));
}

export function computeBudgetMultiplier(input: {
  level?: string;
  peds?: string[];
  pedDoses?: Record<string, number>;
  courseIntensity?: string;
  calorieSurplus?: number;
  proteinPerKg?: number;
  fatsPerKg?: number;
  kcal?: number;
  labMrvMultiplier?: number;
  female?: boolean;
  recovery?: RecoveryInput;
  recoveryMult?: number;
  pedMrvMult?: number;
}): number {
  const ped = input.pedMrvMult ?? 1;
  const lab = input.labMrvMultiplier ?? 1;
  const rec = input.recoveryMult ?? (input.recovery ? computeRecoveryMultiplier(input.recovery) : 1);
  const nut = computeNutritionMultiplier({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg, female: input.female, fatsPerKg: input.fatsPerKg, kcal: input.kcal });
  return Math.round(ped * lab * nut * rec * 100) / 100;
}
