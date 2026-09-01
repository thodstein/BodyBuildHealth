/**
 * arm-annual.ts — блок-билдер для годового плана (как strength-sport-annual).
 * Интегрируется в annual-training/block-builders через case 'ARM'.
 */
import type { ArmBuilderInput } from './arm-types';
import { buildArmPlan } from './arm-builder.engine';
import { finalizeArmPlan } from './arm-finalize.engine';
import { applyArmTaperToWeeks, buildArmTaperCurve } from './arm-taper.engine';
import type { UserWeek } from '../user-program/user-program.types';

export interface ArmAnnualBuildResult {
  blockKey: string;
  kind: 'ARM';
  weeks: UserWeek[];
  program: any | null;
  armPlan: any | null;
  warnings: string[];
  taperApplied: boolean;
  peakApplied: boolean;
  configHash: string;
}

function stableHash(obj: any): string {
  const s = JSON.stringify(obj, Object.keys(obj).sort());
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return String(h);
}

function armPlanToUserWeeks(plan: any): UserWeek[] {
  return plan.weeks.map((wk: any, idx: number) => ({
    week: idx + 1,
    phase: wk.phase === 'accumulation' ? 'accumulation' : wk.phase === 'intensification' ? 'intensification' : wk.phase === 'peaking' ? 'peaking' : 'deload',
    deload: !!wk.deload,
    sessions: wk.sessions.map((sess: any, si: number) => ({
      id: `arm-w${idx+1}-s${si+1}`,
      name: sess.sessionTag,
      dayOfWeek: (sess.day - 1) % 7,
      blocks: sess.exercises.map((ex: any, ei: number) => ({
        id: `arm-w${idx+1}-s${si+1}-b${ei+1}`,
        type: ex.role === 'primary' ? 'compound' : 'accessory',
        exerciseName: ex.name,
        muscle: ex.muscle,
        sets: ex.workSets.map((ws: any) => ({ reps: ws.reps, rir: ws.rir, restSec: ws.restSeconds, weight: ws.weight })),
      })),
    })),
  }));
}

export function buildArmBlock(
  block: { blockKey: string; weeks: number; phase: string; competitionId?: string },
  config: Partial<ArmBuilderInput> & { taperWeeks?: number; taperEnabled?: boolean },
  opts?: { level?: string },
): ArmAnnualBuildResult {
  const weeks = Math.max(1, Math.min(52, block.weeks || 4));
  const input: ArmBuilderInput = {
    discipline: (config.discipline as any) || 'armwrestling',
    patternId: config.patternId || (config.discipline === 'armlifting' ? 'grip_3_support' : 'arm_4_upper_lower'),
    level: config.level || opts?.level || 'intermediate',
    goal: (config.goal as any) || (block.phase === 'peaking' ? 'peaking' : block.phase === 'transition' ? 'maintenance' : 'strength'),
    technique: (config.technique as any) || 'balanced',
    weeks,
    gripFocus: config.gripFocus as any,
    gripImplement: config.gripImplement as any,
    workMax: config.workMax,
    weakPoints: config.weakPoints,
    focusGroup: config.focusGroup,
    specialization: !!config.specialization,
    equipment: config.equipment,
    injuries: config.injuries,
    planStartWeek: config.planStartWeek,
    sex: config.sex as any,
  } as ArmBuilderInput;

  let plan: any = buildArmPlan(input);
  plan = finalizeArmPlan(plan, { level: input.level });

  // taper
  let taperApplied = false;
  if (config.taperEnabled && (config.taperWeeks || 0) > 0) {
    const curve = buildArmTaperCurve({ taperWeeks: config.taperWeeks || 2 });
    applyArmTaperToWeeks(plan.weeks, curve);
    taperApplied = true;
  }

  const weeksOut = armPlanToUserWeeks(plan);
  const warnings: string[] = [];
  if (plan.validation && !plan.validation.valid) warnings.push(...(plan.validation.warnings || []));

  const configHash = stableHash({ input, blockWeeks: weeks, taperApplied });

  return {
    blockKey: block.blockKey,
    kind: 'ARM',
    weeks: weeksOut,
    program: null,
    armPlan: plan,
    warnings,
    taperApplied,
    peakApplied: block.phase === 'peaking',
    configHash,
  };
}
