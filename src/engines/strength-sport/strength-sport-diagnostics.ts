/**
 * strength-sport-diagnostics.ts — диагностика слабых фаз ТА/стронга (порт lms/weakpoint-pl).
 * 5 отклонений штанги + 7 фаз рывка/толчка + асимметрия.
 */

import { WL_WEAKPOINT_LABELS, type WLWeakPoint } from './strength-sport-weakpoint';

export type BarPathDeviation = 'forward' | 'backward' | 'loop' | 'early_pull' | 'soft_lockout';

export const BAR_PATH_LABELS: Record<BarPathDeviation, string> = {
  forward: 'Уход вперёд (штанга впереди)',
  backward: 'Уход назад (завал)',
  loop: 'Петля (S-траектория)',
  early_pull: 'Ранняя тяга (срыв до колен)',
  soft_lockout: 'Мягкий замок (недофикс)',
};

export const BAR_PATH_CORRECTION: Record<BarPathDeviation, string[]> = {
  forward: ['pause_snatch', 'snatch_balance', 'overhead_squat_v2'],
  backward: ['deficit_snatch', 'snatch_pull', 'high_hang_snatch'],
  loop: ['muscle_snatch', 'hang_snatch', 'tempo_squat'],
  early_pull: ['pause_pull', 'deficit_pull', 'clean_pull'],
  soft_lockout: ['push_jerk', 'split_jerk', 'jerk_recovery'],
};

export type LiftingPhase = 'off_floor' | 'mid' | 'pull_under' | 'catch' | 'overhead' | 'dip' | 'drive' | 'lockout' | 'bottom' | 'lockout_dead';

export function diagnoseBarPath(lift: string, deviation: BarPathDeviation): { weak: WLWeakPoint | null; corrections: string[] } {
  const map: Record<string, Record<BarPathDeviation, WLWeakPoint>> = {
    snatch: { forward: 'snatch_mid', backward: 'snatch_off_floor', loop: 'snatch_pull_under', early_pull: 'snatch_mid', soft_lockout: 'snatch_catch' },
    clean: { forward: 'clean_mid', backward: 'clean_off_floor', loop: 'clean_catch', early_pull: 'clean_mid', soft_lockout: 'clean_catch' },
    jerk: { forward: 'jerk_drive', backward: 'jerk_dip', loop: 'jerk_lockout', early_pull: 'jerk_dip', soft_lockout: 'jerk_lockout' },
    squat: { forward: 'squat_mid', backward: 'squat_bottom', loop: 'squat_mid', early_pull: 'squat_bottom', soft_lockout: 'squat_mid' },
  };
  const key = lift.toLowerCase().includes('snatch') ? 'snatch' : lift.toLowerCase().includes('clean') || lift.toLowerCase().includes('jerk') ? (lift.includes('jerk') ? 'jerk' : 'clean') : lift.toLowerCase().includes('squat') ? 'squat' : 'snatch';
  const table = map[key];
  const weak = table ? table[deviation] : null;
  return { weak: weak as WLWeakPoint | null, corrections: BAR_PATH_CORRECTION[deviation] || [] };
}

export function diagnoseAsymmetry(leftMax: number, rightMax: number, thresholdPct = 10): { isAsymmetric: boolean; weaker: 'left' | 'right' | null; diffPct: number } {
  if (!leftMax || !rightMax) return { isAsymmetric: false, weaker: null, diffPct: 0 };
  const diff = Math.abs(leftMax - rightMax) / Math.max(leftMax, rightMax) * 100;
  const isAsym = diff >= thresholdPct;
  return { isAsymmetric: isAsym, weaker: isAsym ? (leftMax < rightMax ? 'left' : 'right') : null, diffPct: Math.round(diff * 10) / 10 };
}

export function weakPointToRationale(wp: WLWeakPoint): string {
  return WL_WEAKPOINT_LABELS[wp] || wp;
}
