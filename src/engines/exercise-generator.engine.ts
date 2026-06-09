import type { ExerciseSlot, ExerciseSlotRole, MovementPattern } from '../core/types';
import { getRequiredPatterns, getBlockedPatterns } from './exercise-pattern.engine';
import { selectVariation } from './exercise-variation.engine';
import { findSubstitute, scoreEquipmentMatch } from './exercise-substitution.engine';

export interface ExerciseGeneratorInput {
  sessionFocus: string;
  goal: string;
  equipmentAvailable: string[];
  weakPoints: string[];
  techniqueIssues: string[];
  riskFlags: Record<string, string>;
  injuries: { joint?: string; severity?: string }[];
  jointLimitations: Record<string, string>;
  userLevel: string;
}

export interface ExerciseGeneratorOutput {
  exerciseSlots: ExerciseSlot[];
  substitutions: { original: string; substitute: string; reason: string }[];
  warnings: string[];
}

export function generateExercises(input: ExerciseGeneratorInput): ExerciseGeneratorOutput {
  const blockedPatterns = getBlockedPatterns(input.injuries, input.jointLimitations);
  const requiredPatterns = getRequiredPatterns(input.sessionFocus, input.goal, input.weakPoints, blockedPatterns);
  const slots: ExerciseSlot[] = [];
  const substitutions: { original: string; substitute: string; reason: string }[] = [];
  const warnings: string[] = [];

  if (blockedPatterns.length > 0) {
    warnings.push(`Исключены паттерны: ${blockedPatterns.join(', ')}`);
  }

  for (const req of requiredPatterns) {
    const variation = selectVariation(
      req.pattern,
      input.weakPoints,
      input.equipmentAvailable,
      input.riskFlags,
      input.techniqueIssues
    );

    const equipScore = scoreEquipmentMatch(
      getDefaultEquipment(req.pattern),
      input.equipmentAvailable
    );

    if (equipScore < 50) {
      const sub = findSubstitute(
        variation.exerciseId,
        req.pattern,
        input.equipmentAvailable,
        getDefaultEquipment(req.pattern)
      );
      if (sub) {
        substitutions.push({ original: variation.exerciseId, substitute: sub.substituteExerciseId, reason: sub.reason });
        slots.push({
          slotType: req.role,
          exerciseId: sub.substituteExerciseId,
          pattern: req.pattern,
          equipment: input.equipmentAvailable,
          riskScore: variation.riskModifier,
          techniqueMatchScore: variation.techniqueModifier,
          targetWeakPoint: variation.targetWeakPoint,
        });
        continue;
      }
    }

    if (variation.score < 30) {
      warnings.push(`Не удалось подобрать вариацию для ${req.pattern}`);
    }

    slots.push({
      slotType: req.role,
      exerciseId: variation.exerciseId,
      variationId: variation.variationTags[0],
      pattern: req.pattern,
      equipment: input.equipmentAvailable,
      riskScore: variation.riskModifier,
      techniqueMatchScore: variation.techniqueModifier,
      targetWeakPoint: variation.targetWeakPoint,
    });
  }

  return { exerciseSlots: slots, substitutions, warnings };
}

function getDefaultEquipment(pattern: MovementPattern): string[] {
  const map: Record<string, string[]> = {
    squat: ['barbell', 'rack'],
    hinge: ['barbell'],
    horizontal_push: ['barbell', 'bench'],
    horizontal_pull: ['barbell'],
    vertical_push: ['barbell'],
    vertical_pull: ['bodyweight'],
    lunge: ['dumbbell'],
    carry: ['dumbbell'],
    rotation: ['cable'],
    anti_rotation: ['bodyweight'],
    core: ['bodyweight'],
  };
  return map[pattern] || ['bodyweight'];
}
