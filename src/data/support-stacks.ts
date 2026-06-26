import type { SupportStack } from './support-stacks-types';
import { STACKS_PART_1 } from './support-stacks-part1';
import { STACKS_PART_2 } from './support-stacks-part2';
import { STACKS_PART_3 } from './support-stacks-late';

export type { StackSubstance, SupportStack } from './support-stacks-types';
export { EFFECT_LABELS_ru, getStackSubstanceLabel } from './support-stacks-types';
export { STACKS_PART_1 } from './support-stacks-part1';
export { STACKS_PART_2 } from './support-stacks-part2';
export { STACKS_PART_3 } from './support-stacks-late';

export const ALL_STACKS: SupportStack[] = [
  ...STACKS_PART_1,
  ...STACKS_PART_2,
  ...STACKS_PART_3,
];

export function findStacksByEffect(effect: string): SupportStack[] {
  return ALL_STACKS.filter(s => s.effects?.includes(effect));
}

export function findStacksBySubstance(substanceId: string): SupportStack[] {
  return ALL_STACKS.filter(s => s.substances.some(sub => sub.id === substanceId));
}

export function getStackSize(id: string): number { return ALL_STACKS.find(s=>s.id===id)?.substances.length??0; }
