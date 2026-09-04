/**
 * strength-sport-sm-hold.engine.ts — HOLD-ТЕСТЫ СТРОНГМЕНА (SM PRO, аналог IMTP/ISPP у ТА)
 *
 * Три полевых теста без динамометра:
 *  logLockoutHold 10с @90% (овер­хед-стабильность) + farmersHold 60с @BW/рука (support)
 *  + axleDOH (double-overhand тяга, открытая кисть).
 * Пороги — полевые ориентиры (помечены): lockout 10с / farmers 60с / axleDOH 70% DL.
 * Профиль: grip_deficit / overhead_deficit / balanced.
 * Источники: SBS support/pinch/crush, PoinT GO farmer 70-100% BW 20-30м,
 * GoldenGrip tri-modal, Heazlewood (hold без рывка).
 *
 * Чистый движок, без UI/storage.
 */

export interface SMHoldInput {
  bodyweightKg?: number | null;
  deadliftKg?: number | null;
  logHoldSec?: number | null; // удержание лога над головой @~90%, с
  logHoldKg?: number | null;
  farmersHoldSec?: number | null; // удержание фермера @BW/рука, с
  farmersHoldKg?: number | null; // вес на руку
  axleDohKg?: number | null; // axle double-overhand макс
}

export interface SMHoldResult {
  valid: boolean;
  profile: 'grip_deficit' | 'overhead_deficit' | 'balanced' | 'unknown';
  verdict: string;
  warnings: string[];
  details: string[];
}

/** Полевые нормы-ориентиры (не диагноз). */
export const SM_HOLD_NORMS = {
  logHoldSec: 10,
  farmersHoldSec: 60,
  axleDohRatio: 0.7, // axleDOH ≥70% DL
};

export function diagnoseSMHold(input: SMHoldInput): SMHoldResult | null {
  const hasAny =
    input.logHoldSec != null || input.farmersHoldSec != null || input.axleDohKg != null || input.logHoldKg != null || input.farmersHoldKg != null;
  if (!hasAny) return null;
  const warnings: string[] = [];
  const details: string[] = [];
  const bw = input.bodyweightKg != null && Number.isFinite(input.bodyweightKg) && (input.bodyweightKg as number) > 0 ? (input.bodyweightKg as number) : null;
  const dl = input.deadliftKg != null && Number.isFinite(input.deadliftKg) && (input.deadliftKg as number) > 0 ? (input.deadliftKg as number) : null;

  let logOk: boolean | null = null;
  if (input.logHoldSec != null && Number.isFinite(input.logHoldSec)) {
    logOk = (input.logHoldSec as number) >= SM_HOLD_NORMS.logHoldSec;
    details.push(`Лог-hold ${input.logHoldSec}с ${logOk ? '≥' : '<'}${SM_HOLD_NORMS.logHoldSec}с`);
    if (!logOk) warnings.push('Локаут не держит 10с — приоритет pin-press + Z-press + верх спины.');
  }
  let farmOk: boolean | null = null;
  if (input.farmersHoldSec != null && Number.isFinite(input.farmersHoldSec)) {
    farmOk = (input.farmersHoldSec as number) >= SM_HOLD_NORMS.farmersHoldSec;
    const atBw = bw != null && input.farmersHoldKg != null && Math.abs((input.farmersHoldKg as number) - bw) / bw <= 0.15;
    details.push(`Фермер-hold ${input.farmersHoldSec}с ${farmOk ? '≥' : '<'}${SM_HOLD_NORMS.farmersHoldSec}с${input.farmersHoldKg != null ? ` @${input.farmersHoldKg}кг${atBw ? ' (≈BW)' : ''}` : ''}`);
    if (!farmOk) warnings.push('Support сыпется раньше 60с — Fat Gripz разминка + farmer 70-100% BW 20-30м 4-5×.');
  }
  let axleOk: boolean | null = null;
  if (input.axleDohKg != null && Number.isFinite(input.axleDohKg)) {
    if (dl != null) {
      axleOk = (input.axleDohKg as number) >= dl * SM_HOLD_NORMS.axleDohRatio;
      details.push(`Axle DOH ${input.axleDohKg}кг ${axleOk ? '≥' : '<'}${Math.round(dl * SM_HOLD_NORMS.axleDohRatio)}кг (70% DL ${dl}кг)`);
    } else {
      details.push(`Axle DOH ${input.axleDohKg}кг (DL не задан — норма 70% DL)`);
    }
    if (axleOk === false) warnings.push('Открытая кисть слаба — plate pinch 3×30с + towel hangs.');
  }
  if (bw == null) warnings.push('Вес тела не задан — фермер @BW проверить нельзя.');
  if (dl == null && input.axleDohKg != null) warnings.push('Тяга не задана — axle-норма считается от 70% DL.');

  let profile: SMHoldResult['profile'] = 'unknown';
  let verdict = 'Недостаточно данных — введи хотя бы один hold-тест.';
  const fails = [logOk === false, farmOk === false, axleOk === false].filter(Boolean).length;
  if (logOk === false && (farmOk !== false || axleOk !== false)) {
    profile = 'overhead_deficit';
    verdict = 'Дефицит оверхеда: локаут не держит — приоритет жимовой блок (pin/Z-press), carries держать taper.';
  } else if (farmOk === false || axleOk === false) {
    profile = 'grip_deficit';
    verdict = 'Дефицит хвата: support/открытая кисть — приоритет farmer-hold + pinch, mixed-grip DL только со straps.';
  } else if (fails === 0 && (logOk === true || farmOk === true || axleOk === true)) {
    profile = 'balanced';
    verdict = 'Hold-профиль сбалансирован — держать farmer 2×/нед + лог-локаут в конце сессии.';
  }
  return { valid: true, profile, verdict, warnings, details };
}
