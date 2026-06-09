import type { CooldownBlock } from '../core/types';

export interface CooldownInput {
  muscleGroupsUsed: string[];
  fatigueScore: number;
  riskFlags: Record<string, string>;
  sessionDuration: number;
}

export function generateCooldown(input: CooldownInput): CooldownBlock[] {
  const blocks: CooldownBlock[] = [];

  blocks.push({
    type: 'breathing',
    durationSec: 120,
    exercises: [
      { exerciseId: 'deep_breathing', durationSec: 60 },
      { exerciseId: 'box_breathing', durationSec: 60 },
    ],
  });

  const stretchExs = getStretchExercises(input.muscleGroupsUsed, input.riskFlags);
  if (stretchExs.length > 0) {
    blocks.push({
      type: 'stretch',
      durationSec: 240,
      exercises: stretchExs,
    });
  }

  if (input.fatigueScore > 0.6 || input.sessionDuration > 5400) {
    blocks.push({
      type: 'mobility',
      durationSec: 180,
      exercises: [
        { exerciseId: 'child_pose', durationSec: 60 },
        { exerciseId: 'cat_camel', durationSec: 60 },
        { exerciseId: 'shoulder_stretch', durationSec: 60 },
      ],
    });
  }

  return blocks;
}

function getStretchExercises(muscleGroups: string[], riskFlags: Record<string, string>): { exerciseId: string; durationSec: number }[] {
  const exs: { exerciseId: string; durationSec: number }[] = [];
  if (muscleGroups.includes('chest') || muscleGroups.includes('shoulders')) {
    exs.push({ exerciseId: 'chest_stretch', durationSec: 30 }, { exerciseId: 'shoulder_stretch', durationSec: 30 });
  }
  if (muscleGroups.includes('back') || muscleGroups.includes('legs')) {
    exs.push({ exerciseId: 'lat_stretch', durationSec: 30 }, { exerciseId: 'hamstring_stretch', durationSec: 30 });
  }
  if (muscleGroups.includes('legs')) {
    exs.push({ exerciseId: 'quad_stretch', durationSec: 30 }, { exerciseId: 'glute_stretch', durationSec: 30 });
  }
  if (Object.values(riskFlags).includes('high')) {
    exs.push({ exerciseId: 'nerve_flossing', durationSec: 60 });
  }
  return exs;
}
