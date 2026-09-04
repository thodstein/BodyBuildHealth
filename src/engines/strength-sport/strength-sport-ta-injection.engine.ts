/**
 * strength-sport-ta-injection.engine.ts — инъекция ТА-коррекций в план (MRV + dedup parity с PL)
 *
 * Вставляет по 1 коррекционному упражнению на слабую фазу WLWeakPoint в technique/clean/snatch день.
 * Parity с lms-builder: per-day dedup, budget cap (weeklySets ≤ Budget), протокол из TA_BIOMECH intensityPct.
 * Не мутирует исходный plan — возвращает копию + отчёт.
 */
import type { StrengthSportPlan, StrengthSportSession, StrengthSportExercise } from './strength-sport.types';
import { WL_WEAKPOINT_CORRECTION, type WLWeakPoint } from './strength-sport-weakpoint';
import { TA_BIOMECH } from './strength-sport-biomechanics.engine';
import '../../core/exercise-catalog-ta-supplement';

function basePmForTA(id: string, wm: any): number {
  const low = id.toLowerCase();
  if (low.includes('snatch')) return wm.snatch || 60;
  if (low.includes('clean') || low.includes('jerk')) return wm.cleanJerk || wm.clean || 80;
  if (low.includes('squat') || low.includes('overhead')) return wm.backSquat || 100;
  if (low.includes('pull') || low.includes('deficit')) return wm.deadlift || 120;
  if (low.includes('press') || low.includes('jerk')) return wm.overheadPress || 60;
  return wm.backSquat || 80;
}

function sessionForInjection(week: any, weakPoint: WLWeakPoint): StrengthSportSession | null {
  const tagOrder = ['technique_day', 'clean_day', 'snatch_day', 'strength_day', 'pull_day'];
  for (const tag of tagOrder) {
    const s = week.sessions.find((x: any) => x.sessionTag === tag);
    if (s) return s;
  }
  return week.sessions[0] ?? null;
}

export interface TAInjectionOpts {
  dayMap?: Record<string, number[]>; // weakPoint → days 1-based
  budget?: number; // weeklySets cap, если не задан — вычисляем по уровню
  workMax?: any;
  /** E6 v2: индексы недель для инъекции (0-индекс). Дефолт [0] — legacy (только нед.1, как PL). */
  weekIdxs?: number[];
  /** E6 v2: предпочитаемая коррекция фазы (из ⭐ хаба) — идёт первой, остальные corr — fallback. */
  preferredCorr?: Record<string, string>;
  /** E6 v2: протокол фазы {sets, reps, pct} (из ранжира топ-3). */
  protocols?: Record<string, { sets?: number; reps?: number; pct?: number }>;
  /** E6 v2: сеты по неделям из спец-блока (индекс недели → {weakPoint: sets}). */
  targetSetsByWeek?: Array<Record<string, number>>;
}

/** Ключи стораджа плана ТА и снапшота до инъекции (откат). */
export const TA_PLAN_KEY = 'he_strength_sport_plan_v1';
export const TA_PLAN_PREV_KEY = 'he_strength_sport_plan_prev_v1';

function planIdOf(raw: string | null): string | null {
  try {
    if (!raw) return null;
    const j = JSON.parse(raw);
    const id = j?.id ?? j?.plan?.id;
    return typeof id === 'string' && id ? id : null;
  } catch { return null; }
}

interface TASnapshot {
  raw: string;
  planId: string | null;
  savedAt: string;
}

function readSnapshot(): TASnapshot | string | null {
  try {
    const prev = localStorage.getItem(TA_PLAN_PREV_KEY);
    if (!prev) return null;
    try {
      const j = JSON.parse(prev);
      // V6-B2 формат {raw, planId, savedAt}; legacy — сырой план строкой
      if (j && typeof j === 'object' && typeof (j as any).raw === 'string') return j as TASnapshot;
    } catch { /* legacy raw — ниже */ }
    return prev;
  } catch { return null; }
}

/** Снапшот текущего плана перед инъекцией (для отката). */
export function snapshotTAPlanForInject(): boolean {
  try {
    const raw = localStorage.getItem(TA_PLAN_KEY);
    if (!raw) return false;
    const snap: TASnapshot = { raw, planId: planIdOf(raw), savedAt: new Date().toISOString() };
    localStorage.setItem(TA_PLAN_PREV_KEY, JSON.stringify(snap));
    return true;
  } catch { return false; }
}

/**
 * Откат инъекции: восстановить снапшот.
 * V6-B2: если план пересобран после снапшота (другой id) — откат запрещён,
 * stale-снапшот удаляется, возвращается false (план не тронут).
 */
export function rollbackTAPlanInject(): boolean {
  try {
    const snap = readSnapshot();
    if (!snap) return false;
    if (typeof snap === 'string') {
      // legacy-снапшот (сырой план) — старое поведение
      localStorage.setItem(TA_PLAN_KEY, snap);
      localStorage.removeItem(TA_PLAN_PREV_KEY);
      return true;
    }
    const curId = planIdOf(localStorage.getItem(TA_PLAN_KEY));
    if (snap.planId != null && curId != null && snap.planId !== curId) {
      localStorage.removeItem(TA_PLAN_PREV_KEY);
      return false;
    }
    localStorage.setItem(TA_PLAN_KEY, snap.raw);
    localStorage.removeItem(TA_PLAN_PREV_KEY);
    return true;
  } catch { return false; }
}

export function hasTAPlanPrev(): boolean {
  try { return localStorage.getItem(TA_PLAN_PREV_KEY) != null; } catch { return false; }
}

export interface TAInjectionResult {
  plan: StrengthSportPlan;
  injected: number;
  skippedBudget: number;
  skippedDup: number;
  notes: string[];
}

function computeBudgetTA(plan: StrengthSportPlan): number {
  const level = (plan as any).level ?? (plan as any).inputSnapshot?.level ?? 'intermediate';
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  return map[level] ?? 85;
}

export function injectTAWeakPoints(plan: StrengthSportPlan, weakPoints: WLWeakPoint[], opts: TAInjectionOpts = {}): TAInjectionResult {
  if (!weakPoints || weakPoints.length === 0) return { plan, injected: 0, skippedBudget: 0, skippedDup: 0, notes: [] };
  const copy: StrengthSportPlan = JSON.parse(JSON.stringify(plan));
  const budget = opts.budget ?? computeBudgetTA(plan as any);
  let injected = 0, skippedBudget = 0, skippedDup = 0;
  const notes: string[] = [];

  // dedup weakPoints
  const uniq = [...new Set(weakPoints)].slice(0, 3) as WLWeakPoint[];
  // E6 v2: недели инъекции (дефолт [0] — legacy week1-only)
  const weekIdxs = Array.isArray(opts.weekIdxs) && opts.weekIdxs.length
    ? opts.weekIdxs.filter(wi => Number.isInteger(wi) && wi >= 0)
    : [0];

  for (const wi of weekIdxs) {
    const week = copy.weeksData[wi];
    if (!week) continue;
    if (week.deload) { notes.push(`⚠ нед ${week.week} — делод, пропуск`); continue; }
    for (const wp of uniq) {
      const corrList = (WL_WEAKPOINT_CORRECTION as any)[wp] as string[] | undefined;
      const bio = (TA_BIOMECH as any)[wp];
      if (!corrList || !corrList[0]) { notes.push(`⚠ ${wp} — нет коррекции`); continue; }
      // E6 v2: предпочитаемая первой, остальные — fallback (без preferred — legacy: только corr[0])
      const pref = opts.preferredCorr?.[wp];
      const candidates = pref && corrList.includes(pref)
        ? [pref, ...corrList.filter(c => c !== pref)]
        : [corrList[0]];
      // E6 v2: сеты/повторы/% из спец-блока и ранжира
      const specSets = opts.targetSetsByWeek?.[wi]?.[wp];
      const proto = opts.protocols?.[wp] || {};
      const addSets = (specSets != null && specSets > 0) ? Math.round(specSets) : (proto.sets && proto.sets > 0 ? Math.round(proto.sets) : 3);
      const repsAvg = proto.reps && proto.reps > 0 ? Math.round(proto.reps) : 5;
      const pctUsed = proto.pct && proto.pct > 0 ? proto.pct : Math.round((bio?.intensityPct ?? 0.70) * 100);
      // dayMap поддержка
      const configuredDays = opts.dayMap?.[wp];
      let targetSession: StrengthSportSession | null = null;
      if (configuredDays && configuredDays.length) {
        const dayIdx = configuredDays[0] - 1;
        targetSession = week.sessions[dayIdx] ?? null;
      }
      if (!targetSession) targetSession = sessionForInjection(week, wp);
      if (!targetSession) { notes.push(`⚠ ${wp} — нет сессии (нед ${week.week})`); continue; }
      // budget check weeklySets ЭТОЙ недели (кумулятивно с уже вставленным)
      const weeklySets = week.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
      if (weeklySets + addSets > budget) {
        skippedBudget++; notes.push(`⊘ ${wp} → превысит Budget ${budget} (нед ${week.week}: ${weeklySets}+${addSets})`);
        continue;
      }
      // перебор кандидатов: первый отсутствующий в сессии
      let placed = false;
      for (const corrId of candidates) {
        // dedup по id в ЭТОЙ сессии
        if (targetSession.exercises.some(e => e.id === corrId || e.id.toLowerCase() === corrId.toLowerCase())) {
          skippedDup++;
          continue;
        }
        // build exercise
        const wm = opts.workMax ?? (copy as any).workMax ?? (copy as any).inputSnapshot?.workMax ?? {};
        const basePm = basePmForTA(corrId, wm);
        const weight = Math.round(basePm * (pctUsed / 100) / 2.5) * 2.5;
        const rir = 2;
        const tempo = 'X-0-X-0';
        const rest = 120;
        const ex: StrengthSportExercise = {
          id: corrId,
          name: bio?.corrections?.[0] || corrId,
          group: 'legs',
          pattern: 'hinge',
          sets: addSets,
          reps: `${repsAvg}-${repsAvg + 1}`,
          rir,
          tempo,
          restSeconds: rest,
          weight,
          workSets: Array.from({ length: addSets }, () => ({ reps: repsAvg, rir, weight, pct: pctUsed, tempo, restSeconds: rest } as any)),
          warmupSets: [],
        } as any;
        // вставляем в конец сессии (аксессуар)
        targetSession.exercises.push(ex);
        // обновим week totals если есть
        if (typeof week.totalSets === 'number') week.totalSets += addSets;
        injected++;
        notes.push(`✓ ${wp} → ${corrId} в ${targetSession.sessionTag} ${addSets}×${repsAvg} @${pctUsed}% (нед ${week.week})`);
        placed = true;
        break;
      }
      if (!placed) notes.push(`⊘ ${wp} — все кандидаты уже есть (нед ${week.week})`);
    }
  }

  if (injected > 0) {
    copy.rationale = [...(copy.rationale || []), `ТА-диагностика: инъецировано ${injected} коррекций (${uniq.join(', ')})`];
  }

  return { plan: copy, injected, skippedBudget, skippedDup, notes };
}

// helper для тестов: чисто вычисление бюджета (упрощённо levelBase × etc)
// Если computeBudgetTA нет — fallback
export function computeBudgetTAFallback(level: string): number {
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  return map[level] ?? 85;
}
