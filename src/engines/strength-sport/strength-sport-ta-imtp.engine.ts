/**
 * strength-sport-ta-imtp.engine.ts — IMTP/RFD ПРОФИЛЬ ТА (E13 PRO-v2)
 *
 * Пик силы + RFD + длительность + countermovement-guard → профиль
 * «база силы / взрыв / сбалансирован». Источники: Stone 25+ лет (IMTP зеркалит
 * 2-ю тягу), Meloq 2025 (1-с протокол валиден), Science for Sport
 * (dip перед тягой инвалидирует тест — только статика).
 * Пороги — ориентиры полевых норм, помечены как таковые.
 * Чистый движок, без UI/storage.
 */

export interface TAImtpInput {
  peakForceN?: number | null;
  bodyweightKg?: number | null;
  rfdNs?: number | null; // Н/с, окно 0–200мс
  durationS?: number | null; // длительность теста
  countermovement?: boolean | null; // dip перед тягой
}

export interface TAImtpResult {
  valid: boolean;
  relForce: number | null; // ×BW
  profile: 'strength_deficit' | 'explosive_deficit' | 'balanced' | 'unknown';
  verdict: string;
  warnings: string[];
}

/** Ориентиры полевых норм (не диагноз): относительная сила и RFD. */
export const IMTP_REL_FORCE_MIN = 2.5; // ×BW — ниже = дефицит базы
export const IMTP_RFD_MIN = 6000; // Н/с — ниже = дефицит взрывности

export function diagnoseTAImtp(input: TAImtpInput): TAImtpResult | null {
  const pf = input.peakForceN, bw = input.bodyweightKg;
  if (pf == null && input.rfdNs == null && input.durationS == null && input.countermovement == null) return null;
  const warnings: string[] = [];
  if (input.countermovement === true) {
    warnings.push('Dip перед тягой — тест невалиден: только статическая тяга 3–5с, без пружины (Science for Sport).');
  }
  const dur = input.durationS;
  if (dur != null && Number.isFinite(dur) && dur > 0) {
    if (dur < 1) warnings.push('Тест короче 1с — повтори 3–5с (валиден и 1-с протокол, но нужен пик).');
    else if (dur > 5) warnings.push('Тест длиннее 5с — утомление занижает пик, держи 3–5с.');
  }
  let relForce: number | null = null;
  if (pf != null && bw != null && Number.isFinite(pf) && Number.isFinite(bw) && pf > 0 && bw > 0) {
    relForce = Math.round((pf / (bw * 9.81)) * 100) / 100;
  }
  const rfd = input.rfdNs != null && Number.isFinite(input.rfdNs) && input.rfdNs > 0 ? input.rfdNs : null;
  let profile: TAImtpResult['profile'] = 'unknown';
  let verdict = 'Недостаточно данных для профиля — введи пик силы и вес.';
  if (input.countermovement === true) {
    verdict = 'Тест невалиден (dip) — повтори строго статически.';
  } else if (relForce != null && relForce < IMTP_REL_FORCE_MIN) {
    profile = 'strength_deficit';
    verdict = `Относительная сила ${relForce}×BW < ${IMTP_REL_FORCE_MIN} — приоритет база (тяги/приседы), ISPP к ≥85% IMTP.`;
  } else if (relForce != null && rfd != null && rfd < IMTP_RFD_MIN) {
    profile = 'explosive_deficit';
    verdict = `Сила есть (${relForce}×BW), RFD ${rfd} Н/с < ${IMTP_RFD_MIN} — приоритет взрыв (вис/прыжки/плио).`;
  } else if (relForce != null) {
    profile = 'balanced';
    verdict = `Профиль сбалансирован (${relForce}×BW${rfd != null ? `, RFD ${rfd}` : ''}) — работа по фазам.`;
  }
  return { valid: input.countermovement !== true, relForce, profile, verdict, warnings };
}
