/**
 * rir-table.ts — ЕДИНСТВЕННЫЙ источник таблицы %1RM по RIR.
 * Используется всеми генераторами программ (manual-plan-builder, bb-builder, phase-periodization).
 *
 * Значения аппроксимированы для hypertrophic-диапазона 6-15 повторений
 * (Helms E., "RIR vs %1RM for Hypertrophy", 2017; Zourdos M., "RIR Accuracy in Powerlifters", 2019).
 *
 * RIR 0 = 100% workMax (полный отказ)
 * RIR 1 =  96% workMax
 * RIR 2 =  92% workMax
 * RIR 3 =  88% workMax
 * RIR 4 =  84% workMax
 * RIR 5 =  80% workMax
 *
 * Волна-2.2 (аудит 2026-09): те же числа — ОДНОЙ формулой; `PCT_FOR_RIR` —
 * legacy-алиас, производный от `pctForRir` (0 расхождений по определению).
 */
export function pctForRir(rir: number): number {
  const r = Math.max(0, Math.min(5, Math.round(Number(rir) || 0)));
  return Math.max(0.8, 1.0 - r * 0.04);
}

export const PCT_FOR_RIR: Record<number, number> = Object.freeze(
  [0, 1, 2, 3, 4, 5].reduce<Record<number, number>>((acc, r) => {
    acc[r] = pctForRir(r);
    return acc;
  }, {}),
);

/**
 * S-MRV: Системный бюджет утомления на день.
 * Умножается на dailyCap (max упражнений/день) и readiness/PED-модификаторы.
 * dailyCap = max(10, min(16, 8 + groupsInDay × 2))
 * S-MRV = dailyCap × S_MRV_FACTOR × (readiness/100) × pedMultiplier
 *
 * Источник: Israetel M., "Training Volume Landmarks", RP Strength, 2021.
 */
export const S_MRV_FACTOR = 12;
