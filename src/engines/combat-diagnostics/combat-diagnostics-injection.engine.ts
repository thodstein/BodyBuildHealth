/**
 * combat-diagnostics-injection.engine.ts — P7 мост хаб→план.
 * REUSE контракта kind:'weakpoints' БЕЗ правок shared planner-bridge:
 * едут только существующие поля (groups, diagnosticWeakSide, barPath,
 * combatNeckLevel/combatAsymmetry/combatSparringCap + specBlock как unknown).
 * Сборка планировщика не меняется; приёмник CombatConstructor уже читает
 * weakpoints/combat_cycle. Снапшот/откат — по ключам he_combat_plan_v1/prev.
 */
import type { WeakpointsPayload } from '../../ui/screens/TrainingScreen_parts/planner-bridge';

export const COMBAT_PLAN_KEY = 'he_combat_plan_v1';
export const COMBAT_PLAN_PREV_KEY = 'he_combat_plan_prev_v1';
export const COMBAT_HUB_KEY = 'he_combat_diagnostics_hub_v1';

export interface CombatBridgeInput {
  weakestStrike: string | null;
  weakestTakedown: string | null;
  weakSide: 'left' | 'right' | null;
  barPath: { xLoop: number; yMax: number; type: string; text: string } | null;
  neckLevel: number | null;
  score: number;
  specDayMap: Record<string, number[]>;
  blocked: boolean;
}

export function buildCombatBridgeData(inp: CombatBridgeInput): WeakpointsPayload {
  const groups: string[] = [];
  if (inp.weakestStrike) groups.push(`strike:${inp.weakestStrike}`);
  if (inp.weakestTakedown) groups.push(`takedown:${inp.weakestTakedown}`);
  return {
    groups,
    diagnosticWeakSide: inp.weakSide,
    barPath: inp.barPath,
    combatNeckLevel: inp.neckLevel,
    combatAsymmetry: inp.weakSide,
    combatSparringCap: inp.blocked ? 0 : null,
    specBlock: { weeks: 6, focus: groups, dayMap: inp.specDayMap, rationale: `combat-diag: скор ${inp.score}` },
  };
}

export interface CombatPlanSnapshot {
  plan: string | null;
  savedAt: number;
}

export function snapshotCombatPlan(
  read: (k: string) => string | null,
  write: (k: string, v: string) => void,
): boolean {
  const cur = read(COMBAT_PLAN_KEY);
  if (cur == null) return false;
  write(COMBAT_PLAN_PREV_KEY, JSON.stringify({ plan: cur, savedAt: Date.now() } satisfies CombatPlanSnapshot));
  return true;
}

export function rollbackCombatPlan(
  read: (k: string) => string | null,
  write: (k: string, v: string) => void,
): boolean {
  const raw = read(COMBAT_PLAN_PREV_KEY);
  if (!raw) return false;
  try {
    const snap = JSON.parse(raw) as CombatPlanSnapshot;
    if (typeof snap.plan !== 'string') return false;
    write(COMBAT_PLAN_KEY, snap.plan);
    return true;
  } catch {
    return false;
  }
}
