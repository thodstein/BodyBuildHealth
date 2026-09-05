/**
 * arm-annual.ts — блок-билдер для годового плана (как strength-sport-annual).
 * Интегрируется в annual-training/block-builders через case 'ARM'.
 */
import type { ArmBuilderInput } from './arm-types';
import { buildArmPlan } from './arm-builder.engine';
import { finalizeArmPlan } from './arm-finalize.engine';
import { applyArmTaperToWeeks, buildArmTaperCurve } from './arm-taper.engine';
import { superSeriesYear } from './arm-calendar.engine';
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
  block: { blockKey: string; weeks: number; phase: string; competitionId?: string; weightClass?: string },
  config: Partial<ArmBuilderInput> & { taperWeeks?: number; taperEnabled?: boolean; competitionPriority?: 'A'|'B'|'C' },
  opts?: { level?: string },
): ArmAnnualBuildResult {
  const weeks = Math.max(1, Math.min(52, block.weeks || 4));
  // WAF-приоритет: A → peaking + taper 3н, B → 2н, C → без taper (встроен)
  const prio = (config as any).competitionPriority || (block.phase === 'peaking' ? 'A' : 'B');
  const defaultTaper = prio === 'A' ? 3 : prio === 'B' ? 2 : 0;
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
    weightClass: (config as any).weightClass || (block as any).weightClass,
    // TOP wave-6: сквозные поля (опциональны, билдер gated)
    oppStyle: (config as any).oppStyle,
    oppHand: (config as any).oppHand,
    weightDeltaKg: (config as any).weightDeltaKg,
    rfd: (config as any).rfd,
    gripPhase: (config as any).gripPhase,
    ladderFrom: (config as any).ladderFrom,
    ladderValue: (config as any).ladderValue,
    contestSim: (config as any).contestSim,
    leftKg: (config as any).leftKg,
    rightKg: (config as any).rightKg,
  } as ArmBuilderInput;

  let plan: any = buildArmPlan(input);
  plan = finalizeArmPlan(plan, { level: input.level });

  // taper — WAF-специфичный: A 3н 0.85/0.65/0.45 side×0.7/0.5/0.3, B 2н, C 0
  let taperApplied = false;
  const taperWeeksEff = config.taperEnabled ? (config.taperWeeks ?? defaultTaper) : 0;
  if (taperWeeksEff > 0) {
    const curve = buildArmTaperCurve({ taperWeeks: taperWeeksEff, gripFocus: config.gripFocus as any });
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

export interface ArmYearBlock {
  blockKey: string;
  weeks: number;
  phase: 'base' | 'strength' | 'peaking' | 'transition';
  priority: 'A' | 'B' | 'C';
  focus: string;
}

/**
 * TOP wave-6: год из шаблона серии → блоки для buildArmBlock.
 * Приоритет A → peaking, B → strength, C → base. Чистая функция.
 */
export function buildArmYearBlocks(
  series: string,
  totalWeeks = 52,
  baseConfig: Record<string, unknown> = {},
): ArmYearBlock[] {
  const tpl = superSeriesYear(series, totalWeeks);
  return tpl.stages.map((st, i) => ({
    blockKey: `arm-${tpl.series}-${i + 1}`,
    weeks: st.weeks,
    phase: (st.priority === 'A' ? 'peaking' : st.priority === 'B' ? 'strength' : 'base') as ArmYearBlock['phase'],
    priority: st.priority,
    focus: st.focus,
    ...baseConfig,
  })) as ArmYearBlock[];
}
