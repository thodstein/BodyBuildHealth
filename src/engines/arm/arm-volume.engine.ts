/**
 * arm-volume.engine.ts — бюджеты, indirect, session limits для арм-планировщика.
 * Зеркало bb-volume.engine.ts, но с tendon-учётом и arm-спецификой.
 */

export interface ArmRecoveryInput {
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
}

export function computeArmRecoveryScore(input: ArmRecoveryInput): number {
  let score = 100;
  if (input.bodyFat != null) {
    if (input.bodyFat < 8) score -= 10;
    else if (input.bodyFat > 25) score -= 8;
  }
  if (input.hrvMs != null) {
    if (input.hrvMs < 40) score -= 12;
    else if (input.hrvMs < 60) score -= 6;
  }
  if (input.sleepHours != null) {
    if (input.sleepHours < 6) score -= 15;
    else if (input.sleepHours < 7) score -= 7;
    else if (input.sleepHours >= 9) score += 2;
  }
  if (input.stressLevel != null) {
    if (input.stressLevel >= 8) score -= 12;
    else if (input.stressLevel >= 6) score -= 6;
  }
  return Math.max(30, Math.min(110, score));
}

export function recoveryScoreToMult(score: number): number {
  if (score >= 95) return 1.1;
  if (score >= 85) return 1.0;
  if (score >= 70) return 0.9;
  if (score >= 55) return 0.8;
  return 0.65;
}

export function computeArmRecoveryMult(input: ArmRecoveryInput): number {
  return recoveryScoreToMult(computeArmRecoveryScore(input));
}

export function computeArmBudget(input: {
  onCourse?: boolean;
  recoveryMult?: number;
  labMult?: number;
  nutritionMult?: number;
  level?: string;
}): number {
  const base = input.level === 'enhanced' ? 22 : input.level === 'advanced' ? 18 : input.level === 'intermediate' ? 15 : 12;
  let mult = 1;
  if (input.recoveryMult) mult *= input.recoveryMult;
  if (input.labMult) mult *= Math.max(0.6, Math.min(1.4, input.labMult));
  if (input.nutritionMult) mult *= Math.max(0.85, Math.min(1.15, input.nutritionMult));
  return Math.round(base * mult);
}

export function sessionLimitsForArm(input: {
  level?: string;
  onCourse?: boolean;
  recoveryMult?: number;
}): { maxExercises: number; maxSets: number } {
  const lvl = (input.level || '').toLowerCase();
  const enhanced = lvl === 'enhanced';
  let maxEx = enhanced ? 8 : 6;
  let maxSets = enhanced ? 14 : 10;
  if (input.recoveryMult && input.recoveryMult < 0.8) {
    maxEx = Math.max(4, maxEx - 1);
    maxSets = Math.max(6, maxSets - 2);
  }
  return { maxExercises: maxEx, maxSets };
}

export function perExerciseCap(muscle: string, level?: string): number {
  if (muscle === 'side_pressure') return 3; // humerus guard
  if (muscle === 'thumb' || muscle === 'risers') return 4;
  const lvl = (level || '').toLowerCase();
  if (lvl === 'enhanced') return 6;
  return 5;
}

/** Indirect вклады (консервативные, как bb). */
export const ARM_INDIRECT: Record<string, Array<{ muscle: string; factor: number }>> = {
  hammer_curl: [{ muscle: 'wrist_flexors', factor: 0.3 }, { muscle: 'brachioradialis', factor: 0.2 }],
  reverse_curl: [{ muscle: 'wrist_extensors', factor: 0.25 }],
  pronation: [{ muscle: 'wrist_flexors', factor: 0.2 }],
  supination: [{ muscle: 'biceps_long', factor: 0.2 }],
  back_drag: [{ muscle: 'biceps_long', factor: 0.3 }, { muscle: 'brachialis', factor: 0.2 }],
  side_press: [{ muscle: 'shoulder_stab', factor: 0.3 }],
};

export function indirectForExercise(pattern: string): Array<{ muscle: string; factor: number }> {
  const key = pattern.toLowerCase();
  for (const [k, v] of Object.entries(ARM_INDIRECT)) {
    if (key.includes(k)) return v;
  }
  return [];
}

export function aggregateArmVolume(
  weeks: Array<{ sessions: Array<{ exercises: Array<{ muscle: string; sets: number; movementPattern?: string }> }> }>,
): Record<string, { directSets: number; effectiveSets: number; tendonSets: number }> {
  const out: Record<string, { directSets: number; effectiveSets: number; tendonSets: number }> = {};
  for (const wk of weeks) {
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        const m = ex.muscle;
        if (!out[m]) out[m] = { directSets: 0, effectiveSets: 0, tendonSets: 0 };
        out[m].directSets += ex.sets;
        out[m].effectiveSets += ex.sets;
        // indirect
        const indirect = indirectForExercise(ex.movementPattern || ex.muscle);
        for (const ind of indirect) {
          if (!out[ind.muscle]) out[ind.muscle] = { directSets: 0, effectiveSets: 0, tendonSets: 0 };
          out[ind.muscle].effectiveSets += ex.sets * ind.factor;
        }
        // tendon
        const isTendon = ['wrist_flexors','wrist_extensors','pronators','supinators','risers','thumb','ulnar_deviators','radial_deviators'].includes(m);
        if (isTendon) out[m].tendonSets += ex.sets;
      }
    }
  }
  return out;
}

export function computeNutritionMult(input: { calorieSurplus?: number; proteinPerKg?: number }): number {
  let m = 1;
  if (input.calorieSurplus != null) {
    if (input.calorieSurplus < -500) m *= 0.9;
    else if (input.calorieSurplus > 300) m *= 1.05;
  }
  if (input.proteinPerKg != null) {
    if (input.proteinPerKg < 1.4) m *= 0.92;
    else if (input.proteinPerKg >= 2.0) m *= 1.03;
  }
  return m;
}
