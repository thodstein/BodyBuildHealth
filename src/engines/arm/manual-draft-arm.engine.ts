/**
 * manual-draft-arm.engine.ts — автосборка арм-планов для ручного конструктора.
 * Зеркало manual-draft.engine.ts (autodraftBBPlan).
 */
import { selectBestArmSplit } from './arm-selector.engine';
import { buildArmPlan } from './arm-builder.engine';
import { finalizeArmPlan } from './arm-finalize.engine';
import type { ArmBuilderInput } from './arm-types';

export interface AutoDraftArmOptions {
  level: string;
  goal?: string;
  discipline?: string;
  technique?: string;
  gripFocus?: string;
  gripImplement?: string;
  daysPerWeek: number;
  weeks: number;
  splitPattern?: string;
  weakPoints?: string[];
  focusGroup?: string;
  specialization?: boolean;
  equipment?: string[];
  favoriteExercises?: string[];
  excludedExercises?: string[];
  workMax?: Record<string, number>;
  injuries?: Array<{ muscle: string; exclude?: boolean }>;
  sex?: 'male' | 'female';
  previousPlan?: any;
}

export function autodraftArmPlan(opts: AutoDraftArmOptions): any {
  const patternId = opts.splitPattern || selectBestArmSplit({
    level: opts.level,
    goal: opts.goal as any,
    technique: opts.technique,
    discipline: opts.discipline,
    daysPerWeek: opts.daysPerWeek,
    gripFocus: opts.gripFocus,
    weakPoints: opts.weakPoints,
    equipment: opts.equipment,
    injuries: opts.injuries as any,
  }).id;

  const weeks = Math.max(1, Math.min(52, Math.round(opts.weeks || 8)));
  const buildWeeks = Math.min(weeks, 16);

  const input: ArmBuilderInput = {
    discipline: (opts.discipline as any) || 'armwrestling',
    patternId,
    level: opts.level,
    goal: (opts.goal as any) || 'strength',
    technique: (opts.technique as any) || 'balanced',
    weeks: buildWeeks,
    gripFocus: opts.gripFocus as any,
    gripImplement: opts.gripImplement as any,
    workMax: opts.workMax,
    weakPoints: opts.weakPoints,
    focusGroup: opts.focusGroup,
    specialization: !!opts.specialization,
    equipment: opts.equipment,
    favoriteExercises: opts.favoriteExercises,
    excludedExercises: opts.excludedExercises,
    injuries: opts.injuries as any,
    sex: opts.sex as any,
    previousPlan: opts.previousPlan as any,
  };

  let plan = buildArmPlan(input);
  plan = finalizeArmPlan(plan, { level: opts.level });

  // расширение >16 нед (циклически, как BB)
  if (weeks > buildWeeks) {
    const baseWeeks = plan.weeks;
    const extended: any[] = [...baseWeeks];
    for (let w = buildWeeks + 1; w <= weeks; w++) {
      const src = baseWeeks[(w - 1) % baseWeeks.length];
      const clone = JSON.parse(JSON.stringify(src));
      clone.week = w;
      // лёгкая прогрессия +0.5%/нед
      const mult = 1 + (w - buildWeeks) * 0.005;
      for (const sess of clone.sessions) for (const ex of sess.exercises) {
        for (const ws of ex.workSets) ws.weight = Math.round(ws.weight * mult * 2) / 2;
      }
      extended.push(clone);
    }
    plan.weeks = extended;
  }

  return plan;
}
