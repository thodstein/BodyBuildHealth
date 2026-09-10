/**
 * strength-sport-ta-imtp.engine.ts — IMTP/RFD ПРОФИЛЬ ТА (E13 PRO-v2, W2 PRO-v3)
 *
 * Пик силы + RFD + длительность + countermovement-guard → профиль
 * «база силы / взрыв / сбалансирован». Источники: Stone 25+ лет (IMTP зеркалит
 * 2-ю тягу), Meloq 2025 (1-с протокол валиден), Science for Sport
 * (dip перед тягой инвалидирует тест — только статика).
 * W2 (PRO-v3): PF-first — пик силы надёжен (Pichardo 2024: CV 4.6–8.3%,
 * ICC 0.94–0.98), RFD между девайсами несопоставим (Wang 2025) → серая зона
 * RFD ±25% не даёт explosive_deficit, только warning; трансфер IMTP→взятие
 * сильнее, чем→рывок (Arauz 2025: взятие force-доминантно).
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
  /** W2: RFD в серой зоне девайса (±25% от порога) — профиль не строится по RFD. */
  rfdGray: boolean;
}

/** Ориентиры полевых норм (не диагноз): относительная сила и RFD. */
export const IMTP_REL_FORCE_MIN = 2.5; // ×BW — ниже = дефицит базы
export const IMTP_RFD_MIN = 6000; // Н/с — ниже = дефицит взрывности
/** W2: серая зона RFD — ниже 0.75× порога считаем дефицитом, внутри — только warning. */
export const IMTP_RFD_GRAY_MULT = 0.75;
export const IMTP_RFD_DEFICIT = IMTP_RFD_MIN * IMTP_RFD_GRAY_MULT; // 4500

/** W2: чек-лист протокола IMTP (Comfort 2019; Keogh; Grover; Wang 2025). */
export const IMTP_PROTOCOL_CHECKLIST: string[] = [
  'Колено 130–140°, корпус upright',
  'Cue «тяни сильно и быстро», 3–5с',
  '3 пробы + знакомизация',
  'Без dip/пружины (инвалидирует)',
  'Тот же девайс для динамики (RFD между девайсами несопоставим)',
];

/** W2: трансфер — IMTP ближе ко взятию, чем к рывку (Arauz 2025). */
export const IMTP_CLEAN_TRANSFER_NOTE = 'IMTP→взятие сильнее, чем→рывок: взятие force-доминантно (Arauz 2025).';

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
  // W2: PF-first — RFD в серой зоне (±25%) не даёт explosive_deficit, только warning
  const rfdGray = rfd != null && rfd >= IMTP_RFD_DEFICIT && rfd < IMTP_RFD_MIN;
  if (rfdGray) {
    warnings.push(`RFD ${rfd} Н/с в серой зоне девайса (±25% от ${IMTP_RFD_MIN}): повтори на том же девайсе, вывод по пику силы (Pichardo 2024; Wang 2025).`);
  }
  let profile: TAImtpResult['profile'] = 'unknown';
  let verdict = 'Недостаточно данных для профиля — введи пик силы и вес.';
  if (input.countermovement === true) {
    verdict = 'Тест невалиден (dip) — повтори строго статически.';
  } else if (relForce != null && relForce < IMTP_REL_FORCE_MIN) {
    profile = 'strength_deficit';
    verdict = `Относительная сила ${relForce}×BW < ${IMTP_REL_FORCE_MIN} — приоритет база (тяги/приседы), ISPP к ≥85% IMTP.`;
  } else if (relForce != null && rfd != null && rfd < IMTP_RFD_DEFICIT) {
    profile = 'explosive_deficit';
    verdict = `Сила есть (${relForce}×BW), RFD ${rfd} Н/с < ${IMTP_RFD_DEFICIT} — приоритет взрыв (вис/прыжки/плио).`;
  } else if (relForce != null) {
    profile = 'balanced';
    verdict = `Профиль сбалансирован (${relForce}×BW${rfd != null ? `, RFD ${rfd}` : ''}) — работа по фазам.`;
  }
  return { valid: input.countermovement !== true, relForce, profile, verdict, warnings, rfdGray };
}
