/**
 * arm-simulator.engine.ts — симуляция Δ инъекции коррекции (E4 P0).
 * Parity: bb `simulateCorrection` — сеты/покрытие точек до/после, без мутаций плана.
 */
import type { ArmPlan } from './arm-types';
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_BIOMECH } from './arm-biomechanics.engine';
import { auditArmPlan } from './arm-plan-audit.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';
import { doseForCause } from './arm-correction-dose.engine';
import { doseForCauseV2, waveSetsFor, shouldUseDoseV2 } from './arm-correction-pro2.engine';
import type { ArmWeakCause } from './arm-weak-cause.engine';
import { estimateArmCorrectionWeight } from './arm-diagnostics-injection.engine';
import { armTendonSetForExercises, isArmTendonMuscle } from './arm-tendon-sets.engine';

export interface ArmSimDelta {
  addSets: number;
  coverageBefore: number;
  coverageAfter: number;
  summary: string;
  /** P5: честные гейты тем же кодом, что инъекция (budget/dup/tendon/humerus/session). */
  blocked?: string | null;
  estWeight?: number | null;
}

export interface ArmSimOpts {
  level?: string;
  budget?: number;
  workMax?: Record<string, number>;
  targetSets?: Record<string, number>;
  /** Доза по причине — те же правила, что инъекция (без causes — база). */
  causes?: Record<string, ArmWeakCause>;
  /** D3 PRO-2: те же v2-флаги/волна, что инъекция (без — базовый путь 1-в-1). */
  tendonOverload?: boolean;
  age50plus?: boolean;
  waveWeek?: number;
}

const BUDGET_BY_LEVEL: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };

/** П.3: те же кандидаты сессий, что инъекция (dayTags → мышца → первая; alt — остальные dayTags). */
function sessionsFullForWeakPoint(week: any, dayTags: string[] | undefined, weakMuscles: string[] | undefined): boolean {
  const sessions: any[] = Array.isArray(week?.sessions) ? week.sessions : [];
  if (!sessions.length) return false;
  const cands: any[] = [];
  for (const tag of dayTags || []) {
    const s = sessions.find((x: any) => x.sessionTag === tag);
    if (s && !cands.includes(s)) cands.push(s);
  }
  if (!cands.length && Array.isArray(weakMuscles)) {
    for (const m of weakMuscles) {
      const s = sessions.find((x: any) => x.exercises?.some((e: any) => e.muscle === m));
      if (s && !cands.includes(s)) { cands.push(s); break; }
    }
  }
  if (!cands.length && sessions[0]) cands.push(sessions[0]);
  if (!cands.length) return false;
  return cands.every((s: any) => (s.exercises || []).length >= 8);
}

export function simulateArmInjection(
  plan: ArmPlan | null | undefined,
  point: ArmWeakPoint,
  exerciseId?: string | null,
  opts: ArmSimOpts = {},
): ArmSimDelta | null {
  const audit = auditArmPlan(plan);
  const corr = ARM_CORRECTIONS[point];
  const bio = (ARM_BIOMECH as any)[point];
  if (!corr) return null;
  // D3: доза/волна 1-в-1 как инъекция (shouldUseDoseV2 общий; targetSets приоритетнее волны)
  const level = String(opts.level || (plan as any)?.level || 'intermediate');
  const v2 = shouldUseDoseV2(opts.causes?.[point], level, { tendonOverload: opts.tendonOverload, age50plus: opts.age50plus })
    ? doseForCauseV2(point, opts.causes?.[point], { level, tendonOverload: opts.tendonOverload, age50plus: opts.age50plus })
    : null;
  const dose = v2 ?? doseForCause(point, opts.causes?.[point]) ?? {
    sets: corr.sets, reps: corr.repsRange, rir: corr.rir, intensityPct: corr.intensityPct,
    holdSeconds: corr.holdSeconds, tempo: corr.tempo, adjusted: false, note: 'база точки',
  };
  const waveSets = opts.waveWeek != null ? waveSetsFor(dose.sets, opts.waveWeek) : dose.sets;
  const wantSets = opts.targetSets?.[point] != null && Number.isFinite(Number(opts.targetSets[point]))
    ? Math.max(1, Math.min(6, Math.round(Number(opts.targetSets[point]))))
    : waveSets || 3;
  const before = audit ? audit.covered.length : 0;
  const alreadyCovered = audit ? (audit.byPoint[point]?.sets ?? 0) > 0 : false;
  const after = audit ? before + (alreadyCovered ? 0 : 1) : 1;
  const ex = exerciseId || corr.exercises[0];
  let blocked: string | null = null;
  let estWeight: number | null = null;
  try {
    const weeks: any[] = Array.isArray((plan as any)?.weeks) ? (plan as any).weeks : [];
    const week = weeks.find((w) => w && !(w as any).deload) ?? weeks[0];
    if (week) {
      const weeklySets = week.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
      const budget = opts.budget ?? BUDGET_BY_LEVEL[String(opts.level || (plan as any)?.level || 'intermediate')] ?? 85;
      const dup = week.sessions.some((s: any) => s.exercises.some((e: any) => e.exerciseId === ex));
      if (dup) blocked = `дубль ${ex} уже в неделе`;
      else if (weeklySets + wantSets > budget) blocked = `budget ${budget}: ${weeklySets}+${wantSets}`;
      else {
        // порядок гейтов 1-в-1 как инъекция: humerus → tendon → session
        const sideSets = week.sessions.reduce((a: number, s: any) => a + s.exercises.filter((e: any) => e.muscle === 'side_pressure').reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
        const tendonSets = armTendonSetForExercises(week.sessions.flatMap((s: any) => s.exercises || [])).totalSets;
        const isTendon = Array.isArray(bio?.weakMuscles) && bio.weakMuscles.some((m: string) => isArmTendonMuscle(m));
        if ((point === 'side_mid' || point === 'side_pin') && week.week <= 4 && sideSets >= 6) blocked = `humerus cap: side ${sideSets}≥6`;
        else if (isTendon && tendonSets + wantSets > 26) blocked = `tendon cap 26: ${tendonSets}+${wantSets}`;
        else if (sessionsFullForWeakPoint(week, corr.dayTags, bio?.weakMuscles)) blocked = `сессии переполнены (8) — некуда вставить ${ex}`;
      }
      const wm = opts.workMax ?? (plan as any)?.workMax ?? (plan as any)?.inputSnapshot?.workMax ?? {};
      if (wm && typeof wm === 'object') estWeight = estimateArmCorrectionWeight(ex, wm, dose.intensityPct, point);
    }
  } catch { /* noop — деградация к покрытию */ }
  const doseTag = dose.adjusted ? ` · ${dose.note}` : '';
  const summary = blocked
    ? `⊘ ${ex}: ${blocked} · покрытие ${before}/12 → ${after}/12`
    : `+${wantSets} сетов (${ex}${estWeight != null ? ` ≈${estWeight}кг` : ''})${doseTag} · покрытие ${before}/12 → ${after}/12`;
  return { addSets: wantSets, coverageBefore: before, coverageAfter: after, summary, blocked, estWeight };
}
