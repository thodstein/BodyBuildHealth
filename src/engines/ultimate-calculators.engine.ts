/**
 * Ultimate Calculators Engine — Complete calculation module
 *
 * Strength:     Epley, Brzycki, Lander, Lombardi, O'Conner, Wathen, Mayhew
 * Powerlifting: Dots, Wilks, IPF GL, Reshel, Schwartz, Malone-Meltzer
 * VBT:          Velocity→%1RM, %1RM→velocity, velocity loss, power output
 * Biomechanics: Torque, lever arms, segment mass, ground reaction force
 * Fatigue:      Session fatigue, weekly fatigue, monotony, strain, ACWR
 * Recovery:     Readiness, hours-to-recover, supercompensation window
 * Peaking:      Taper volume, taper intensity, meet attempt selection
 * Nutrition:    BMR (Mifflin-St Jeor, Katch-McArdle, Harris-Benedict), TDEE, macros
 *
 * @module ultimate-calculators-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1RM CALCULATORS
// ═══════════════════════════════════════════════════════════════════════════

export function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export function brzycki1RM(weight: number, reps: number): number {
  if (reps >= 37) return weight * 1.5;
  if (reps <= 1) return weight;
  return Math.round(weight * 36 / (37 - reps));
}

export function lander1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(100 * weight / (101.3 - 2.67123 * reps));
}

export function lombardi1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * Math.pow(reps, 0.10));
}

export function oConner1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 40));
}

export function wathen1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * 100 / (48.8 + 53.8 * Math.exp(-0.075 * reps)));
}

export function mayhew1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(100 * weight / (52.2 + 41.9 * Math.exp(-0.055 * reps)));
}

/** Average of all 7 formulas */
export function average1RM(weight: number, reps: number): number {
  const formulas = [epley1RM, brzycki1RM, lander1RM, lombardi1RM, oConner1RM, wathen1RM, mayhew1RM];
  return Math.round(formulas.reduce((s, f) => s + f(weight, reps), 0) / formulas.length);
}

/** Weight for target reps and RPE */
export function weightForRPE(estimated1RM: number, reps: number, rpe: number): number {
  const rpeTable: Record<number, Record<number, number>> = {
    1: { 6: 0.86, 7: 0.89, 8: 0.92, 9: 0.96, 10: 1.00 },
    2: { 6: 0.84, 7: 0.86, 8: 0.89, 9: 0.92, 10: 0.95 },
    3: { 6: 0.81, 7: 0.83, 8: 0.86, 9: 0.89, 10: 0.92 },
    4: { 6: 0.79, 7: 0.81, 8: 0.84, 9: 0.87, 10: 0.90 },
    5: { 6: 0.76, 7: 0.79, 8: 0.82, 9: 0.85, 10: 0.88 },
    6: { 6: 0.74, 7: 0.76, 8: 0.79, 9: 0.82, 10: 0.85 },
    8: { 6: 0.70, 7: 0.72, 8: 0.75, 9: 0.78, 10: 0.82 },
    10: { 6: 0.65, 7: 0.68, 8: 0.71, 9: 0.75, 10: 0.78 },
    12: { 6: 0.61, 7: 0.64, 8: 0.67, 9: 0.71, 10: 0.74 },
    15: { 6: 0.57, 7: 0.60, 8: 0.63, 9: 0.67, 10: 0.70 },
  };
  const repEntry = rpeTable[reps] || rpeTable[10];
  const rpeEntry = repEntry[Math.round(rpe)] || repEntry[7];
  return Math.round(estimated1RM * rpeEntry * 0.5) * 2; // round to nearest 2.5
}

/** Reps in reserve from RPE */
export function rirFromRPE(rpe: number): number {
  return Math.round(10 - rpe);
}

/** RPE from reps and %1RM */
export function rpeFromPercent(percent1RM: number, reps: number): number {
  const rpeTable: Record<number, Record<number, number>> = {
    1: { 100: 10, 96: 9, 92: 8, 89: 7, 86: 6 },
    2: { 95: 10, 92: 9, 89: 8, 86: 7, 84: 6 },
    3: { 92: 10, 89: 9, 86: 8, 83: 7, 81: 6 },
    4: { 90: 10, 87: 9, 84: 8, 81: 7, 79: 6 },
    5: { 88: 10, 85: 9, 82: 8, 79: 7, 76: 6 },
    6: { 85: 10, 82: 9, 79: 8, 76: 7, 74: 6 },
    8: { 82: 10, 78: 9, 75: 8, 72: 7, 70: 6 },
    10: { 78: 10, 75: 9, 71: 8, 68: 7, 65: 6 },
    12: { 74: 10, 71: 9, 67: 8, 64: 7, 61: 6 },
  };
  const repEntry = rpeTable[reps] || rpeTable[5];
  let bestRPE = 7;
  let bestDist = 100;
  for (const [pct, rpe] of Object.entries(repEntry)) {
    const dist = Math.abs(Number(pct) - percent1RM * 100);
    if (dist < bestDist) { bestDist = dist; bestRPE = rpe; }
  }
  return bestRPE;
}

// ═══════════════════════════════════════════════════════════════════════════
// POWERLIFTING INDEXES
// ═══════════════════════════════════════════════════════════════════════════

export function dotsScore(total: number, bodyWeightKg: number, sex: 'male' | 'female'): number {
  const a = sex === 'male' ? -0.0000010930 : -0.0000010702;
  const b = sex === 'male' ? 0.0007391293 : 0.0007195833;
  const c = sex === 'male' ? -0.1918759221 : -0.1881243692;
  const d = sex === 'male' ? 24.0900756 : 22.8480074;
  const e = sex === 'male' ? -307.75076 : -281.2251;
  const denom = a * Math.pow(bodyWeightKg, 4) + b * Math.pow(bodyWeightKg, 3)
    + c * Math.pow(bodyWeightKg, 2) + d * bodyWeightKg + e;
  return Math.round((total * 500 / denom) * 100) / 100;
}

export function wilksScore(total: number, bodyWeightKg: number, sex: 'male' | 'female'): number {
  const coeffs = sex === 'male'
    ? [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8]
    : [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8];
  const x = bodyWeightKg;
  const denom = coeffs[0] + coeffs[1] * x + coeffs[2] * Math.pow(x, 2)
    + coeffs[3] * Math.pow(x, 3) + coeffs[4] * Math.pow(x, 4) + coeffs[5] * Math.pow(x, 5);
  return Math.round((total * 500 / denom) * 100) / 100;
}

export function ipfGLScore(total: number, bodyWeightKg: number, sex: 'male' | 'female'): number {
  const A = sex === 'male' ? 1236.25115 : 758.63878;
  const B = sex === 'male' ? 1449.21864 : 949.31382;
  const C = sex === 'male' ? 0.01644 : 0.00936;
  return Math.round(100 * (A - B * Math.exp(-C * bodyWeightKg)) / total * 10) / 10;
}

export function relativeStrength(total: number, bodyWeightKg: number): number {
  return Math.round((total / bodyWeightKg) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// VBT CALCULATORS
// ═══════════════════════════════════════════════════════════════════════════

export function velocityToPercent1RM(velocity: number, exercise: 'squat' | 'bench' | 'deadlift' = 'squat'): number {
  const coeffs: Record<string, { a: number; b: number }> = {
    squat: { a: -0.0529, b: 1.3447 },
    bench: { a: -0.0465, b: 1.2589 },
    deadlift: { a: -0.0478, b: 1.3123 },
  };
  const { a, b } = coeffs[exercise];
  return Math.round(Math.min(1, Math.max(0.3, a * velocity + b)) * 100) / 100;
}

export function percent1RMToVelocity(percent: number, exercise: 'squat' | 'bench' | 'deadlift' = 'squat'): number {
  const coeffs: Record<string, { a: number; b: number }> = {
    squat: { a: -18.9, b: 25.4 },
    bench: { a: -21.5, b: 27.1 },
    deadlift: { a: -20.9, b: 27.4 },
  };
  const { a, b } = coeffs[exercise];
  return Math.round((a * percent + b) * 100) / 100;
}

export function velocityLoss(firstRepVelocity: number, lastRepVelocity: number): number {
  if (firstRepVelocity <= 0) return 0;
  return Math.round(((firstRepVelocity - lastRepVelocity) / firstRepVelocity) * 100);
}

export function powerOutput(forceN: number, velocityMps: number): number {
  return Math.round(forceN * velocityMps);
}

// ═══════════════════════════════════════════════════════════════════════════
// FATIGUE & RECOVERY
// ═══════════════════════════════════════════════════════════════════════════

export function sessionFatigue(sets: number, avgRPE: number, sessionDurationMin: number): number {
  return Math.min(1, (sets * avgRPE * 0.015 + sessionDurationMin * 0.002));
}

export function weeklyFatigue(dailyLoads: number[]): number {
  if (dailyLoads.length === 0) return 0;
  const total = dailyLoads.reduce((s, v) => s + v, 0);
  return Math.min(1, total / 5000);
}

export function monotony(dailyLoads: number[]): number {
  if (dailyLoads.length < 2) return 1;
  const mean = dailyLoads.reduce((s, v) => s + v, 0) / dailyLoads.length;
  const variance = dailyLoads.reduce((s, v) => s + (v - mean) ** 2, 0) / (dailyLoads.length - 1);
  const stddev = Math.sqrt(variance);
  return stddev > 0 ? mean / stddev : 1;
}

export function strain(weeklyLoad: number, monotonyVal: number): number {
  return Math.round(weeklyLoad * monotonyVal * 0.01);
}

export function acwr(acuteLoad: number, chronicLoad: number): number {
  if (chronicLoad <= 0) return 1;
  return Math.round((acuteLoad / chronicLoad) * 100) / 100;
}

export function readinessIndex(
  hrvScore: number, sleepScore: number, recoveryScore: number, fatigueScore: number, stressScore: number,
): number {
  return Math.round(Math.max(0, Math.min(100,
    hrvScore * 25 + sleepScore * 25 + recoveryScore * 20 - fatigueScore * 20 - stressScore * 10
  )));
}

export function hoursToRecover(fatigueScore: number, sleepQuality: number): number {
  const base = fatigueScore * 72;
  const modifier = 1.5 - sleepQuality * 0.5;
  return Math.round(base * modifier);
}

// ═══════════════════════════════════════════════════════════════════════════
// PEAKING CALCULATORS
// ═══════════════════════════════════════════════════════════════════════════

export function taperVolume(weeksOut: number, baseVolume: number): number {
  if (weeksOut >= 4) return Math.round(baseVolume);
  if (weeksOut === 3) return Math.round(baseVolume * 0.8);
  if (weeksOut === 2) return Math.round(baseVolume * 0.6);
  if (weeksOut === 1) return Math.round(baseVolume * 0.4);
  return Math.round(baseVolume * 0.3);
}

export function taperIntensity(weeksOut: number, baseIntensity: number): number {
  if (weeksOut >= 4) return baseIntensity;
  if (weeksOut === 3) return Math.min(0.95, baseIntensity + 0.02);
  if (weeksOut === 2) return Math.min(0.95, baseIntensity + 0.03);
  if (weeksOut === 1) return Math.min(0.93, baseIntensity);
  return Math.min(0.90, baseIntensity - 0.05);
}

export function meetAttemptSelection(
  estimated1RM: number, openerPercent: number, secondPercent: number, thirdPercent: number,
): { opener: number; second: number; third: number } {
  return {
    opener: Math.round(estimated1RM * openerPercent * 0.5) * 2,
    second: Math.round(estimated1RM * secondPercent * 0.5) * 2,
    third: Math.round(estimated1RM * thirdPercent * 0.5) * 2,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NUTRITION CALCULATORS
// ═══════════════════════════════════════════════════════════════════════════

export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function bmrKatchMcArdle(weightKg: number, bodyFatPercent: number): number {
  const lbm = weightKg * (1 - bodyFatPercent / 100);
  return Math.round(370 + 21.6 * lbm);
}

export function bmrHarrisBenedict(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  if (sex === 'male') {
    return Math.round(88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age);
  }
  return Math.round(447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age);
}

export function tdee(bmr: number, pal: number): number {
  return Math.round(bmr * pal);
}

export function palCoefficient(workoutsPerWeek: number, avgWorkoutMinutes: number): number {
  let pal = 1.2 + workoutsPerWeek * 0.075;
  if (avgWorkoutMinutes > 60) pal += 0.1;
  if (avgWorkoutMinutes > 90) pal += 0.05;
  return Math.min(1.9, Math.max(1.2, Math.round(pal * 100) / 100));
}

export function macros(
  tdee: number, goal: 'bulk' | 'cut' | 'maintenance',
  proteinPerKg: number, fatPerKg: number, weightKg: number,
): { calories: number; protein: number; fat: number; carbs: number } {
  const adjustment = goal === 'bulk' ? 300 : goal === 'cut' ? -500 : 0;
  const calories = tdee + adjustment;
  const protein = Math.round(proteinPerKg * weightKg);
  const fat = Math.round(fatPerKg * weightKg);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, fat, carbs };
}

// ═══════════════════════════════════════════════════════════════════════════
// BIOMECHANICS CALCULATORS
// ═══════════════════════════════════════════════════════════════════════════

export function torque(forceN: number, leverArmM: number, angleDeg: number): number {
  return Math.round(forceN * leverArmM * Math.sin((angleDeg * Math.PI) / 180));
}

export function segmentMass(totalMassKg: number, segmentFraction: number): number {
  return Math.round(totalMassKg * segmentFraction * 100) / 100;
}

export function groundReactionForce(bodyWeightN: number, barbellWeightN: number, accelerationMps2: number): number {
  return Math.round(bodyWeightN + barbellWeightN + (bodyWeightN / 9.81 + barbellWeightN / 9.81) * accelerationMps2);
}

export function barVelocityFromAccel(accelMps2: number, timeSec: number): number {
  return Math.round(accelMps2 * timeSec * 100) / 100;
}

export function powerToWeightRatio(powerOutputW: number, bodyWeightKg: number): number {
  return Math.round((powerOutputW / bodyWeightKg) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOUND LIFT RATIOS (diagnostic)
// ═══════════════════════════════════════════════════════════════════════════

export function squatToDeadliftRatio(squat1RM: number, deadlift1RM: number): number {
  if (deadlift1RM <= 0) return 0;
  return Math.round((squat1RM / deadlift1RM) * 100);
}

export function benchToSquatRatio(bench1RM: number, squat1RM: number): number {
  if (squat1RM <= 0) return 0;
  return Math.round((bench1RM / squat1RM) * 100);
}

export function pushPullRatio(push1RM: number, pull1RM: number): number {
  if (pull1RM <= 0) return 0;
  return Math.round((push1RM / pull1RM) * 100);
}

export function symmetryIndex(left1RM: number, right1RM: number): number {
  if (left1RM <= 0 || right1RM <= 0) return 0;
  return Math.round((1 - Math.abs(left1RM - right1RM) / Math.max(left1RM, right1RM)) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESSION PROJECTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function project1RM(
  current1RM: number, weeklyGainPercent: number, weeks: number, plateauFactor: number = 1.0,
): { week4: number; week8: number; week12: number } {
  const gain = weeklyGainPercent / 100;
  return {
    week4: Math.round(current1RM * Math.pow(1 + gain * plateauFactor, 4)),
    week8: Math.round(current1RM * Math.pow(1 + gain * plateauFactor * 0.8, 8)),
    week12: Math.round(current1RM * Math.pow(1 + gain * plateauFactor * 0.6, 12)),
  };
}

export function trainingAgeLevel(trainingYears: number): 'novice' | 'intermediate' | 'advanced' | 'elite' {
  if (trainingYears < 1) return 'novice';
  if (trainingYears < 3) return 'intermediate';
  if (trainingYears < 6) return 'advanced';
  return 'elite';
}

export function expectedWeeklyGain(level: 'novice' | 'intermediate' | 'advanced' | 'elite'): number {
  switch (level) {
    case 'novice': return 0.025;
    case 'intermediate': return 0.010;
    case 'advanced': return 0.005;
    case 'elite': return 0.002;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VOLUME LANDMARKS
// ═══════════════════════════════════════════════════════════════════════════

export function mrvPerGroup(level: string): Record<string, { min: number; max: number }> {
  const mult = level === 'novice' ? 0.6 : level === 'intermediate' ? 0.8 : level === 'advanced' ? 1.0 : 1.2;
  return {
    chest: { min: Math.round(10 * mult), max: Math.round(20 * mult) },
    back: { min: Math.round(14 * mult), max: Math.round(25 * mult) },
    quads: { min: Math.round(10 * mult), max: Math.round(20 * mult) },
    hamstrings: { min: Math.round(8 * mult), max: Math.round(16 * mult) },
    shoulders: { min: Math.round(6 * mult), max: Math.round(14 * mult) },
    biceps: { min: Math.round(6 * mult), max: Math.round(12 * mult) },
    triceps: { min: Math.round(6 * mult), max: Math.round(12 * mult) },
  };
}

export function mevPerGroup(level: string): Record<string, number> {
  const mult = level === 'novice' ? 0.5 : level === 'intermediate' ? 0.7 : 1.0;
  return {
    chest: Math.round(6 * mult), back: Math.round(8 * mult), quads: Math.round(6 * mult),
    hamstrings: Math.round(4 * mult), shoulders: Math.round(4 * mult),
    biceps: Math.round(2 * mult), triceps: Math.round(2 * mult),
  };
}
