/**
 * Exercise Ordering Engine — Determines optimal exercise sequence in a session.
 *
 * Priority system (higher = earlier in workout):
 *  1. Technique-heavy lifts (snatch, clean — highest CNS demand)
 *  2. Main strength lifts (squat, bench, deadlift)
 *  3. Secondary variations (pause, tempo, deficit)
 *  4. High joint-stress accessories
 *  5. Medium accessories
 *  6. Isolation / rehab work
 *
 * Adjustments:
 *  - High fatigue: push heavy lifts earlier (fewer reps left in tank later)
 *  - High risk on a joint: deprioritize exercises loading that joint
 *  - Low PRI (readiness): reduce main lift priority, more accessories
 *
 * @module exercise-ordering-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type ExerciseRole = 'main' | 'secondary' | 'accessory' | 'rehab' | 'warmup';

export interface ExerciseSlot {
  exerciseId: string;
  name: string;
  role: ExerciseRole;
  pattern: 'squat' | 'hinge' | 'horizontal_push' | 'horizontal_pull' | 'vertical_push' | 'vertical_pull' | 'lunge' | 'carry' | 'rotation' | 'accessory' | 'rehab';
  jointStress: {
    knee: number;
    hip: number;
    spine: number;
    shoulder: number;
    elbow: number;
    ankle: number;
  };
  technicalComplexity: number; // 1-5
  cnsDemand: number; // 1-5
  isUnilateral: boolean;
  sets: number;
  intensity: number; // % 1RM
}

export interface OrderingInput {
  exercises: ExerciseSlot[];
  sessionFocus: string;
  fatigueLevel: number; // 0-1
  priScore: number; // 0-1
  riskSnapshot: Record<string, 'low' | 'medium' | 'high'>;
  techniqueIssues: string[];
}

export interface OrderedOutput {
  orderedExercises: ExerciseSlot[];
  orderingRationale: string[];
  priorityScores: number[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Priority scoring
// ═══════════════════════════════════════════════════════════════════════════

function calcPriorityScore(ex: ExerciseSlot, input: OrderingInput): number {
  let score = 0;

  // Base: role
  switch (ex.role) {
    case 'warmup': score = 100; break;
    case 'main': score = 90; break;
    case 'secondary': score = 70; break;
    case 'accessory': score = 40; break;
    case 'rehab': score = 20; break;
  }

  // Pattern bonus: main lifts higher
  const mainPatterns = ['squat', 'hinge', 'horizontal_push', 'horizontal_pull'];
  if (ex.role === 'main' && mainPatterns.includes(ex.pattern)) score += 5;

  // Technical complexity: complex lifts first (while fresh)
  score += ex.technicalComplexity * 2;

  // CNS demand: high CNS = earlier
  score += ex.cnsDemand * 1.5;

  // Intensity bonus: higher %1RM = earlier
  score += ex.intensity * 10;

  // Unilateral: slightly later (balance work after strength)
  if (ex.isUnilateral) score -= 10;

  // ── Penalties ──

  // Fatigue penalty: high fatigue = deprioritize heavy lifts
  if (ex.role === 'main' && input.fatigueLevel > 0.6) score -= 15;
  if (input.fatigueLevel > 0.8 && ex.intensity > 0.8) score -= 20;

  // Risk penalty: deprioritize exercises loading risky joints
  if (input.riskSnapshot.knee === 'high' && ex.jointStress.knee > 5) score -= 25;
  if (input.riskSnapshot.shoulder === 'high' && ex.jointStress.shoulder > 5) score -= 25;
  if (input.riskSnapshot.spine === 'high' && ex.jointStress.spine > 6) score -= 30;

  // PRI penalty: low readiness = push high-CNS later
  if (input.priScore < 0.4 && ex.cnsDemand > 3) score -= 10;

  // Technique penalty: poor technique on this pattern
  if (input.techniqueIssues.some(t => ex.pattern.includes(t))) score -= 5;

  return score;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function orderExercises(input: OrderingInput): OrderedOutput {
  const rationale: string[] = [];
  const scored = input.exercises.map(ex => ({
    ex,
    score: calcPriorityScore(ex, input),
  }));

  // Safety rule: if risk is high on a joint, push its exercises to the bottom
  const highRiskJoints = Object.entries(input.riskSnapshot)
    .filter(([, v]) => v === 'high')
    .map(([k]) => k);

  if (highRiskJoints.length > 0) {
    rationale.push(`Высокий риск: ${highRiskJoints.join(', ')} — упражнения на эти суставы в конец`);
    for (const item of scored) {
      for (const joint of highRiskJoints) {
        const jk = joint as keyof ExerciseSlot['jointStress'];
        if (item.ex.jointStress[jk] > 5) item.score -= 50;
      }
    }
  }

  // Fatigue rule: if fatigue > 0.7, deprioritize all heavy work
  if (input.fatigueLevel > 0.7) {
    rationale.push(`Высокая усталость (${(input.fatigueLevel * 100).toFixed(0)}%) — снижение приоритета тяжёлой работы`);
  }

  // Sort: highest score first
  scored.sort((a, b) => b.score - a.score);

  // Build ordering rationale
  for (let i = 0; i < scored.length; i++) {
    const item = scored[i];
    const label = i < scored.length / 3 ? 'начало' : i < (2 * scored.length) / 3 ? 'середина' : 'конец';
    if (i === 0) {
      rationale.push(`${item.ex.name} (${item.score.toFixed(0)} баллов) — открывает тренировку`);
    }
  }

  return {
    orderedExercises: scored.map(s => s.ex),
    orderingRationale: rationale,
    priorityScores: scored.map(s => Math.round(s.score)),
  };
}
