/**
 * combat-weight-cut.engine.ts — весогонка ISSN 2025 (stub P1.1 → full P2.3)
 * Полный протокол — в фазе 2.3. Сейчас минимальный тип для сборки.
 */
export interface WeightCutProtocol {
  targetLossKg: number;
  weeksOut: number;
  waterMode?: 'stable' | 'load_cut';
  sodiumMode?: 'stable' | 'moderate_cut';
  carbMode?: 'stable' | 'deplete_reload';
}
export function buildWeightCutProtocol(lossKg: number): WeightCutProtocol | null {
  if (!lossKg || lossKg <= 0) return null;
  return { targetLossKg: lossKg, weeksOut: 8, waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable' };
}
