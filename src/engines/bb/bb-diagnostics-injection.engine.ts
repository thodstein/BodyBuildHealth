/**
 * bb-diagnostics-injection.engine.ts — инъекция ББ-коррекций в план (parity TA).
 * Вставляет по 1 упражнению на слабую зону (гранулярно) в подходящий день.
 * Parity: per-day dedup, weekly Budget cap (sessionLimitsFor), протокол по каталогу.
 */
import type { BBPlan, BBSession, BBExercise } from './bb-builder.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { canonicalMuscle } from './bb-specialization.engine';
import { sessionLimitsFor } from './bb-volume.engine';

const BB_WEAK_CORRECTION: Record<string, string[]> = {
  delt_mid: ['lateral_raise', 'cable_lateral', 'lateral_raise_machine'],
  delt_rear: ['rear_delt_fly', 'rear_delt_machine', 'face_pull_sh'],
  delt_front: ['ohp', 'db_press', 'ohp_seated'],
  chest_upper: ['incline_db', 'incline_bar', 'cable_fly_low'],
  chest_lower: ['dips_chest', 'decline_db', 'decline_bar'],
  chest: ['incline_db', 'bench_db', 'fly_db'],
  back_width: ['pullup', 'pulldown', 'pullup_neutral'],
  back_thickness: ['row_bar', 'row_db', 'seated_row'],
  back: ['pullup', 'row_bar', 'seated_row'],
  quads: ['hack_squat', 'leg_press', 'leg_ext'],
  hamstrings: ['rdl', 'leg_curl', 'leg_curl_seated'],
  glutes: ['hip_thrust', 'cable_kickback', 'hip_abduction_machine'],
  biceps: ['curl_bar', 'curl_db', 'hammer_curl'],
  triceps: ['tricep_pushdown_rope', 'lying_tricep_extension', 'tricep_pushdown_bar'],
  calves: ['calf_raise', 'calf_raise_seated', 'donkey_calf_raise'],
  traps: ['face_pull', 'upright_row'],
  forearms: ['hammer_curl', 'curl_bar'],
  shoulders: ['lateral_raise', 'ohp', 'rear_delt_fly'],
  abs: ['crunch', 'hanging_leg_raise', 'plank'],
};

function findCatalog(idOrName: string) {
  const low = idOrName.toLowerCase();
  return (EXERCISE_CATALOG as any[]).find(e => e.id === idOrName || e.id.toLowerCase() === low || e.name.toLowerCase() === low) || null;
}

function sessionForInjection(week: any, muscle: string): BBSession | null {
  const can = canonicalMuscle(muscle);
  for (const s of week.sessions as BBSession[]) {
    if ((s.exercises || []).some(e => canonicalMuscle(e.muscle) === can)) return s;
  }
  return (week.sessions as BBSession[])[0] ?? null;
}

export interface BBInjectionOpts {
  dayMap?: Record<string, number[]>;
  budget?: number;
  workMax?: Record<string, number>;
  level?: string;
  /** MAX PRO: целевой объём сетов/нед на зону (из spec-block) */
  targetSets?: Record<string, number>;
  /** MAX PRO: PROF-темп на зону */
  profTempo?: Record<string, string>;
  /** MAX PRO: инъецировать во все недели (по умолчанию только weeks[0]) */
  allWeeks?: boolean;
  /** MAX PRO: предпочитаемые id упражнений (из correction-rank топ-1) */
  preferredIds?: Record<string, string>;
}

export interface BBInjectionResult {
  plan: BBPlan;
  injected: number;
  skippedBudget: number;
  skippedDup: number;
  notes: string[];
}

function computeBudgetBB(plan: BBPlan, level?: string): number {
  const lvl = (level || (plan as any).level || (plan as any).inputSnapshot?.level || 'intermediate') as string;
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  if (map[lvl] != null) return map[lvl];
  const limits = sessionLimitsFor({ level: lvl } as any);
  return limits.weeklyWorkingSets || 85;
}

export function injectBBWeakPoints(plan: BBPlan, weakZones: string[], opts: BBInjectionOpts = {}): BBInjectionResult {
  if (!weakZones || weakZones.length === 0) return { plan, injected: 0, skippedBudget: 0, skippedDup: 0, notes: [] };
  const copy: BBPlan = JSON.parse(JSON.stringify(plan));
  const budget = opts.budget ?? computeBudgetBB(plan as any, opts.level);
  let injected = 0, skippedBudget = 0, skippedDup = 0;
  const notes: string[] = [];
  const uniq = [...new Set(weakZones.map(s => String(s).toLowerCase().trim()).filter(Boolean))].slice(0, 2);

  for (const wp of uniq) {
    const preferred = opts.preferredIds?.[wp] || opts.preferredIds?.[canonicalMuscle(wp)];
    const corrList = BB_WEAK_CORRECTION[wp] || BB_WEAK_CORRECTION[canonicalMuscle(wp)] || [];
    const corrId = preferred || corrList[0];
    if (!corrId) { notes.push(`⚠ ${wp} — нет коррекции`); continue; }
    const cat = findCatalog(corrId);
    const catName = cat ? cat.name : corrId;
    const catId = cat ? cat.id : corrId;
    const catType = cat ? cat.type : 'isolation';
    // MAX PRO: недели — все не-делоадные при allWeeks, иначе только weeks[0]
    const weekIdxs = opts.allWeeks
      ? (copy.weeks as any[]).map((w, i) => ({ w, i })).filter(({ w }) => w && !w.deload).map(({ i }) => i)
      : [0].filter((i) => (copy.weeks as any[])[i] && !(copy.weeks as any[])[i].deload);
    if (weekIdxs.length === 0) { notes.push(`⚠ ${wp} — делод`); continue; }
    const muscleKey = canonicalMuscle(wp);
    const wm = opts.workMax ?? (copy as any).workMax ?? (copy as any).inputSnapshot?.workMax ?? {};
    const base = wm[muscleKey] ?? wm[wp] ?? 50;
    const weight = Math.round(base * 0.65 / 2.5) * 2.5; // 65% для изоляции
    const reps = muscleKey === 'calves' ? 15 : muscleKey === 'forearms' ? 12 : 10;
    const rir = 2;
    const tempo = opts.profTempo?.[wp] || opts.profTempo?.[muscleKey] || '3-1-1-0';
    const rest = 90;
    const wantSets = Math.max(2, Math.min(6, Math.round(opts.targetSets?.[wp] ?? opts.targetSets?.[muscleKey] ?? 3)));
    for (const wi of weekIdxs) {
      const week = (copy.weeks as any[])[wi] as any;
      const configuredDays = opts.dayMap?.[wp] || opts.dayMap?.[muscleKey];
      let targetSession: BBSession | null = null;
      if (configuredDays && configuredDays.length) {
        const dayIdx = configuredDays[0] - 1;
        targetSession = (week.sessions as BBSession[])[dayIdx] ?? null;
      }
      if (!targetSession) targetSession = sessionForInjection(week, wp);
      if (!targetSession) { notes.push(`⚠ ${wp} — нед ${wi + 1}: нет сессии`); continue; }
      const already = (targetSession.exercises || []).some(e => {
        const n = String(e.exerciseName || e.name || '').toLowerCase();
        const id = String((e as any).exerciseName || '').toLowerCase();
        const low = corrId.toLowerCase();
        const catNameLow = String(catName || '').toLowerCase();
        return n === low || n === catNameLow || id === low || id === catId.toLowerCase();
      });
      if (already) { skippedDup++; continue; }

      const weeklySets = (week as any).sessions.reduce((a: number, s: any) => a + (s.exercises || []).reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
      const addSets = wantSets;
      if (weeklySets + addSets > budget) { skippedBudget++; notes.push(`⊘ ${wp} нед ${wi + 1} → ${catName} превысит Budget ${budget} (сейчас ${weeklySets}+${addSets})`); continue; }

      const ex: BBExercise = {
        muscle: muscleKey,
        name: catName,
        role: 'accessory' as const,
        character: 'pump' as any,
        sets: addSets,
        repsRange: [reps, reps + 2] as [number, number],
        rir,
        workSets: Array.from({ length: addSets }, () => ({ reps, rir, weight, tempo, restSeconds: rest } as any)),
        exerciseName: catId,
        exerciseType: catType,
        tempoSpec: tempo,
        restSeconds: rest,
        comment: `🩺 ББ-диагностика: ${wp} → ${catName} ${addSets}×${reps} @65% ${tempo}`,
        warmupSets: [],
      } as any;
      targetSession.exercises.push(ex);
      if (typeof week.totalSets === 'number') week.totalSets += addSets;
      injected++;
      if (!opts.allWeeks) notes.push(`✓ ${wp} → ${catName} в день ${targetSession.day} ${addSets}×${reps} @65%`);
    }
    if (opts.allWeeks) notes.push(`✓ ${wp} → ${catName} в ${weekIdxs.length} нед по ${wantSets} сетов (${tempo})`);
  }

  if (injected > 0) {
    copy.rationale = [...(copy.rationale || []), `ББ-диагностика: инъецировано ${injected} коррекций (${uniq.join(', ')})`];
  }
  return { plan: copy, injected, skippedBudget, skippedDup, notes };
}

export function computeBudgetBBFallback(level: string): number {
  return computeBudgetBB({ weeks: [] } as any, level);
}
