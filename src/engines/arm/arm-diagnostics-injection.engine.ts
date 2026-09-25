/**
 * arm-diagnostics-injection.engine.ts — инъекция коррекций мёртвых точек в арм-план.
 * Parity с strength-sport-ta-injection + bb-diagnostics-injection.
 * Вставляет 1 упражнение на слабую точку (12 ArmWeakPoint) в подходящий день (dayTags),
 * per-day dedup, budget (weeklySets ≤ limit), humerus guard, техника-спец.
 */
import type { ArmPlan } from './arm-types';
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_BIOMECH } from './arm-biomechanics.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';
import { doseForCause } from './arm-correction-dose.engine';
import { doseForCauseV2, waveSetsFor, preventiveFor, roleLabel, shouldUseDoseV2 } from './arm-correction-pro2.engine';
import type { ArmWeakCause } from './arm-weak-cause.engine';
import { getArmLandmarks, tendonWeeklyLimit } from './arm-volume-landmarks.engine';
import { getArmExercises } from '../../core/exercise-catalog-arm';
import { armTendonSetForExercises, canonicalizeArmMuscle, isArmTendonMuscle } from './arm-tendon-sets.engine';

export interface ArmInjectionOpts {
  dayMap?: Record<string, string>; // weakPoint → sessionTag
  budget?: number; // weeklySets cap
  workMax?: Record<string, number>;
  level?: string;
  /** Индексы недель для инъекции (default [0] — обратно совместимо). Хаб P0 передаёт все не-делод недели. */
  weekIdxs?: number[];
  /** Целевые сеты точки из спец-блока (weakPoint → sets). */
  targetSets?: Record<string, number>;
  /**
   * П.1: ранжированный порядок кандидатов (weakPoint → exerciseIds по приоритету
   * ранжира). Без записи — базовый порядок ARM_CORRECTIONS (байт-в-байт).
   */
  rankedIds?: Record<string, string[]>;
  /**
   * Доза по причине (weakPoint → cause из diagnoseArmWeakCause): сеты/повторы/RIR/вес
   * вставляемого упражнения берутся из doseForCause, а не из базы ARM_CORRECTIONS.
   * Без записи — база (байт-в-байт). targetSets спец-блока приоритетнее dose.sets.
   */
  causes?: Record<string, ArmWeakCause>;
  /**
   * E16 P2: критический гейтинг side (score≤49 / humerus-floor) — для side_mid/side_pin
   * разрешены только безопасные кандидаты (ремень/изометрия/внутренняя ротация).
   */
  gatedSideIso?: boolean;
  /**
   * PRO-2: перегруз сухожилий (tendon ACWR danger или боль ≥4) — доза v2 режет
   * до пульсов/high-rep 2 сетов. Без флага — базовый путь (байт-в-байт).
   */
  tendonOverload?: boolean;
  /** PRO-2: возраст 50+ — доза v2 снимает 1 сет, RIR+1. Без флага — базовый путь. */
  age50plus?: boolean;
  /**
   * PRO-2: неделя волны коррекции (1-based: 1 база, 2 объём +1, 3 делод −1).
   * Без записи — без волны (байт-в-байт). targetSets приоритетнее волны.
   */
  waveWeek?: number;
}

export const ARM_PLAN_PREV_KEY = 'he_arm_plan_saved_prev';

export function saveArmPlanPrev(rawJson: string): void {
  try { localStorage.setItem(ARM_PLAN_PREV_KEY, rawJson); } catch { /* noop */ }
}

export function loadArmPlanPrev(): string | null {
  try { return localStorage.getItem(ARM_PLAN_PREV_KEY); } catch { return null; }
}

export function clearArmPlanPrev(): void {
  try { localStorage.removeItem(ARM_PLAN_PREV_KEY); } catch { /* noop */ }
}

export interface ArmInjectionResult {
  plan: ArmPlan;
  injected: number;
  skippedBudget: number;
  skippedDup: number;
  skippedHumerus: number;
  notes: string[];
}

function computeBudgetArm(plan: ArmPlan, level: string): number {
  const lvl = level || (plan as any).level || 'intermediate';
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  return map[lvl] ?? 85;
}

function findSessionForWeakPoint(week: any, wp: ArmWeakPoint, dayMap?: Record<string,string>): any {
  const customTag = dayMap?.[wp];
  if (customTag) {
    const s = week.sessions.find((x: any) => x.sessionTag === customTag);
    if (s) return s;
  }
  const corr = ARM_CORRECTIONS[wp];
  if (corr?.dayTags) {
    for (const tag of corr.dayTags) {
      const s = week.sessions.find((x: any) => x.sessionTag === tag);
      if (s) return s;
    }
  }
  // fallback — ищем по мышце
  const bio = ARM_BIOMECH[wp];
  if (bio?.weakMuscles) {
    for (const m of bio.weakMuscles) {
      const s = week.sessions.find((x: any) => x.exercises?.some((e: any) => e.muscle === m));
      if (s) return s;
    }
  }
  return week.sessions[0] ?? null;
}

/** P5: вес коррекции наружу — честный симулятор считает тем же кодом. */
export function estimateArmCorrectionWeight(exId: string, workMax: Record<string, number>, intensityPct: number, wp?: string): number {
  return weightForExercise(exId, workMax, intensityPct, wp);
}

function weightForExercise(exId: string, workMax: Record<string, number>, intensityPct: number, wp?: string): number {
  if (wp) {
    try {
      const bio = ARM_BIOMECH[wp as keyof typeof ARM_BIOMECH];
      for (const m of bio?.weakMuscles || []) {
        const v = Number((workMax as Record<string, number>)[m]);
        if (Number.isFinite(v) && v > 0) return Math.round(v * intensityPct * 2) / 2;
      }
    } catch {}
  }
  const low = exId.toLowerCase();
  let base = 0;
  if (low.includes('wrist') || low.includes('riser') || low.includes('cup')) base = Number(workMax['wrist_flexors'] || workMax['risers'] || workMax['default'] || 0);
  else if (low.includes('pronation')) base = Number(workMax['pronators'] || workMax['default'] || 0);
  else if (low.includes('supination')) base = Number(workMax['supinators'] || workMax['default'] || 0);
  else if (low.includes('hammer') || low.includes('hook_drag')) base = Number(workMax['brachialis'] || workMax['default'] || 0);
  else if (low.includes('side')) base = Number(workMax['side_pressure'] || workMax['default'] || 0);
  else if (low.includes('lat_drag') || low.includes('row_strap') || low.includes('landmine')) base = Number(workMax['back_pressure'] || workMax['default'] || 0);
  else if (low.includes('rolling_thunder') || low.includes('apollon_axle') || low.includes('axle')) base = Number(workMax['grip_support'] || workMax['default'] || 0);
  else if (low.includes('hub') || low.includes('plate_pinch') || low.includes('saxon') || low.includes('coc')) base = Number(workMax['grip_pinch'] || workMax['grip_support'] || workMax['default'] || 0);
  else base = Number(workMax['default'] || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round(base * intensityPct * 2) / 2;
}

export function injectArmCorrections(plan: ArmPlan, weakPoints: ArmWeakPoint[], opts: ArmInjectionOpts = {}): ArmInjectionResult {
  if (!weakPoints || weakPoints.length === 0) return { plan, injected: 0, skippedBudget: 0, skippedDup: 0, skippedHumerus: 0, notes: [] };
  const copy: ArmPlan = JSON.parse(JSON.stringify(plan));
  const level = opts.level || (plan as any).level || 'intermediate';
  const budget = opts.budget ?? computeBudgetArm(plan as any, level);
  let injected = 0, skippedBudget = 0, skippedDup = 0, skippedHumerus = 0;
  const notes: string[] = [];
  const uniq = [...new Set(weakPoints)].slice(0, 3) as ArmWeakPoint[];
  const allIdx = (copy.weeks || []).map((_, i) => i);
  const weekIdxs = Array.isArray(opts.weekIdxs) && opts.weekIdxs.length
    ? opts.weekIdxs.filter((i) => i >= 0 && i < allIdx.length)
    : [0];
  if (weekIdxs.length === 0) return { plan: copy, injected, skippedBudget, skippedDup, skippedHumerus, notes };

  for (const wi of weekIdxs) {
    const week = copy.weeks[wi];
    if (!week || (week as any).deload) {
      for (const wp of uniq) notes.push(`⚠ ${wp} — нед ${wi + 1} делод, пропуск`);
      continue;
    }
    // per-day dedup set (per-week: пары id@sessionTag этой недели)
    const seenIds = new Set<string>();
    for (const sess of week.sessions) for (const ex of sess.exercises) if (ex.exerciseId) seenIds.add(`${ex.exerciseId}@${sess.sessionTag}`);

    for (const wp of uniq) {
      const bio = ARM_BIOMECH[wp];
      const corr = ARM_CORRECTIONS[wp];
      if (!bio || !corr) { notes.push(`⚠ ${wp} — нет биомеханики`); continue; }
      // доза по причине: PRO-2 v2 при флагах (tendon/50+/side-guard), иначе база 1-в-1
      // Условие — общий shouldUseDoseV2 (паритет с симулятором, D3)
      const v2 = shouldUseDoseV2(opts.causes?.[wp], level, { tendonOverload: opts.tendonOverload, age50plus: opts.age50plus })
        ? doseForCauseV2(wp, opts.causes?.[wp], { level, tendonOverload: opts.tendonOverload, age50plus: opts.age50plus })
        : null;
      const dose = v2 ?? doseForCause(wp, opts.causes?.[wp]) ?? {
        sets: corr.sets, reps: corr.repsRange, rir: corr.rir, intensityPct: corr.intensityPct,
        holdSeconds: corr.holdSeconds, tempo: corr.tempo, adjusted: false, note: 'база точки',
      };
      // PRO-2 волна: targetSets приоритетнее, затем волна, затем доза
      const waveSets = opts.waveWeek != null ? waveSetsFor(dose.sets, opts.waveWeek) : dose.sets;
      const wantSets = opts.targetSets?.[wp] != null && Number.isFinite(Number(opts.targetSets[wp]))
        ? Math.max(1, Math.min(6, Math.round(Number(opts.targetSets[wp]))))
        : waveSets;
      // находим первый не-дубликат из списка коррекций (ранжир первым, затем база)
      let exId: string | null = null;
      let catalogEx: any = null;
      let targetSession: any = null;
      const ranked = Array.isArray(opts.rankedIds?.[wp]) ? opts.rankedIds[wp].filter((s) => typeof s === 'string') : [];
      const order = [...ranked, ...corr.exercises].filter((v, i, a) => a.indexOf(v) === i);
      for (const cand of order) {
        // E16: gated — side только ремень/изометрия
        if (opts.gatedSideIso && (wp === 'side_mid' || wp === 'side_pin') && !/belt|iso|pushdown|internal_rotation/i.test(cand)) continue;
        const candEx = getArmExercises().find(e => e.id === cand);
        if (!candEx) continue;
        const candSession = findSessionForWeakPoint(week, wp, opts.dayMap);
        if (!candSession) continue;
        const dk = `${cand}@${candSession.sessionTag}`;
        if (seenIds.has(dk) || candSession.exercises.some((e: any) => e.exerciseId === cand)) continue;
        exId = cand;
        catalogEx = candEx;
        targetSession = candSession;
        break;
      }
      if (!exId || !catalogEx || !targetSession) {
        // fallback — первая из порядка (ранжир/база), но dedup уже учтён выше, считаем dup
        const first = order[0];
        const sess = findSessionForWeakPoint(week, wp, opts.dayMap);
        if (first && sess && (seenIds.has(`${first}@${sess.sessionTag}`) || sess.exercises.some((e: any)=> e.exerciseId===first))) {
          skippedDup++; notes.push(`⊘ ${wp} → ${first} уже есть в ${sess.sessionTag} (нед ${wi + 1})`); continue;
        }
        notes.push(`⚠ ${wp} — нет доступной коррекции (все дубли, нед ${wi + 1})`); continue;
      }
      // бюджет weeklySets (per-week)
      const weeklySets = week.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
      const addSets = wantSets;
      if (weeklySets + addSets > budget) {
        skippedBudget++; notes.push(`⊘ ${wp} → ${exId} превысит Budget ${budget} (нед ${wi + 1}: сейчас ${weeklySets}+${addSets})`); continue;
      }
      // humerus guard: side первые 4 нед ≤3, если уже 6 — skip
      if (['side_mid','side_pin'].includes(wp) && week.week <= 4) {
        const sideSets = week.sessions.reduce((a: number, s: any) => a + s.exercises.filter((e: any) => e.muscle === 'side_pressure').reduce((aa: number, e: any) => aa + (e.sets||0), 0), 0);
        if (sideSets >= 6) { skippedHumerus++; notes.push(`⊘ ${wp} → ${exId} humerus cap (нед ${wi + 1}: side ${sideSets}≥6 первые 4н)`); continue; }
      }
      // tendon budget check — только hard cap 26
      const tendonSets = armTendonSetForExercises(week.sessions.flatMap((sess: any) => sess.exercises || [])).totalSets;
      const isTendon = Array.isArray(bio.weakMuscles) && bio.weakMuscles.some((m: string) => isArmTendonMuscle(m));
      if (isTendon && tendonSets + addSets > 26) {
        skippedBudget++; notes.push(`⊘ ${wp} → ${exId} tendon hard cap 26 (нед ${wi + 1}: сейчас ${tendonSets}+${addSets})`); continue;
      }
      // session cap 8
      if (targetSession.exercises.length >= 8) {
        let alt: any = null;
        for (const tag of (corr.dayTags || []).slice(1)) {
          const s = week.sessions.find((x: any) => x.sessionTag === tag && x.exercises.length < 8);
          if (s) { alt = s; break; }
        }
        if (!alt) { skippedBudget++; notes.push(`⊘ ${wp} → ${exId} сессия ${targetSession.sessionTag} переполнена (8, нед ${wi + 1})`); continue; }
        targetSession = alt;
      }
      const workMax = opts.workMax ?? (copy as any).workMax ?? (copy as any).inputSnapshot?.workMax ?? {};
      const weight = weightForExercise(exId, workMax, dose.intensityPct, wp);
      const repsAvg = Math.round((dose.reps[0] + dose.reps[1]) / 2);
      const finalSession = targetSession;
      if (finalSession.exercises.length >= 8) { skippedBudget++; notes.push(`⊘ ${wp} переполнено (нед ${wi + 1})`); continue; }

      const newEx: any = {
        muscle: bio.weakMuscles[0] || 'wrist_flexors',
        name: catalogEx.name,
        role: 'accessory',
        character: 'техника',
        sets: addSets,
        repsRange: dose.reps,
        rir: dose.rir,
        workSets: Array.from({ length: addSets }, () => ({
          reps: repsAvg,
          rir: dose.rir,
          weight,
          restSeconds: ['side_mid','side_pin'].includes(wp) ? 180 : 90,
          tempo: dose.tempo || corr.tempo || '2-1-1-0',
          holdSeconds: dose.holdSeconds ?? corr.holdSeconds,
        })),
        workingAngle: { elbowDeg: (bio.elbowDeg?.[0] || 110) as any, wrist: 'flexed' as any, forearm: wp.includes('pron') ? 'pronated' as any : wp.includes('sup') ? 'supinated' as any : 'neutral' as any, direction: (bio.workingDirection || 'to_middle') as any },
        isTable: ['cup_start','cup_hold','pron_open','pron_lock','sup_cup','sup_drag','back_start','back_drag'].includes(wp),
        isStatic: !!corr.holdSeconds,
        holdSeconds: corr.holdSeconds,
        tempoSpec: corr.tempo,
        movementPattern: catalogEx.movementPattern,
        substitutionGroup: corr.substitutionGroup,
        exerciseId: exId,
        equipment: catalogEx.equipment,
        loadMode: catalogEx.equipment === 'bodyweight' ? 'bodyweight' : catalogEx.equipment === 'band' ? 'band' : 'tool',
        provenance: 'diagnostic',
        provenanceSource: `arm-diagnostics:${exId}`,
        comment: `${bio.label} → ${corr.exercises.slice(0,2).join('/')} @${Math.round(dose.intensityPct*100)}%${dose.adjusted ? ` · доза: ${dose.note}` : ''}${(() => { try { const p = preventiveFor(wp); return p ? ` · ${p.label}` : ''; } catch { return ''; } })()}${exId ? ` · роль ${roleLabel(exId)}` : ''}`,
        rationale: `Коррекция мёртвой точки: ${bio.biomechanicalReason.slice(0,90)}…`,
      };
      finalSession.exercises.push(newEx);
      seenIds.add(`${exId}@${finalSession.sessionTag}`);
      injected++;
      notes.push(`✓ ${wp} → ${exId} в ${finalSession.sessionTag} ${addSets}×${repsAvg} @${Math.round(dose.intensityPct*100)}%${dose.adjusted ? ` (${dose.note})` : ''} (нед ${wi + 1})`);
    }
  }

  if (injected > 0) {
    copy.rationale = [...(copy.rationale || []), `Арм-диагностика: инъецировано ${injected} коррекций (${uniq.join(', ')})`];
    // пересчёт weeklyVolume для затронутых недель
    for (const wi of weekIdxs) {
      const week = copy.weeks[wi];
      if (!week || (week as any).deload) continue;
      const vol: Record<string, any> = {};
      for (const sess of week.sessions) for (const ex of sess.exercises) {
        const muscle = canonicalizeArmMuscle(ex.muscle) || ex.muscle;
        if (!vol[muscle]) vol[muscle] = { directSets: 0, effectiveSets: 0, tendonSets: 0, fatigueWeightedSets: 0 };
        vol[muscle].directSets += ex.sets;
        vol[muscle].effectiveSets += ex.sets;
        if (isArmTendonMuscle(ex.muscle)) vol[muscle].tendonSets += ex.sets;
      }
      if (copy.weeklyVolume) copy.weeklyVolume[week.week] = vol;
    }
  }
  return { plan: copy, injected, skippedBudget, skippedDup, skippedHumerus, notes };
}

export function computeBudgetArmFallback(level: string): number {
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  return map[level] ?? 85;
}
