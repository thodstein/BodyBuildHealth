/**
 * combat-mesocycle.ts — кросс-мезоцикл для единоборств (изолировано).
 * Сохраняет базу силы, не гонит ПМ.
 */
import type { CombatPlan } from './combat.types';
export function applyCombatMesocycle(prev: CombatPlan | null, nextInput: any): any {
  if (!prev) return nextInput;
  // единоборства: не бампаем веса агрессивно, только +1кг если prev успешен
  return { ...nextInput, previousPlanId: prev.id };
}
