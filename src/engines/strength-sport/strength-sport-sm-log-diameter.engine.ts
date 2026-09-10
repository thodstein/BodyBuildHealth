/**
 * strength-sport-sm-log-diameter.engine.ts — ДИАМЕТР ЛОГА В РАСЧЁТЕ (SM PRO P1)
 *
 * Renals et al. 2018 (JSCR): пуш-пресс с малым логом дал +6% мощность, +2% скорость,
 * +5% импульс, +3% сила vs большой лог; штанга выше лога по всем фазам (пропульсивная
 * сила штанги ×4.4 vs большой лог). Winwood 2014: у лога глубже 2-я тяга и вертикальнее
 * стойка vs штанга. Вывод для хаба: диаметр — не декор, а масштаб попыток и VBT-зон.
 * Шкала: малый ≤26 см ×1.03 / стандарт 27–30 см ×1.00 / большой ≥31 см ×0.97 (попытки);
 * скорость: ×1.02 / ×1.00 / ×0.98. Опоры полевые, помечены как ориентиры.
 *
 * Чистый движок, без UI/storage.
 */

export type LogDiameterClass = 'small' | 'standard' | 'large';

export const LOG_DIAMETER_BANDS = { smallMaxCm: 26, largeMinCm: 31 };

export const LOG_DIAMETER_LABEL: Record<LogDiameterClass, string> = {
  small: 'Малый (≤26 см)',
  standard: 'Стандарт (27–30 см)',
  large: 'Большой (≥31 см)',
};

/** Масштаб попыток относительно стандарта (Renals: малый выше большого). */
export const LOG_DIAMETER_ATTEMPT_MULT: Record<LogDiameterClass, number> = {
  small: 1.03,
  standard: 1.0,
  large: 0.97,
};

/** Масштаб VBT-порогов (малый лог быстрее большого). */
export const LOG_DIAMETER_VELOCITY_MULT: Record<LogDiameterClass, number> = {
  small: 1.02,
  standard: 1.0,
  large: 0.98,
};

export function logDiameterClass(diameterCm: number | null | undefined): LogDiameterClass | null {
  if (diameterCm == null || !Number.isFinite(diameterCm) || diameterCm <= 0) return null;
  if (diameterCm <= LOG_DIAMETER_BANDS.smallMaxCm) return 'small';
  if (diameterCm >= LOG_DIAMETER_BANDS.largeMinCm) return 'large';
  return 'standard';
}

/** Масштаб попытки лога под диаметр (null без диаметра — честно, без выдумок). */
export function scaleLogAttempt(attemptKg: number, diameterCm: number | null | undefined): number | null {
  const cls = logDiameterClass(diameterCm);
  if (cls == null || !Number.isFinite(attemptKg) || attemptKg <= 0) return null;
  return Math.round(attemptKg * LOG_DIAMETER_ATTEMPT_MULT[cls] * 2) / 2;
}

/** Масштаб VBT-порога лога под диаметр. */
export function scaleLogVbtThreshold(threshold: number, diameterCm: number | null | undefined): number | null {
  const cls = logDiameterClass(diameterCm);
  if (cls == null || !Number.isFinite(threshold) || threshold <= 0) return null;
  return Math.round(threshold * LOG_DIAMETER_VELOCITY_MULT[cls] * 100) / 100;
}

export function logDiameterNote(diameterCm: number | null | undefined): string | null {
  const cls = logDiameterClass(diameterCm);
  if (cls == null) return null;
  const m = LOG_DIAMETER_ATTEMPT_MULT[cls];
  return `Диаметр ${diameterCm} см (${LOG_DIAMETER_LABEL[cls]}): попытки ×${m} (Renals 2018)`;
}
