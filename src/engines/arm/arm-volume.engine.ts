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
  tendonLoad?: number;
}): number {
  const base = input.level === 'enhanced' ? 22 : input.level === 'advanced' ? 18 : input.level === 'intermediate' ? 15 : 12;
  let mult = 1;
  if (input.recoveryMult) mult *= input.recoveryMult;
  if (input.labMult) mult *= Math.max(0.6, Math.min(1.4, input.labMult));
  if (input.nutritionMult) mult *= Math.max(0.85, Math.min(1.15, input.nutritionMult));
  // Tendon load штрафует бюджет при перегрузе (PRO: tendon адаптируется 3× медленнее)
  if (input.tendonLoad != null && input.tendonLoad > 18) mult *= 0.92;
  if (input.tendonLoad != null && input.tendonLoad > 22) mult *= 0.88;
  return Math.round(base * mult);
}

export function tendonBudgetForLevel(level: string): number {
  const lvl = (level || '').toLowerCase();
  if (lvl === 'beginner') return 12;
  if (lvl === 'intermediate') return 16;
  if (lvl === 'advanced') return 18;
  return 22;
}

export function sessionLimitsForArm(input: {
  level?: string;
  onCourse?: boolean;
  recoveryMult?: number;
  discipline?: string;
}): { maxExercises: number; maxSets: number } {
  const lvl = (input.level || '').toLowerCase();
  const enhanced = lvl === 'enhanced';
  const disc = (input.discipline || 'armwrestling').toLowerCase();
  // armlifting — тяжёлый CNS (хват), лимиты жёстче чем armwrestling
  let maxEx = enhanced ? 8 : 6;
  let maxSets = enhanced ? 14 : 10;
  if (disc === 'armlifting') {
    maxEx = enhanced ? 6 : 5;
    maxSets = enhanced ? 12 : 8;
  } else if (disc === 'hybrid') {
    maxEx = enhanced ? 7 : 6;
    maxSets = enhanced ? 13 : 9;
  }
  if (input.recoveryMult && input.recoveryMult < 0.8) {
    maxEx = Math.max(4, maxEx - 1);
    maxSets = Math.max(6, maxSets - 2);
  }
  return { maxExercises: maxEx, maxSets };
}

export function perExerciseCap(muscle: string, level?: string): number {
  if (muscle === 'side_pressure') return 3; // humerus guard
  if (muscle === 'thumb' || muscle === 'risers') return 4;
  if (muscle === 'grip_pinch' || muscle === 'grip_crush' || muscle === 'grip_support') {
    // хват — отдельные капы: support 5, pinch/crush 4 (hub отдельно)
    if (muscle === 'grip_support') return (level || '').toLowerCase() === 'enhanced' ? 6 : 5;
    return 4;
  }
  if (muscle === 'grip_pinch' && (level || '').toLowerCase() === 'enhanced') return 5;
  const lvl = (level || '').toLowerCase();
  if (lvl === 'enhanced') return 6;
  return 5;
}

/** Indirect вклады (расширены до 12, как BB 15). */
export const ARM_INDIRECT: Record<string, Array<{ muscle: string; factor: number }>> = {
  hammer_curl: [{ muscle: 'wrist_flexors', factor: 0.3 }, { muscle: 'brachioradialis', factor: 0.2 }],
  reverse_curl: [{ muscle: 'wrist_extensors', factor: 0.25 }, { muscle: 'brachialis', factor: 0.15 }],
  pronation: [{ muscle: 'wrist_flexors', factor: 0.2 }, { muscle: 'brachioradialis', factor: 0.3 }],
  supination: [{ muscle: 'biceps_long', factor: 0.2 }, { muscle: 'brachialis', factor: 0.25 }],
  back_drag: [{ muscle: 'biceps_long', factor: 0.3 }, { muscle: 'brachialis', factor: 0.2 }],
  side_press: [{ muscle: 'shoulder_stab', factor: 0.3 }, { muscle: 'core_anchor', factor: 0.2 }],
  cupping: [{ muscle: 'risers', factor: 0.2 }, { muscle: 'thumb', factor: 0.15 }],
  rising: [{ muscle: 'wrist_flexors', factor: 0.15 }, { muscle: 'thumb', factor: 0.25 }],
  grip_support: [{ muscle: 'wrist_flexors', factor: 0.2 }, { muscle: 'thumb', factor: 0.1 }],
  grip_pinch: [{ muscle: 'thumb', factor: 0.3 }, { muscle: 'risers', factor: 0.2 }],
  grip_crush: [{ muscle: 'brachioradialis', factor: 0.15 }],
  ulnar_deviation: [{ muscle: 'wrist_flexors', factor: 0.15 }],
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
    else if (input.calorieSurplus < -300) m *= 0.93;
    else if (input.calorieSurplus > 300) m *= 1.05;
  }
  if (input.proteinPerKg != null) {
    // Для арм: белок <1.6 уже штраф (коллаген синтез), <1.4 сильнее
    if (input.proteinPerKg < 1.4) m *= 0.9;
    else if (input.proteinPerKg < 1.6) m *= 0.94;
    else if (input.proteinPerKg >= 2.2) m *= 1.04;
    else if (input.proteinPerKg >= 2.0) m *= 1.03;
  }
  return m;
}
