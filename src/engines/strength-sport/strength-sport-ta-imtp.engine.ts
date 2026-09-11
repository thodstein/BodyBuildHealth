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
  /** V4: пик первой тяги IFP/IPSP (Н) — сила с пола (Lum 2025; Rochau 2024). */
  ifpPeakN?: number | null;
  /** V4: импульс 0–200мс (Н·с) — переносимая между девайсами метрика (Wang 2025). */
  impulseNs?: number | null;
}

export interface TAImtpResult {
  valid: boolean;
  relForce: number | null; // ×BW
  profile: 'strength_deficit' | 'explosive_deficit' | 'balanced' | 'unknown';
  verdict: string;
  warnings: string[];
  /** W2: RFD в серой зоне девайса (±25% от порога) — профиль не строится по RFD. */
  rfdGray: boolean;
  /** V4: отношение IFP/IMTP (~0.5–0.55 норма; ниже = слабо с пола). */
  ifpRatio: number | null;
  /** V4: импульс как переносимая метрика (есть/нет). */
  hasImpulse: boolean;
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
  // V4: первая тяга + импульс (не ломают профиль, только дополняют вердикт)
  let ifpRatio: number | null = null;
  const ifp = input.ifpPeakN;
  if (ifp != null && Number.isFinite(ifp) && ifp > 0 && pf != null && Number.isFinite(pf) && pf > 0) {
    ifpRatio = Math.round((ifp / pf) * 100) / 100;
    if (ifpRatio < 0.45) {
      warnings.push(`IFP/IMTP ${ifpRatio} <0.45 — слабо с пола: дефицит/паузы у пола, первая тяга (Lum 2025; Rochau 2024; норма ≈0.50–0.58 по Rochau/Joffe).`);
    } else {
      warnings.push(`IFP/IMTP ${ifpRatio} — сила с пола в норме (≈0.50–0.58, Rochau 2024; Joffe).`);
    }
  }
  const hasImpulse = input.impulseNs != null && Number.isFinite(input.impulseNs) && input.impulseNs > 0;
  if (hasImpulse && rfdGray) {
    warnings.push('RFD в серой зоне — опирайся на импульс 0–200мс: он переносим между девайсами (Wang 2025).');
  }
  return { valid: input.countermovement !== true, relForce, profile, verdict, warnings, rfdGray, ifpRatio, hasImpulse };
}

/**
 * V7 PRO-v4: выносливость силы 10×5с/10с (Grover 2024, PeerJ).
 * Дроп среднего пика последних 3 к первым 3: >15% = лимитирует.
 */
export function imtpEnduranceDrop(first3: Array<number | null | undefined>, last3: Array<number | null | undefined>): { dropPct: number; limited: boolean; text: string } | null {
  const f = (Array.isArray(first3) ? first3 : []).filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  const l = (Array.isArray(last3) ? last3 : []).filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (f.length < 2 || l.length < 2) return null;
  const mf = f.reduce((a, b) => a + b, 0) / f.length;
  const ml = l.reduce((a, b) => a + b, 0) / l.length;
  if (!(mf > 0)) return null;
  const dropPct = Math.round(((mf - ml) / mf) * 1000) / 10;
  const limited = dropPct > 15;
  return { dropPct, limited, text: limited ? `Дроп силы ${dropPct}% >15% — выносливость силы лимитирует (10×5с/10с, Grover 2024)` : `Дроп силы ${dropPct}% — выносливость силы в норме` };
}

/**
 * V4-добой-2 (П5): нормы импульса 0–200мс, Н·с (Bustamante et al. 2024,
 * чилийские high-performance, n=77: Ж IMP200 199.48±46.74; М 280.89±52.26).
 * Коридор mean±SD; ниже −SD = «ниже ориентира», выше +SD = «выше».
 * Скрининг-ориентир, не диагноз (выборка одна, не ТА-специфична).
 */
export const IMPULSE200_NORMS: Record<'male' | 'female', { mean: number; sd: number }> = {
  male: { mean: 280.89, sd: 52.26 },
  female: { mean: 199.48, sd: 46.74 },
};

export function impulseVerdict(impulseNs: number | null | undefined, sex?: string | null): string | null {
  if (impulseNs == null || !Number.isFinite(impulseNs) || impulseNs <= 0) return null;
  const s = String(sex || '').toLowerCase() === 'female' ? 'female' : 'male';
  const { mean, sd } = IMPULSE200_NORMS[s];
  const lo = Math.round((mean - sd) * 10) / 10;
  const hi = Math.round((mean + sd) * 10) / 10;
  if (impulseNs < lo) return `Импульс ${impulseNs} Н·с ниже ориентира ${s === 'female' ? 'Ж' : 'М'} ${lo}–${hi} (Bustamante 2024): взрывное усилие — вис/прыжки`;
  if (impulseNs > hi) return `Импульс ${impulseNs} Н·с выше ориентира ${s === 'female' ? 'Ж' : 'М'} ${lo}–${hi} — отлично`;
  return `Импульс ${impulseNs} Н·с в ориентире ${lo}–${hi} (Bustamante 2024)`;
}
