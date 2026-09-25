import { ARM_MUSCLES, type ArmMuscle } from './arm-types';

export type ArmTendonMuscle =
  | 'wrist_flexors'
  | 'wrist_extensors'
  | 'pronators'
  | 'supinators'
  | 'risers'
  | 'ulnar_deviators'
  | 'radial_deviators'
  | 'thumb';

export const ARM_TENDON_MUSCLES: readonly ArmTendonMuscle[] = [
  'wrist_flexors',
  'wrist_extensors',
  'pronators',
  'supinators',
  'risers',
  'ulnar_deviators',
  'radial_deviators',
  'thumb',
];

export const ARM_TENDON_MUSCLE_SET: ReadonlySet<string> = new Set(ARM_TENDON_MUSCLES);
export const ARM_TENDON_SET = ARM_TENDON_MUSCLE_SET;

const ARM_MUSCLE_ALIASES: Readonly<Record<string, ArmMuscle>> = {
  wrist: 'wrist_flexors',
  wrist_flexion: 'wrist_flexors',
  wrist_flexor: 'wrist_flexors',
  wrist_extensor: 'wrist_extensors',
  wrist_extension: 'wrist_extensors',
  pronation: 'pronators',
  pronator: 'pronators',
  supination: 'supinators',
  supinator: 'supinators',
  riser: 'risers',
  rising: 'risers',
  finger: 'risers',
  fingers: 'risers',
  finger_extensors: 'risers',
  ulnar: 'ulnar_deviators',
  ulnar_deviation: 'ulnar_deviators',
  ulnar_deviator: 'ulnar_deviators',
  radial: 'radial_deviators',
  radial_deviation: 'radial_deviators',
  radial_deviator: 'radial_deviators',
  thumb_iso: 'thumb',
  thumb_isometric: 'thumb',
  сгибатели_кисти: 'wrist_flexors',
  разгибатели_кисти: 'wrist_extensors',
  пронаторы: 'pronators',
  супинаторы: 'supinators',
  разгибатели_пальцев: 'risers',
  пальцы: 'risers',
  локтевые_девиаторы: 'ulnar_deviators',
  лучевые_девиаторы: 'radial_deviators',
  большой_палец: 'thumb',
};

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_а-яё]/gi, '');
}

export function canonicalizeArmMuscle(value: unknown): ArmMuscle | null {
  const key = normalizeKey(value);
  if (!key) return null;
  if ((ARM_MUSCLES as readonly string[]).includes(key)) return key as ArmMuscle;
  return ARM_MUSCLE_ALIASES[key] ?? null;
}

export function canonicalizeArmTendonMuscle(value: unknown): ArmTendonMuscle | null {
  const muscle = canonicalizeArmMuscle(value);
  return muscle && ARM_TENDON_MUSCLE_SET.has(muscle) ? muscle as ArmTendonMuscle : null;
}

export function isArmTendonMuscle(value: unknown): value is ArmTendonMuscle {
  return canonicalizeArmTendonMuscle(value) != null;
}

export function armTendonSet(values: Iterable<unknown> | string | null | undefined): ArmTendonMuscle[] {
  const source = typeof values === 'string'
    ? [values]
    : values == null
      ? []
      : Array.isArray(values)
        ? values
        : Array.from(values);
  const out = new Set<ArmTendonMuscle>();
  for (const value of source) {
    const muscle = canonicalizeArmTendonMuscle(value);
    if (muscle) out.add(muscle);
  }
  return ARM_TENDON_MUSCLES.filter((muscle) => out.has(muscle));
}

export interface ArmTendonExerciseLike {
  sets?: number;
  workSets?: Array<unknown>;
  muscle?: string;
  muscleGroup?: string;
}

export function armExerciseSetCount(exercise: ArmTendonExerciseLike | null | undefined): number {
  const direct = Number(exercise?.sets);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return Array.isArray(exercise?.workSets) ? exercise.workSets.length : 0;
}

export function armTendonSetForExercises(exercises: Array<ArmTendonExerciseLike | null | undefined> | null | undefined): {
  totalSets: number;
  byMuscle: Record<string, number>;
} {
  const byMuscle: Record<string, number> = {};
  let totalSets = 0;
  for (const exercise of exercises || []) {
    const muscle = canonicalizeArmTendonMuscle(exercise?.muscle || exercise?.muscleGroup);
    if (!muscle) continue;
    const sets = armExerciseSetCount(exercise);
    if (!Number.isFinite(sets) || sets <= 0) continue;
    byMuscle[muscle] = (byMuscle[muscle] || 0) + sets;
    totalSets += sets;
  }
  return { totalSets, byMuscle };
}

export function countArmTendonSets(exercises: Array<ArmTendonExerciseLike | null | undefined> | null | undefined): number {
  return armTendonSetForExercises(exercises).totalSets;
}
