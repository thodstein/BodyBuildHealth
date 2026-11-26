/**
 * rir-honesty.ts — одно правило чтения RIR записанного подхода.
 *
 * В дневнике ноль в поле `rir` означает две разные вещи:
 *  - измеренный отказ (`rir: 0`, RPE 10) — подход действительно был до отказа;
 *  - заполнитель старых сборок, где RIR не вводили (и тогда RIR 0 — не факт).
 *
 * Метка `rirMissing` появилась позже, поэтому старые записи её не несут. Отличить
 * заполнитель от отказа можно по измеренному RPE: в приложении RIR и RPE связаны
 * (`RIR = 10 − RPE`), значит `RIR 0` = `RPE 10`. Если же записан RPE 8 при RIR 0,
 * это несовместимая пара — RIR был заполнителем, а измерен именно RPE, и честный
 * RIR равен 2, а не «до отказа».
 */

export interface LoggedRirSet {
  rir?: unknown;
  rpe?: unknown;
  rirMissing?: unknown;
}

const clampRir = (value: number): number => Math.min(10, Math.max(0, value));

/**
 * Измеренный RIR подхода или `null`, если оценку не вводили.
 *
 * - `rirMissing === true` → `null` («RIR —», а не «RIR 0»);
 * - `rir > 0` → как записан (явное значение сильнее пересчёта);
 * - `rir === 0` при измеренном RPE → `10 − RPE` (при RPE 10 это ноль — отказ);
 * - `rir` нет/0 и RPE нет → `null` (заполнитель, а не отказ).
 */
export function measuredSetRir(set: LoggedRirSet | null | undefined): number | null {
  if (!set || set.rirMissing === true) return null;
  const rirRaw = set.rir == null || set.rir === '' ? NaN : Number(set.rir);
  const rpeRaw = set.rpe == null || set.rpe === '' ? NaN : Number(set.rpe);
  // RPE вне 0..10 — мусор из старого бэкапа/импорта, а не измерение: иначе
  // `rpe: 12` зажимался в 10 и подходам приписывался настоящий отказ.
  const rpe = Number.isFinite(rpeRaw) && rpeRaw > 0 && rpeRaw <= 10 ? rpeRaw : 0;
  if (Number.isFinite(rirRaw) && rirRaw > 0) return clampRir(rirRaw);
  return rpe > 0 ? clampRir(10 - rpe) : null;
}
