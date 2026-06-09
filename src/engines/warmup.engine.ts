import type { WarmupBlock } from '../core/types';

export interface WarmupInput {
  sessionFocus: string;
  primaryExercises: string[];
  riskFlags: Record<string, string>;
  techniqueIssues: string[];
  fatigueLevel: number;
  equipmentAvailable: string[];
}

export function generateWarmup(input: WarmupInput): WarmupBlock[] {
  const blocks: WarmupBlock[] = [];

  if (input.fatigueLevel > 0.7) {
    blocks.push({
      type: 'general',
      durationSec: 300,
      exercises: [{ exerciseId: 'light_cardio', sets: 1, reps: 1 }],
      notes: 'Сниженный объём разминки — высокая усталость',
    });
  } else {
    blocks.push({
      type: 'general',
      durationSec: 300,
      exercises: [
        { exerciseId: 'jumping_jack', sets: 1, reps: 30 },
        { exerciseId: 'arm_circles', sets: 1, reps: 10 },
        { exerciseId: 'leg_swings', sets: 1, reps: 10 },
      ],
    });
  }

  const mobilityExs = getMobilityExercises(input.sessionFocus, input.riskFlags);
  if (mobilityExs.length > 0) {
    blocks.push({
      type: 'mobility',
      durationSec: 180,
      exercises: mobilityExs,
      notes: 'Суставная подготовка',
    });
  }

  const activationExs = getActivationExercises(input.riskFlags, input.techniqueIssues);
  if (activationExs.length > 0) {
    blocks.push({
      type: 'activation',
      durationSec: 180,
      exercises: activationExs,
      notes: 'Активация мышц',
    });
  }

  blocks.push({
    type: 'specific',
    durationSec: 300,
    exercises: [
      { exerciseId: input.primaryExercises[0] || 'squat', sets: 3, reps: 5, intensityPct: 50 },
    ],
    notes: 'Разминочные подходы',
  });

  return blocks;
}

function getMobilityExercises(sessionFocus: string, riskFlags: Record<string, string>): { exerciseId: string; sets: number; reps: number }[] {
  const exs: { exerciseId: string; sets: number; reps: number }[] = [];
  if (['squat', 'legs', 'lower', 'fullbody'].includes(sessionFocus)) {
    exs.push({ exerciseId: 'hip_circle', sets: 1, reps: 10 }, { exerciseId: 'ankle_mobility', sets: 1, reps: 10 });
  }
  if (['bench', 'upper', 'push', 'fullbody'].includes(sessionFocus)) {
    exs.push({ exerciseId: 'shoulder_circle', sets: 1, reps: 10 }, { exerciseId: 'thoracic_rotation', sets: 1, reps: 8 });
  }
  if (Object.values(riskFlags).includes('high')) {
    exs.push({ exerciseId: 'cat_camel', sets: 1, reps: 8 }, { exerciseId: 'worlds_greatest', sets: 1, reps: 6 });
  }
  return exs;
}

function getActivationExercises(riskFlags: Record<string, string>, techniqueIssues: string[]): { exerciseId: string; sets: number; reps: number }[] {
  const exs: { exerciseId: string; sets: number; reps: number }[] = [];
  if (riskFlags['knee'] === 'high' || techniqueIssues.includes('knee_valgus')) {
    exs.push({ exerciseId: 'banded_clam', sets: 2, reps: 15 });
  }
  if (riskFlags['shoulder'] === 'high') {
    exs.push({ exerciseId: 'external_rotation', sets: 2, reps: 12 });
  }
  if (techniqueIssues.includes('rounding_back')) {
    exs.push({ exerciseId: 'bird_dog', sets: 2, reps: 10 }, { exerciseId: 'dead_bug', sets: 1, reps: 10 });
  }
  return exs;
}
