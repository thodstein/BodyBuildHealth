import type { ExerciseOrderItem, ExerciseSlotRole, MovementPattern } from '../core/types';

export interface OrderingInput {
  sessionFocus: string;
  items: ExerciseOrderCandidate[];
  fatigueScore: number;
  riskFlags: Record<string, string>;
  priScore: number;
}

export interface ExerciseOrderCandidate {
  exerciseId: string;
  role: ExerciseSlotRole;
  pattern: MovementPattern;
  difficulty: number;
  jointStress: number;
  isCompound: boolean;
  isTechnical: boolean;
}

export function determineOrder(input: OrderingInput): ExerciseOrderItem[] {
  const scored = input.items.map(item => {
    let priorityScore = 0;
    const reasons: string[] = [];

    if (item.role === 'main') { priorityScore += 100; reasons.push('основное упражнение — приоритет'); }
    if (item.isTechnical) { priorityScore += 50; reasons.push('технически сложное — в начало'); }
    if (item.isCompound) { priorityScore += 40; reasons.push('многосуставное — в начало'); }
    if (item.difficulty >= 4) { priorityScore += 30; reasons.push('высокая сложность — раньше'); }
    if (item.jointStress >= 3) { priorityScore += 20; reasons.push('высокая нагрузка на суставы — раньше'); }

    if (item.role === 'accessory') { priorityScore -= 30; reasons.push('подсобное — позже'); }
    if (item.role === 'rehab') { priorityScore -= 50; reasons.push('реабилитация — в конце'); }
    if (item.role === 'warmup') { priorityScore -= 60; reasons.push('разминка — в конце'); }

    if (input.fatigueScore > 0.6 && item.difficulty >= 4) { priorityScore -= 20; reasons.push('высокая усталость — сложное позже'); }
    if (Object.values(input.riskFlags).includes('high') && item.jointStress >= 3) { priorityScore -= 30; reasons.push('высокий риск — опасное позже'); }
    if (input.priScore < 0.4 && item.isTechnical) { priorityScore -= 25; reasons.push('низкая готовность — техника позже'); }

    return {
      exerciseId: item.exerciseId,
      role: item.role,
      pattern: item.pattern,
      difficulty: item.difficulty,
      jointStress: item.jointStress,
      priorityScore,
      rationale: reasons.join('; '),
    };
  });

  return scored.sort((a, b) => b.priorityScore - a.priorityScore);
}
