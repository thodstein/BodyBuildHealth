/**
 * Warmup Joints Engine — суставная подготовка под суставы, задействованные
 * целевыми группами тренировочного дня.
 *
 * Каждый сустав (плечи/локти/запястья/шея/позвоночник/бёдра/колени/
 * голеностоп) имеет 1-2 коротких упражнения. Группы дня → суставы через
 * JOINT_BY_GROUP (жимовой день: плечи+локти+запястья; ножной: бёдра+колени+
 * голеностоп; тяговый: плечи+локти+запястья+позвоночник).
 *
 * collectJointPrep(groups) — мерж с дедупликацией и приоритетом порядка
 * суставов, кап ≤ 7. Используется generateWarmup (warmup.engine) — суставы
 * идут ПЕРВЫМИ в блоке «Суставная подготовка».
 *
 * @module warmup-joints-engine
 */

import { canonicalizeGroups, type CanonGroup, type WarmupPrepExercise } from './warmup-day.engine';

/** Приоритетный порядок суставов (для слияния и подписей). */
export const JOINT_ORDER = ['shoulders', 'elbows', 'wrists', 'neck', 'spine', 'hips', 'knees', 'ankles'] as const;
export type JointKey = typeof JOINT_ORDER[number];

export const JOINT_LABELS: Record<string, string> = {
  shoulders: 'плечи', elbows: 'локти', wrists: 'запястья', neck: 'шея',
  spine: 'позвоночник', hips: 'бёдра', knees: 'колени', ankles: 'голеностоп',
};

export const JOINT_PREP: Record<string, WarmupPrepExercise[]> = {
  shoulders: [
    { id: 'shoulder_circle', sets: 1, reps: 10, note: 'круги плечами назад-вперёд' },
    { id: 'arm_circles', sets: 1, reps: 10 },
  ],
  elbows: [
    { id: 'elbow_circles', sets: 1, reps: 10, note: 'рука согнута 90°, вращение предплечья' },
  ],
  wrists: [
    { id: 'wrist_circles', sets: 1, reps: 10 },
    { id: 'wrist_rocks', sets: 1, reps: 8, note: 'раскачивание кисти вперёд-назад' },
  ],
  neck: [
    { id: 'neck_cars', sets: 1, reps: 5, note: 'медленно, полный круг головой' },
  ],
  spine: [
    { id: 'cat_camel', sets: 1, reps: 8 },
  ],
  hips: [
    { id: 'hip_circle', sets: 1, reps: 10 },
  ],
  knees: [
    { id: 'knee_circles', sets: 1, reps: 10, note: 'стопы вместе, мягкие вращения коленями' },
  ],
  ankles: [
    { id: 'ankle_mobility', sets: 1, reps: 10 },
  ],
};

/** Суставы, задействованные каждой канонической группой. */
export const JOINT_BY_GROUP: Record<CanonGroup, JointKey[]> = {
  chest: ['shoulders', 'elbows', 'wrists'],
  back: ['shoulders', 'elbows', 'wrists', 'spine'],
  quads: ['hips', 'knees', 'ankles'],
  hamstrings: ['hips', 'spine'],
  glutes: ['hips'],
  shoulders: ['shoulders', 'wrists', 'spine'],
  biceps: ['elbows', 'wrists'],
  triceps: ['elbows', 'wrists'],
  calves: ['ankles', 'knees'],
  core: ['spine'],
  traps: ['neck', 'shoulders'],
  forearms: ['wrists', 'elbows'],
};

export type JointWarmupMode = 'quick' | 'standard' | 'full';

/** Суставная подготовка для набора групп дня: гарантирует ≥1 упр. на каждый востребованный сустав, затем добирает вторые упражнения. */
export function collectJointPrep(groups: string[], mode?: JointWarmupMode): WarmupPrepExercise[] {
  const wanted = new Set<JointKey>();
  for (const g of groups) {
    for (const canon of canonicalizeGroups(g)) {
      for (const j of JOINT_BY_GROUP[canon] || []) wanted.add(j);
    }
  }
  if (wanted.size === 0) return [];
  const wantedList = JOINT_ORDER.filter(j => wanted.has(j));
  const seen = new Set<string>();
  const out: WarmupPrepExercise[] = [];
  for (const joint of wantedList) {
    const pool = JOINT_PREP[joint] || [];
    if (pool.length > 0 && !seen.has(pool[0].id)) { seen.add(pool[0].id); out.push(pool[0]); }
  }
  const CAP = mode === 'quick' ? 5 : mode === 'full' ? 11 : 9;
  for (const joint of wantedList) {
    if (out.length >= CAP) break;
    const pool = JOINT_PREP[joint] || [];
    for (let i = 1; i < pool.length; i++) {
      if (out.length >= CAP) break;
      if (!seen.has(pool[i].id)) { seen.add(pool[i].id); out.push(pool[i]); }
    }
  }
  out.sort((a, b) => {
    const jointA = Object.keys(JOINT_PREP).find(k => JOINT_PREP[k].some(e => e.id === a.id)) as JointKey | undefined;
    const jointB = Object.keys(JOINT_PREP).find(k => JOINT_PREP[k].some(e => e.id === b.id)) as JointKey | undefined;
    const idxA = jointA ? JOINT_ORDER.indexOf(jointA) : 99;
    const idxB = jointB ? JOINT_ORDER.indexOf(jointB) : 99;
    return idxA - idxB;
  });
  return out.slice(0, CAP);
}

/** Русские подписи суставов дня («плечи, локти, запястья»). */
export function jointPrepLabels(groups: string[]): string {
  const wanted = new Set<JointKey>();
  for (const g of groups) {
    for (const canon of canonicalizeGroups(g)) {
      for (const j of JOINT_BY_GROUP[canon] || []) wanted.add(j);
    }
  }
  return JOINT_ORDER.filter(j => wanted.has(j)).map(j => JOINT_LABELS[j]).join(', ');
}
