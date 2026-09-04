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
import { getArmLandmarks, tendonWeeklyLimit } from './arm-volume-landmarks.engine';
import { getArmExercises } from '../../core/exercise-catalog-arm';

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
   * E16 P2: критический гейтинг side (score≤49 / humerus-floor) — для side_mid/side_pin
   * разрешены только безопасные кандидаты (ремень/изометрия/внутренняя ротация).
   */
  gatedSideIso?: boolean;
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

function weightForExercise(exId: string, workMax: Record<string, number>, intensityPct: number): number {
  const low = exId.toLowerCase();
  let base = 40;
  if (low.includes('wrist') || low.includes('riser') || low.includes('cup')) base = workMax['wrist_flexors'] || workMax['risers'] || workMax['default'] || 30;
  else if (low.includes('pronation')) base = workMax['pronators'] || workMax['default'] || 30;
  else if (low.includes('supination')) base = workMax['supinators'] || workMax['default'] || 30;
  else if (low.includes('hammer') || low.includes('hook_drag')) base = workMax['brachialis'] || workMax['default'] || 40;
  else if (low.includes('side')) base = workMax['side_pressure'] || workMax['default'] || 30;
  else if (low.includes('lat_drag') || low.includes('row_strap') || low.includes('landmine')) base = workMax['back_pressure'] || workMax['default'] || 50;
  else if (low.includes('rolling_thunder') || low.includes('apollon_axle') || low.includes('axle')) base = workMax['grip_support'] || workMax['default'] || 60;
  else if (low.includes('hub') || low.includes('plate_pinch') || low.includes('saxon') || low.includes('coc')) base = workMax['grip_pinch'] || workMax['grip_support'] || workMax['default'] || 20;
  else base = workMax['default'] || 30;
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
      const wantSets = opts.targetSets?.[wp] != null && Number.isFinite(Number(opts.targetSets[wp]))
        ? Math.max(1, Math.min(6, Math.round(Number(opts.targetSets[wp]))))
        : corr.sets;
      // находим первый не-дубликат из списка коррекций
      let exId: string | null = null;
      let catalogEx: any = null;
      let targetSession: any = null;
      for (const cand of corr.exercises) {
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
        // fallback — первая, но dedup уже учтён выше, считаем dup
        const first = corr.exercises[0];
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
      let tendonSets = 0;
      for (const sess of week.sessions) for (const ex of sess.exercises) if (['wrist_flexors','wrist_extensors','pronators','supinators','risers','thumb','ulnar_deviators','radial_deviators'].includes(ex.muscle)) tendonSets += ex.sets;
      const isTendon = ['wrist_flexors','risers','pronators','supinators','thumb','ulnar_deviators','radial_deviators'].some(m => bio.weakMuscles.includes(m));
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
      const weight = weightForExercise(exId, workMax, corr.intensityPct);
      const repsAvg = Math.round((corr.repsRange[0] + corr.repsRange[1]) / 2);
      const finalSession = targetSession;
      if (finalSession.exercises.length >= 8) { skippedBudget++; notes.push(`⊘ ${wp} переполнено (нед ${wi + 1})`); continue; }

      const newEx: any = {
        muscle: bio.weakMuscles[0] || 'wrist_flexors',
        name: catalogEx.name,
        role: 'accessory',
        character: 'техника',
        sets: addSets,
        repsRange: corr.repsRange,
        rir: corr.rir,
        workSets: Array.from({ length: addSets }, () => ({
          reps: repsAvg,
          rir: corr.rir,
          weight,
          restSeconds: ['side_mid','side_pin'].includes(wp) ? 180 : 90,
          tempo: corr.tempo || '2-1-1-0',
          holdSeconds: corr.holdSeconds,
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
        comment: `${bio.label} → ${corr.exercises.slice(0,2).join('/')} @${Math.round(corr.intensityPct*100)}%`,
        rationale: `Коррекция мёртвой точки: ${bio.biomechanicalReason.slice(0,90)}…`,
      };
      finalSession.exercises.push(newEx);
      seenIds.add(`${exId}@${finalSession.sessionTag}`);
      injected++;
      notes.push(`✓ ${wp} → ${exId} в ${finalSession.sessionTag} ${addSets}×${repsAvg} @${Math.round(corr.intensityPct*100)}% (нед ${wi + 1})`);
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
        if (!vol[ex.muscle]) vol[ex.muscle] = { directSets: 0, effectiveSets: 0, tendonSets: 0, fatigueWeightedSets: 0 };
        vol[ex.muscle].directSets += ex.sets;
        vol[ex.muscle].effectiveSets += ex.sets;
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
