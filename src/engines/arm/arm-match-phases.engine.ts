/**
 * arm-match-phases.engine.ts — P1: фазовая карта схватки.
 *
 * Разрыв хаба: failurePoint был бонусом ранжира без замеров.
 * Здесь фаза — вход диагностики: к каждой фазе привязаны доминантные
 * мышцы (Hong ISBS 2011: PM решает, FCU держит позицию; Silva 2008:
 * 40% — PT, 80% — PM+PT; статика: PM растёт нач→фин, BB/PT падают),
 * типовые срывы и WAF-риски. Без выдуманных норм — только структура.
 */

import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { isArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';

export type ArmMatchPhase = 'setup' | 'readygo' | 'start' | 'mid' | 'pin';

export const ARM_MATCH_PHASES: readonly ArmMatchPhase[] = [
  'setup', 'readygo', 'start', 'mid', 'pin',
] as const;

export function isArmMatchPhase(v: unknown): v is ArmMatchPhase {
  return typeof v === 'string' && (ARM_MATCH_PHASES as readonly string[]).includes(v);
}

export interface ArmPhaseInfo {
  phase: ArmMatchPhase;
  label: string;
  dominant: string[];
  typicalFails: string[];
  wafRisk: string;
  drillIds: string[];
}

export const ARM_PHASE_INFO: Record<ArmMatchPhase, ArmPhaseInfo> = {
  setup: {
    phase: 'setup',
    label: 'Setup — постановка хвата',
    dominant: ['finger_flexors', 'wrist_flexors'],
    typicalFails: ['contain_fingers', 'cup_start'],
    wafRisk: 'Grip Up 30с — не успел = referee grip.',
    drillIds: ['referee_grip_drill'],
  },
  readygo: {
    phase: 'readygo',
    label: 'Ready…Go — ожидание команды',
    dominant: ['wrist_flexors', 'pronators'],
    typicalFails: ['cup_start', 'pron_open'],
    wafRisk: 'Фальстарт: движение после Ready до Go.',
    drillIds: ['reaction_go', 'foul_freeze'],
  },
  start: {
    phase: 'start',
    label: 'Старт (0–1 с после Go)',
    dominant: ['pronator_teres', 'flexor_carpi_ulnaris', 'risers'],
    typicalFails: ['cup_start', 'pron_open', 'rising_top', 'back_start'],
    wafRisk: 'Элбоу-фол при рывке; срыв хвата → судейский хват.',
    drillIds: ['reaction_go', 'strap_start'],
  },
  mid: {
    phase: 'mid',
    label: 'Середина — борьба за центр',
    dominant: ['pectoralis_major', 'flexor_carpi_ulnaris', 'back_muscles'],
    typicalFails: ['cup_hold', 'pron_lock', 'sup_drag', 'side_mid', 'back_drag'],
    wafRisk: 'Плечо за центр; локоть едет по подушке.',
    drillIds: ['strap_start', 'foul_freeze'],
  },
  pin: {
    phase: 'pin',
    label: 'Пин — дожимание',
    dominant: ['pectoralis_major', 'side_pressure', 'triceps'],
    typicalFails: ['side_pin', 'sup_drag'],
    wafRisk: 'Дожим на кости при losing — humerus-риск, лучше сдать.',
    drillIds: ['foul_freeze'],
  },
};

/** Точка → фаза срыва (канон для связки ранжира и журнала). */
export const ARM_POINT_TO_PHASE: Record<ArmWeakPoint, ArmMatchPhase> = {
  contain_fingers: 'setup',
  cup_start: 'start',
  pron_open: 'start',
  rising_top: 'start',
  back_start: 'start',
  cup_hold: 'mid',
  pron_lock: 'mid',
  sup_cup: 'mid',
  sup_drag: 'mid',
  side_mid: 'mid',
  back_drag: 'mid',
  side_pin: 'pin',
};

export function phaseForWeakPoint(point: string): ArmMatchPhase | null {
  if (!isArmWeakPoint(point)) return null;
  return ARM_POINT_TO_PHASE[point];
}

export function weakPointsForPhase(phase: string): ArmWeakPoint[] {
  if (!isArmMatchPhase(phase)) return [];
  const all = Object.keys(ARM_POINT_TO_PHASE) as ArmWeakPoint[];
  const canonical = all.filter((p) => ARM_POINT_TO_PHASE[p] === phase);
  // ROUND-10: + точки, которые ЧИНЯТ фазу (fixesPhase библиотеки коррекции): канонический
  // маппинг 1-в-1 давал для setup/pin ровно одну рекомендацию при 4 доступных.
  const fixing = all.filter((p) =>
    ((ARM_CORRECTIONS[p]?.fixesPhase || []) as string[]).map((s) => String(s).toLowerCase()).includes(phase),
  );
  const out: ArmWeakPoint[] = [];
  for (const p of [...canonical, ...fixing]) if (!out.includes(p)) out.push(p);
  if (out.length) return out;
  // readygo: своих точек нет — делит precursors старта (фальстарт/Cup/pron).
  const info = ARM_PHASE_INFO[phase];
  return (info.typicalFails || []).filter((x): x is ArmWeakPoint => isArmWeakPoint(x));
}

export interface MatchPhaseInput {
  failPhase?: string | null;
  failDetail?: string | null;
  technique?: string | null;
}

export interface MatchPhaseResult {
  phase: ArmMatchPhase | null;
  weakPoints: ArmWeakPoint[];
  note: string;
  drillIds: string[];
}

/**
 * Диагностика по фазе срыва. Без фазы — честный no-data (не угадываем).
 */
export function diagnoseMatchPhase(input: MatchPhaseInput = {}): MatchPhaseResult {
  const raw = typeof input.failPhase === 'string' ? input.failPhase.toLowerCase() : '';
  if (!isArmMatchPhase(raw)) {
    return {
      phase: null,
      weakPoints: [],
      note: 'Фаза срыва не указана — отметь, где сыпешься: setup / readygo / start / mid / pin.',
      drillIds: [],
    };
  }
  const info = ARM_PHASE_INFO[raw];
  const detail = typeof input.failDetail === 'string' ? input.failDetail.trim().slice(0, 120) : '';
  const pts = weakPointsForPhase(raw);
  const note = detail
    ? `Слабая фаза: ${info.label} («${detail}») → точки ${pts.join(', ')}. Доминанта: ${info.dominant.join(', ')}.`
    : `Слабая фаза: ${info.label} → точки ${pts.join(', ')}. Доминанта: ${info.dominant.join(', ')}.`;
  return { phase: raw, weakPoints: pts, note, drillIds: info.drillIds.slice() };
}
