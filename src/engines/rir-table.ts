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
 */
export const PCT_FOR_RIR: Record<number, number> = { 0: 1.0, 1: 0.96, 2: 0.92, 3: 0.88, 4: 0.84, 5: 0.80 };

/**
 * S-MRV: Системный бюджет утомления на день.
 * Умножается на dailyCap (max упражнений/день) и readiness/PED-модификаторы.
 * dailyCap = max(10, min(16, 8 + groupsInDay × 2))
 * S-MRV = dailyCap × S_MRV_FACTOR × (readiness/100) × pedMultiplier
 *
 * Источник: Israetel M., "Training Volume Landmarks", RP Strength, 2021.
 */
export const S_MRV_FACTOR = 12;
