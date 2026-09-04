/**
 * strength-sport-sm-plan-audit.engine.ts — АУДИТ ПЛАНА СТРОНГМЕНА (SM PRO)
 *
 * Читает StrengthSportPlan и считает покрытие 16 SM-фаз:
 * какие фазы тренируются планом (сеты/дни), каких нет, худшая фаза, таб хаба для фазы.
 * Parity с TA ta-plan-audit (покрытие + агрегаты, read-only).
 *
 * Чистый движок, план не мутирует.
 * Источники: SM_BIOMECH 16 фаз, Hindle/Legg carry vs static lifts.
 */

import type { StrengthSportPlan } from './strength-sport.types';
import { SM_WEAKPOINT_CORRECTION, type SMWeakPoint } from './strength-sport-sm-biomechanics.engine';

export const SM_CORE_PHASES: SMWeakPoint[] = [
  'log_dip',
  'log_drive',
  'log_lockout',
  'log_clean',
  'yoke_pickup',
  'yoke_walk',
  'farmers_pickup',
  'farmers_carry',
  'stone_off_floor',
  'stone_lap',
  'stone_load',
];

export const SM_ALL_PHASES: SMWeakPoint[] = [
  ...SM_CORE_PHASES,
  'yoke_turn',
  'farmers_grip',
  'grip_support',
  'core_brace',
  'conditioning',
];

// Инверсия SM_WEAKPOINT_CORRECTION: corrId → фазы
const SM_CORR_TO_WP: Record<string, SMWeakPoint[]> = (() => {
  const out: Record<string, SMWeakPoint[]> = {};
  for (const [wp, corrs] of Object.entries(SM_WEAKPOINT_CORRECTION) as Array<[SMWeakPoint, string[]]>) {
    for (const c of corrs || []) {
      const m = String(c).match(/\(([^)]+)\)/);
      const k = (m ? m[1] : String(c).split(' ')[0]).trim().toLowerCase();
      if (!k) continue;
      if (!out[k]) out[k] = [];
      if (!out[k].includes(wp)) out[k].push(wp);
    }
  }
  return out;
})();

/** Таб хаба для SM-фазы (press/carry/load/grip/mobility). */
export function hubTabForSMPhase(wp: SMWeakPoint): 'press' | 'carry' | 'load' | 'grip' | 'mobility' {
  if (wp.startsWith('log_')) return 'press';
  if (wp.startsWith('yoke_') || wp === 'farmers_pickup' || wp === 'farmers_carry') return 'carry';
  if (wp.startsWith('stone_')) return 'load';
  if (wp === 'farmers_grip' || wp === 'grip_support' || wp === 'core_brace' || wp === 'conditioning') return 'grip';
  return 'mobility';
}

/** Фазы, которые тренирует одно упражнение плана (по id/имени). */
export function smPhasesForExercise(ex: { id?: string; name?: string }): SMWeakPoint[] {
  const id = String((ex as { id?: string })?.id || '').toLowerCase();
  const nm = String((ex as { name?: string })?.name || '').toLowerCase();
  const s = `${id} ${nm}`;
  const out = new Set<SMWeakPoint>();
  for (const [corr, wps] of Object.entries(SM_CORR_TO_WP)) {
    if (id === corr || id.includes(corr)) {
      for (const w of wps) out.add(w);
    }
  }
  if (out.size > 0) return [...out];
  const has = (t: string): boolean => s.includes(t);
  if (has('log') || has('axle') || has('viking') || has('circus') || has('jerk_dip') || has('push_press') || has('pin_press')) {
    if (has('dip') || has('jerk_dip')) return ['log_dip'];
    if (has('push') || has('drive')) return ['log_drive'];
    if (has('pin') || has('lockout')) return ['log_lockout'];
    if (has('clean') || has('rdl') || has('lap')) return ['log_clean'];
    return ['log_dip', 'log_drive', 'log_lockout', 'log_clean'];
  }
  if (has('yoke')) {
    if (has('pickup') || has('pause_squat')) return ['yoke_pickup'];
    if (has('turn')) return ['yoke_turn'];
    return ['yoke_pickup', 'yoke_walk'];
  }
  if (has('farmer') || has('frame_carry') || has('husafell') || has('conan') || has('shield')) {
    if (has('pickup')) return ['farmers_pickup'];
    if (has('pinch') || has('grip') || has('hang')) return ['farmers_grip'];
    return ['farmers_pickup', 'farmers_carry'];
  }
  if (has('stone') || has('sandbag') || has('keg') || has('tire') || has('lap')) {
    if (has('deficit') || has('off')) return ['stone_off_floor'];
    if (has('lap') || has('front_squat')) return ['stone_lap'];
    if (has('load') || has('over_bar')) return ['stone_load'];
    return ['stone_off_floor', 'stone_lap', 'stone_load'];
  }
  if (has('pinch') || has('grip') || has('crush') || has('coc')) return ['grip_support', 'farmers_grip'];
  if (has('plank') || has('suitcase') || has('pallof') || has('brace') || has('core')) return ['core_brace'];
  if (has('sled') || has('prowler') || has('conditioning') || has('tire_flip')) return ['conditioning'];
  return [];
}

export interface SMPhaseAudit {
  phase: SMWeakPoint;
  sets: number;
  days: number;
  covered: boolean;
}

export interface SMAuditResult {
  hasPlan: boolean;
  workWeeks: number;
  totalSets: number;
  byPhase: Record<string, SMPhaseAudit>;
  coveredCount: number;
  uncovered: SMWeakPoint[];
  worstPhase: SMWeakPoint | null;
}

export function auditSMPlan(plan: StrengthSportPlan | null | undefined): SMAuditResult {
  const empty: SMAuditResult = {
    hasPlan: false,
    workWeeks: 0,
    totalSets: 0,
    byPhase: {},
    coveredCount: 0,
    uncovered: [...SM_ALL_PHASES],
    worstPhase: SM_ALL_PHASES[0] ?? null,
  };
  if (!plan || !Array.isArray((plan as { weeksData?: unknown[] }).weeksData)) return empty;
  const weeks = (plan as { weeksData: Array<{ deload?: boolean; sessions?: Array<{ exercises?: Array<{ id?: string; name?: string; sets?: number }> }> }> }).weeksData;
  const workWeeksArr = weeks.filter((w) => !w.deload);
  const byPhase: Record<string, SMPhaseAudit> = {};
  for (const ph of SM_ALL_PHASES) byPhase[ph] = { phase: ph, sets: 0, days: 0, covered: false };
  let totalSets = 0;
  const daySeen: Record<string, Set<number>> = {};
  for (const ph of SM_ALL_PHASES) daySeen[ph] = new Set<number>();
  workWeeksArr.forEach((w, wi) => {
    (w.sessions || []).forEach((s, si) => {
      for (const e of s.exercises || []) {
        const sets = Number(e.sets) || 0;
        totalSets += sets;
        for (const ph of smPhasesForExercise(e)) {
          byPhase[ph].sets += sets;
          daySeen[ph].add(wi * 10 + si);
        }
      }
    });
  });
  for (const ph of SM_ALL_PHASES) {
    byPhase[ph].days = daySeen[ph].size;
    byPhase[ph].covered = byPhase[ph].sets > 0;
  }
  const coveredCount = SM_ALL_PHASES.filter((p) => byPhase[p].covered).length;
  const uncovered = SM_ALL_PHASES.filter((p) => !byPhase[p].covered);
  // Худшая: core-фases с 0 сетов приоритетно, иначе минимум сетов
  let worst: SMWeakPoint | null = null;
  for (const p of SM_CORE_PHASES) {
    if (!byPhase[p].covered) {
      worst = p;
      break;
    }
  }
  if (!worst) {
    let min = Infinity;
    for (const p of SM_ALL_PHASES) {
      if (byPhase[p].sets < min) {
        min = byPhase[p].sets;
        worst = p;
      }
    }
  }
  return { hasPlan: true, workWeeks: Math.max(1, workWeeksArr.length), totalSets, byPhase, coveredCount, uncovered, worstPhase: worst };
}
