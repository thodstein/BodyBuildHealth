/**
 * strength-sport-sm-weak-cause.engine.ts — ПРИЧИНЫ СЛАБЫХ ФАЗ СТРОНГМЕНА (SM PRO)
 *
 * Дифференцирует volume / technique / mobility / fatigue / strength / grip для одной SM-фазы.
 * Parity с TA ta-weak-cause (причина + уверенность + текст + сигналы), SM-специфика:
 *  mobility — OHS-драйвер фазы (yoke_pickup/yoke_walk/stone_lap/log_clean чувствительны);
 *  strength — hold-провал (farmersHold/axleDOH) + e1RM-тренд ≤-5% + stone/log только при reps≤3;
 *  grip — отдельная причина для farmers_grip/grip_support (tri-modal провал ≥1);
 *  fatigue — ACWR danger/caution + VBT-просадка (пороги SM carry 15/25, press 10/20);
 *  volume — факт сетов фазы <70% недельного минимума (3×5 / 20м carry);
 *  technique — fallback (sway >3см усиливает, но по умолчанию — техника).
 *
 * Чистый движок, без UI/storage.
 * Источники: Hindle yoke 2021 / stone PeerJ 2021, Winwood injuries 2014,
 * Legg systematic 2019, Heazlewood biceps 2025, SBS grip 2024.
 */

import type { SMWeakPoint } from './strength-sport-sm-biomechanics.engine';

export type SMWeakCause = 'volume' | 'technique' | 'mobility' | 'fatigue' | 'strength' | 'grip';

export const SM_WEAK_CAUSE_LABELS: Record<SMWeakCause, string> = {
  volume: 'Мало объёма',
  technique: 'Техника',
  mobility: 'Мобильность',
  fatigue: 'Усталость',
  strength: 'Не хватает силы',
  grip: 'Хват',
};

/** Фазы, чувствительные к мобильности (сед/пикап/lap/rack). */
const SM_MOBILITY_SENSITIVE: SMWeakPoint[] = [
  'yoke_pickup',
  'yoke_walk',
  'stone_lap',
  'stone_off_floor',
  'log_clean',
  'log_dip',
];

/** Недельный минимум сетов фазы (3×5 техника / 3×20м carry — протокол инъекции). */
export const SM_PHASE_WEEKLY_MIN_SETS = 3;

export interface SMWeakCauseInput {
  zone: SMWeakPoint;
  /** Факт сетов фазы в неделю (из аудита: sets/workWeeks). */
  factSetsPerWeek?: number | null;
  /** Недельный минимум (дефолт 3). */
  minSetsPerWeek?: number | null;
  e1rmDeltaPct?: number | null;
  e1rmSessions?: number | null;
  acwrZone?: string | null; // undertrained|optimal|caution|dangerous
  vbtLossPct?: number | null;
  /** OHS fails 0-6. */
  ohsFailed?: number | null;
  /** Hold-провалы tri-modal 0-3 (support/pinch/crush). */
  gripFails?: number | null;
  /** Carry sway см (lateral). */
  swayCm?: number | null;
  /** Асимметрия L/R % (фармер-hold). */
  asymmetryPct?: number | null;
}

export interface SMWeakCauseResult {
  zone: SMWeakPoint;
  cause: SMWeakCause;
  confidence: 'high' | 'med' | 'low';
  text: string;
  signals: string[];
}

const isCarryZone = (z: string): boolean =>
  z === 'yoke_walk' || z === 'farmers_carry' || z === 'yoke_pickup' || z === 'farmers_pickup' || z === 'yoke_turn';
const isGripZone = (z: string): boolean =>
  z === 'farmers_grip' || z === 'grip_support';

export function diagnoseSMWeakCause(input: SMWeakCauseInput): SMWeakCauseResult {
  const zone = input.zone;
  const signals: string[] = [];
  const minSets =
    input.minSetsPerWeek != null && input.minSetsPerWeek > 0 ? input.minSetsPerWeek : SM_PHASE_WEEKLY_MIN_SETS;

  const acwrBad = input.acwrZone === 'dangerous' || input.acwrZone === 'caution';
  if (acwrBad) signals.push(`ACWR ${input.acwrZone}`);
  // Пороги SM: carry 15/25, press/log 10/20
  const vbtWarn = isCarryZone(zone) ? 15 : 10;
  const vbtBad = input.vbtLossPct != null && input.vbtLossPct >= vbtWarn;
  if (vbtBad) signals.push(`VBT −${input.vbtLossPct}%`);

  const mobSensitive = (SM_MOBILITY_SENSITIVE as string[]).includes(zone);
  const mobBad = mobSensitive && input.ohsFailed != null && input.ohsFailed >= 2;
  if (mobBad) signals.push(`OHS fail ${input.ohsFailed}/6`);

  const gripBad = input.gripFails != null && input.gripFails >= 1;
  if (gripBad && isGripZone(zone)) signals.push(`grip fail ${input.gripFails}/3`);
  const asymBad = input.asymmetryPct != null && input.asymmetryPct >= 7;
  if (asymBad && (isGripZone(zone) || zone === 'stone_off_floor')) signals.push(`асимметрия ${input.asymmetryPct}%`);

  const e1rmBad = input.e1rmDeltaPct != null && input.e1rmDeltaPct <= -5 && (input.e1rmSessions ?? 0) >= 2;
  if (e1rmBad) signals.push(`e1RM ${input.e1rmDeltaPct}%`);

  const volBad = input.factSetsPerWeek != null && input.factSetsPerWeek < minSets * 0.7;
  if (volBad) signals.push(`объём ${input.factSetsPerWeek} <${Math.round(minSets * 0.7 * 10) / 10}/нед`);

  const swayHint = input.swayCm != null && input.swayCm > 3;
  if (swayHint && isCarryZone(zone)) signals.push(`sway ${input.swayCm}см >3`);

  // Приоритет: grip (структурный лимитер) → fatigue (острое) → mobility → strength → volume → technique
  let cause: SMWeakCause = 'technique';
  let confidence: 'high' | 'med' | 'low' = 'low';
  if (isGripZone(zone) && gripBad && (asymBad || e1rmBad || volBad)) {
    cause = 'grip';
    confidence = 'high';
  } else if (isGripZone(zone) && gripBad) {
    cause = 'grip';
    confidence = 'med';
  } else if (acwrBad && vbtBad) {
    cause = 'fatigue';
    confidence = 'high';
  } else if (mobBad && (volBad || e1rmBad || swayHint)) {
    cause = 'mobility';
    confidence = 'high';
  } else if (mobBad) {
    cause = 'mobility';
    confidence = 'med';
  } else if (e1rmBad && !isGripZone(zone)) {
    cause = 'strength';
    confidence = 'med';
  } else if (volBad) {
    cause = 'volume';
    confidence = input.factSetsPerWeek === 0 ? 'high' : 'med';
  } else if (acwrBad || vbtBad) {
    cause = 'fatigue';
    confidence = 'med';
  } else {
    cause = 'technique';
    confidence = swayHint ? 'med' : 'low';
  }

  const texts: Record<SMWeakCause, string> = {
    grip: 'Лимитер — хват: сначала tri-modal (support/pinch/crush) и асимметрия, потом объём carries.',
    fatigue: 'Сначала восстановление: фаза просела на фоне усталости (ACWR+VBT), а не слабого места.',
    mobility: 'Ограничение снизу: OHS-провал в чувствительной фазе — сначала мобильность (голеностоп/таз), потом объём.',
    strength: 'Не хватает базовой силы: приоритет тяги/приседы/фермер-hold, e1RM к росту.',
    volume: 'Фаза недотренирована: поднять до минимума 3×5 (carry 3×20м) в event-день.',
    technique: 'Данных за объём/усталость/мобильность/хват нет — работать над техникой фазы точечно.',
  };
  return { zone, cause, confidence, text: texts[cause], signals };
}
