/**
 * strength-sport-ta-plan-audit.engine.ts — АУДИТ ПЛАНА ТА (E1 PRO-v2)
 *
 * Читает StrengthSportPlan (he_strength_sport_plan_v1) и считает покрытие 16 WL-фаз:
 * какие фазы тренируются планом (сеты/тоннаж/дни), каких нет, худшая фаза.
 * Parity с bb bb-plan-exercise-audit.engine.ts (покрытие + агрегаты, read-only).
 *
 * Чистый движок, план не мутирует. Совместим с WL_WEAKPOINT_* / TA_BIOMECH (не заменяет).
 */

import type { StrengthSportPlan } from './strength-sport.types';
import {
  WL_WEAKPOINT_LABELS,
  WL_WEAKPOINT_CORRECTION,
  type WLWeakPoint,
} from './strength-sport-weakpoint';

export const TA_CORE_PHASES: WLWeakPoint[] = [
  'snatch_off_floor', 'snatch_mid', 'snatch_pull_under', 'snatch_catch', 'snatch_overhead',
  'clean_off_floor', 'clean_mid', 'clean_catch',
  'jerk_dip', 'jerk_drive', 'jerk_lockout',
];

export const TA_ALL_PHASES: WLWeakPoint[] = [
  ...TA_CORE_PHASES,
  'squat_bottom', 'squat_mid', 'pull_start', 'pull_lockout', 'press_start',
];

// Инверсия WL_WEAKPOINT_CORRECTION: corrId → фазы (один corr может закрывать 2 фазы)
const CORR_TO_WP: Record<string, WLWeakPoint[]> = (() => {
  const out: Record<string, WLWeakPoint[]> = {};
  for (const [wp, corrs] of Object.entries(WL_WEAKPOINT_CORRECTION) as Array<[WLWeakPoint, string[]]>) {
    for (const c of corrs || []) {
      const k = String(c).toLowerCase();
      if (!out[k]) out[k] = [];
      if (!out[k].includes(wp)) out[k].push(wp);
    }
  }
  return out;
})();

const SNATCH_ALL: WLWeakPoint[] = ['snatch_off_floor', 'snatch_mid', 'snatch_pull_under', 'snatch_catch', 'snatch_overhead'];
const CLEAN_ALL: WLWeakPoint[] = ['clean_off_floor', 'clean_mid', 'clean_catch'];
const JERK_ALL: WLWeakPoint[] = ['jerk_dip', 'jerk_drive', 'jerk_lockout'];

/**
 * Фазы, которые тренирует одно упражнение плана (по id/имени).
 * Порядок: сначала точные corr-id, затем токены главного движения.
 */
export function phasesForExercise(ex: { id?: string; name?: string }): WLWeakPoint[] {
  const id = String((ex as any)?.id || '').toLowerCase();
  const nm = String((ex as any)?.name || '').toLowerCase();
  const s = `${id} ${nm}`;
  const out = new Set<WLWeakPoint>();
  // 1. Точные corr-id (подстрока id)
  for (const [corr, wps] of Object.entries(CORR_TO_WP)) {
    if (id === corr || id.startsWith(corr + '_') || id.endsWith('_' + corr) || id.includes(corr)) {
      for (const w of wps) out.add(w);
    }
  }
  if (out.size > 0) return [...out];
  // 2. Токены главных движений
  const has = (t: string) => s.includes(t);
  if (has('snatch')) {
    if (has('deficit')) return ['snatch_off_floor'];
    if (has('pause')) return ['snatch_mid'];
    if (has('muscle') || has('high_hang') || has('hang')) return ['snatch_pull_under'];
    if (has('balance') || has('overhead')) return ['snatch_catch', 'snatch_overhead'];
    if (has('pull')) return ['snatch_off_floor', 'snatch_mid'];
    if (has('block')) return ['snatch_mid', 'snatch_pull_under'];
    return [...SNATCH_ALL];
  }
  const isClean = has('clean');
  const isJerk = has('jerk') || has('push_press') || has('pushpress');
  if (isClean && !isJerk) {
    if (has('deficit')) return ['clean_off_floor'];
    if (has('pause')) return ['clean_mid'];
    if (has('pull')) return ['clean_off_floor', 'clean_mid'];
    if (has('front')) return ['clean_catch'];
    return [...CLEAN_ALL];
  }
  if (isJerk) {
    const j: WLWeakPoint[] = [];
    if (has('dip')) j.push('jerk_dip');
    if (has('push_press') || has('pushpress') || has('press') || has('drive')) j.push('jerk_drive');
    if (has('split') || has('tall') || has('balance') || has('recovery') || has('lockout')) j.push('jerk_lockout');
    if (has('pause')) { if (!j.includes('jerk_dip')) j.push('jerk_dip'); if (!j.includes('jerk_drive')) j.push('jerk_drive'); }
    if (isClean) {
      // clean_and_jerk — тренирует и взятие
      return [...new Set<WLWeakPoint>([...CLEAN_ALL, ...(j.length ? j : JERK_ALL)])];
    }
    return j.length ? j : [...JERK_ALL];
  }
  if (has('front_squat') || has('front squat')) return ['clean_catch'];
  if (has('overhead')) return ['snatch_catch', 'snatch_overhead'];
  if (has('squat')) return ['squat_bottom', 'squat_mid', 'clean_catch', 'snatch_catch'];
  if (has('rdl') || has('romanian') || has('румын')) return ['snatch_mid', 'clean_mid'];
  if (has('deadlift') || has('pull') || has('тяг')) return ['pull_start', 'pull_lockout'];
  if (has('press') || has('ohp') || has('жим')) return ['press_start', 'jerk_drive'];
  return [];
}

export interface TAPhaseCoverage {
  weakPoint: WLWeakPoint;
  label: string;
  sets: number;
  sessions: number;
  days: number[];
  tonnage: number;
  covered: boolean;
}

export interface TAPlanAudit {
  weeks: number;
  workWeeks: number;
  deloadWeeks: number;
  totalSets: number;
  totalTonnage: number;
  byPhase: Record<WLWeakPoint, TAPhaseCoverage>;
  coveredCount: number; // из CORE-11
  totalCore: number;
  coveragePct: number;
  missing: WLWeakPoint[]; // CORE-11 без сетов
  worstPhase: WLWeakPoint | null; // минимум сетов среди CORE-11
  hasPlan: boolean;
}

function emptyCoverage(wp: WLWeakPoint): TAPhaseCoverage {
  return { weakPoint: wp, label: WL_WEAKPOINT_LABELS[wp] || wp, sets: 0, sessions: 0, days: [], tonnage: 0, covered: false };
}

export function auditTAPlan(plan: StrengthSportPlan | null | undefined): TAPlanAudit {
  const byPhase = Object.fromEntries(TA_ALL_PHASES.map(wp => [wp, emptyCoverage(wp)])) as Record<WLWeakPoint, TAPhaseCoverage>;
  const blank: TAPlanAudit = {
    weeks: 0, workWeeks: 0, deloadWeeks: 0, totalSets: 0, totalTonnage: 0,
    byPhase, coveredCount: 0, totalCore: TA_CORE_PHASES.length, coveragePct: 0,
    missing: [...TA_CORE_PHASES], worstPhase: TA_CORE_PHASES[0], hasPlan: false,
  };
  if (!plan || !Array.isArray((plan as any).weeksData) || (plan as any).weeksData.length === 0) return blank;
  const weeks = (plan as any).weeksData as Array<any>;
  let totalSets = 0;
  let totalTonnage = 0;
  let deloadWeeks = 0;
  for (const wk of weeks) {
    if (!wk || !Array.isArray(wk.sessions)) continue;
    if (wk.deload) { deloadWeeks++; continue; }
    for (const sess of wk.sessions) {
      if (!sess || !Array.isArray(sess.exercises)) continue;
      const day = Number(sess.day) || 0;
      for (const ex of sess.exercises) {
        if (!ex) continue;
        const sets = Number((ex as any).sets) || 0;
        const wps = phasesForExercise(ex as any);
        // тоннаж упражнения
        let ton = 0;
        try {
          const ws = (ex as any).workSets;
          if (Array.isArray(ws)) for (const w of ws) ton += (Number(w?.weight) || 0) * (Number(w?.reps) || 0);
        } catch { /* noop */ }
        totalSets += sets;
        totalTonnage += ton;
        if (!wps.length) continue;
        for (const wp of wps) {
          const c = byPhase[wp];
          if (!c) continue;
          c.sets += sets;
          c.sessions += 1;
          c.tonnage += Math.round(ton / wps.length);
          if (day > 0 && !c.days.includes(day)) c.days.push(day);
        }
      }
    }
  }
  for (const wp of TA_ALL_PHASES) {
    const c = byPhase[wp];
    c.days.sort((a, b) => a - b);
    c.covered = c.sets > 0;
  }
  const covered = TA_CORE_PHASES.filter(wp => byPhase[wp].covered);
  const missing = TA_CORE_PHASES.filter(wp => !byPhase[wp].covered);
  let worst: WLWeakPoint | null = null;
  let worstSets = Infinity;
  for (const wp of TA_CORE_PHASES) {
    if (byPhase[wp].sets < worstSets) { worstSets = byPhase[wp].sets; worst = wp; }
  }
  const workWeeks = weeks.length - deloadWeeks;
  return {
    weeks: weeks.length, workWeeks, deloadWeeks,
    totalSets, totalTonnage: Math.round(totalTonnage),
    byPhase,
    coveredCount: covered.length,
    totalCore: TA_CORE_PHASES.length,
    coveragePct: Math.round((covered.length / TA_CORE_PHASES.length) * 100),
    missing,
    worstPhase: worst,
    hasPlan: true,
  };
}

/** Группа таба хаба для фазы (snatch/clean/jerk; squat/pull/press → null = только инфо). */
export function hubTabForPhase(wp: WLWeakPoint): 'snatch' | 'clean' | 'jerk' | null {
  if (wp.startsWith('snatch_')) return 'snatch';
  if (wp.startsWith('clean_')) return 'clean';
  if (wp.startsWith('jerk_')) return 'jerk';
  return null;
}
