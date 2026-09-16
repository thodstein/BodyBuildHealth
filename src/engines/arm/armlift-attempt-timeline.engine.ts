/**
 * armlift-attempt-timeline.engine.ts — фазовая развёртка попытки во времени (PRO-6 M1).
 * Статика точки срыва говорит «где», таймлайн — «как ломалось по ходу попытки»:
 * setup → фазы срыва снаряда → down. Нормы и фолы — только из
 * `armlift-failure-modes` (IronMind/AUSA), слабые звенья — из `armlift-diagnosis`.
 * Никаких новых нормативов в кг. Чистые функции, без стораджа.
 */
import {
  movementFor,
  faultsFor,
  failuresFor,
  type ArmliftDiagImplement,
  type ArmliftMovePhase,
} from './armlift-failure-modes.engine';
import type { ArmliftWeakLink } from './armlift-diagnosis.engine';

export interface ArmliftTimelinePhase extends ArmliftMovePhase {
  /** Порядковый номер в попытке (0 = setup). */
  order: number;
  /** true → фаза может быть точкой срыва (setup/down — нет). */
  isFailurePhase: boolean;
  /** Какие слабые звенья обычно роняют именно эту фазу. */
  weakLinks: ArmliftWeakLink[];
}

const DOWN_NORM = 'Контроль до пола, хват держит до касания; вес на пол — потом отпустить';

/** Кандидаты фолов опускания — берём только те, что есть в чек-листе снаряда. */
const DOWN_FAULT_CANDIDATES = ['body_drag', 'not_parallel', 'rush'];

/** Слабое звено → фазы: таблица без выдумок (маппинг наших же звеньев на наши же фазы). */
const WEAK_BY_PHASE: Record<string, ArmliftWeakLink[]> = {
  setup: ['technique'],
  off_floor: ['fingers', 'thumb', 'crush', 'wrist_ext'],
  mid: ['fingers', 'support_endurance', 'wrist_ext'],
  hold_short: ['fingers', 'support_endurance', 'crush', 'wrist_ext'],
  hold_long: ['support_endurance', 'crush'],
  close_fail: ['crush'],
  lockout: ['support_endurance', 'wrist_ext', 'technique'],
  down: ['technique'],
};

export function weakLinksForPhase(phaseId: string): ArmliftWeakLink[] {
  return WEAK_BY_PHASE[String(phaseId || '')] || ['technique'];
}

/**
 * Полный таймлайн попытки: фазы снаряда из `movementFor` + финальное опускание.
 * Фолы down — только пересечение с чек-листом (инвариант «фолы ⊂ чек-листа» цел).
 */
export function attemptTimelineFor(implement: string): ArmliftTimelinePhase[] {
  const base = movementFor(implement);
  const allowed = new Set(faultsFor(implement).map((fl) => fl.id));
  const downFaults = DOWN_FAULT_CANDIDATES.filter((id) => allowed.has(id));
  const chain: ArmliftTimelinePhase[] = base.map((ph, idx) => ({
    ...ph,
    order: idx,
    isFailurePhase: ph.id !== 'setup',
    weakLinks: weakLinksForPhase(ph.id),
  }));
  chain.push({
    id: 'down',
    label: 'Опускание',
    good: DOWN_NORM,
    faultIds: downFaults,
    order: chain.length,
    isFailurePhase: false,
    weakLinks: weakLinksForPhase('down'),
  });
  return chain;
}

/** Фаза по точке срыва (id совпадают 1-в-1); setup/down точками срыва не бывают. */
export function phaseForFailurePoint(
  implement: string,
  failurePoint: string,
): ArmliftTimelinePhase | null {
  const fp = String(failurePoint || '');
  if (!fp || fp === 'setup' || fp === 'down') return null;
  return attemptTimelineFor(implement).find((ph) => ph.id === fp) || null;
}

/** Первая фаза таймлайна, содержащая фол; нет — null. */
export function phaseForFault(
  implement: string,
  faultId: string,
): ArmliftTimelinePhase | null {
  const fid = String(faultId || '');
  if (!fid) return null;
  return attemptTimelineFor(implement).find((ph) => ph.faultIds.includes(fid)) || null;
}

/** Все известные снаряды таймлайна (канон — из failure-modes). */
export function timelineImplements(): ArmliftDiagImplement[] {
  return [
    'rolling_thunder', 'apollon_axle', 'saxon_bar', 'hub', 'pinch_block',
    'coc_gripper', 'silver_bullet', 'excalibur', 'raptor_175', 'country_crush',
    'grandfather_clock', 'anvil', 'saxon_medley', 'fat_gripz',
  ];
}

/** Точки срыва снаряда (для lock-тестов связки с таймлайном). */
export function failureIdsFor(implement: string): string[] {
  return failuresFor(implement).map((f) => f.id);
}
