/**
 * combat-storage.ts — сохранение планов единоборств (изолированно).
 */
import type { CombatPlan } from './combat.types';

const KEY = 'he_combat_plan_v1';
const LIST_KEY = 'he_combat_plans_v1';

export function saveCombatPlan(plan: CombatPlan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
    const list: CombatPlan[] = loadCombatPlans();
    const idx = list.findIndex(p => p.id === plan.id);
    if (idx >= 0) list[idx] = plan;
    else list.unshift(plan);
    localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export function loadCombatPlan(): CombatPlan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CombatPlan;
  } catch { return null; }
}

export function loadCombatPlans(): CombatPlan[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function removeCombatPlan(id: string): void {
  try {
    const list = loadCombatPlans().filter(p => p.id !== id);
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
    const cur = loadCombatPlan();
    if (cur?.id === id) localStorage.removeItem(KEY);
  } catch {}
}
