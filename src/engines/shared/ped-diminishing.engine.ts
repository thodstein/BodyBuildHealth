/**
 * ped-diminishing.engine.ts — единый PED diminishing (shared).
 * 2+ PED → 0.85, weight_cut → 0.70, как в bb/combat/strength.
 * Изоляция сохранена — только чистые множители.
 */
export function applyPedDiminishing(mult: number, count: number, isWeightCut: boolean): number {
  let v = mult;
  if (count >= 2) v = 1 + (v - 1) * 0.85;
  if (isWeightCut) v = 1 + (v - 1) * 0.70;
  return v;
}

export function pedCount(flags: boolean[]): number {
  return flags.filter(Boolean).length;
}
