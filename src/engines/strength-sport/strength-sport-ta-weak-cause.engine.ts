/**
 * strength-sport-ta-weak-cause.engine.ts — ПРИЧИНЫ СЛАБЫХ ФАЗ ТА (E2 PRO-v2)
 *
 * Дифференцирует volume / technique / mobility / fatigue / strength для одной WL-фазы.
 * Parity с bb bb-weak-cause.engine.ts (причина + уверенность + текст), ТА-специфика:
 *  mobility — OHS-драйвер фазы (сед/оверхед/подсед чувствительны к мобильности);
 *  strength — ISPP/IMTP <85% для отрыва (Essex, предиктор 81%) + e1RM-тренд;
 *  fatigue — ACWR danger/caution + VBT-просадка (пороги ТА 10/20);
 *  volume — факт сетов фазы <70% недельного минимума (3×5 техника);
 *  technique — fallback (bar path отклонение усиливает, но по умолчанию — техника).
 *
 * Чистый движок, без UI/storage.
 */

import type { WLWeakPoint } from './strength-sport-weakpoint';

export type TAWeakCause = 'volume' | 'technique' | 'mobility' | 'fatigue' | 'strength';

export const TA_WEAK_CAUSE_LABELS: Record<TAWeakCause, string> = {
  volume: 'Мало объёма',
  technique: 'Техника',
  mobility: 'Мобильность',
  fatigue: 'Усталость',
  strength: 'Не хватает силы',
};

/** Фазы, чувствительные к мобильности (сед/оверхед/подсед/яма). */
const MOBILITY_SENSITIVE: WLWeakPoint[] = [
  'snatch_catch', 'snatch_overhead', 'clean_catch', 'squat_bottom', 'squat_mid', 'jerk_dip',
];

/** Недельный минимум сетов фазы (3×5 техника — протокол инъекции). */
export const TA_PHASE_WEEKLY_MIN_SETS = 3;

export interface TAWeakCauseInput {
  zone: WLWeakPoint;
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
  /** ISPP/IMTP (для отрыва). */
  isppRatio?: number | null;
  barPathDeviation?: string | null;
}

export interface TAWeakCauseResult {
  zone: WLWeakPoint;
  cause: TAWeakCause;
  confidence: 'high' | 'med' | 'low';
  text: string;
  signals: string[];
}

export function diagnoseTAWeakCause(input: TAWeakCauseInput): TAWeakCauseResult {
  const zone = input.zone;
  const signals: string[] = [];
  const minSets = input.minSetsPerWeek != null && input.minSetsPerWeek > 0 ? input.minSetsPerWeek : TA_PHASE_WEEKLY_MIN_SETS;

  const acwrBad = input.acwrZone === 'dangerous' || input.acwrZone === 'caution';
  if (acwrBad) signals.push(`ACWR ${input.acwrZone}`);
  const vbtBad = input.vbtLossPct != null && input.vbtLossPct >= 10;
  if (vbtBad) signals.push(`VBT −${input.vbtLossPct}%`);

  const mobSensitive = (MOBILITY_SENSITIVE as string[]).includes(zone);
  const mobBad = mobSensitive && input.ohsFailed != null && input.ohsFailed >= 2;
  if (mobBad) signals.push(`OHS fail ${input.ohsFailed}/6`);

  const isPullStart = zone === 'clean_off_floor' || zone === 'pull_start' || zone === 'snatch_off_floor';
  const isppBad = isPullStart && input.isppRatio != null && input.isppRatio < 0.85;
  if (isppBad) signals.push(`ISPP ${Math.round((input.isppRatio as number) * 100)}% <85%`);
  const e1rmBad = input.e1rmDeltaPct != null && input.e1rmDeltaPct <= -5 && (input.e1rmSessions ?? 0) >= 2;
  if (e1rmBad) signals.push(`e1RM ${input.e1rmDeltaPct}%`);

  const volBad = input.factSetsPerWeek != null && input.factSetsPerWeek < minSets * 0.7;
  if (volBad) signals.push(`объём ${input.factSetsPerWeek} <${Math.round(minSets * 0.7 * 10) / 10}/нед`);

  const techHint = !!input.barPathDeviation;

  // Приоритет: fatigue (острое) → mobility (структурное) → strength (предиктор) → volume → technique
  let cause: TAWeakCause = 'technique';
  let confidence: 'high' | 'med' | 'low' = 'low';
  if (acwrBad && vbtBad) {
    cause = 'fatigue';
    confidence = 'high';
  } else if (mobBad && (volBad || e1rmBad || techHint)) {
    cause = 'mobility';
    confidence = 'high';
  } else if (mobBad) {
    cause = 'mobility';
    confidence = 'med';
  } else if (isppBad || (e1rmBad && isPullStart)) {
    cause = 'strength';
    confidence = isppBad && e1rmBad ? 'high' : 'med';
  } else if (e1rmBad) {
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
    confidence = techHint ? 'med' : 'low';
  }

  const texts: Record<TAWeakCause, string> = {
    fatigue: 'Сначала восстановление: фаза просела на фоне усталости, а не слабого места.',
    mobility: 'Ограничение снизу: OHS-провал в чувствительной фазе — сначала мобильность, потом объём.',
    strength: 'Не хватает базовой силы отрыва/тяги: приоритет тяги и приседы, ISPP к ≥85% IMTP.',
    volume: 'Фаза недотренирована: поднять до минимума 3×5 в неделю в technique-день.',
    technique: 'Данных за объём/усталость/мобильность нет — работать над техникой фазы точечно.',
  };
  return { zone, cause, confidence, text: texts[cause], signals };
}
