/**
 * strength-sport-storage.ts — сохранение планов ТА/стронг (изолированно).
 */
import type { StrengthSportPlan } from './strength-sport.types';

const KEY = 'he_strength_sport_plan_v1';
const LIST_KEY = 'he_strength_sport_plans_v1';

export function saveStrengthSportPlan(plan: StrengthSportPlan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
    const list: StrengthSportPlan[] = loadStrengthSportPlans();
    const idx = list.findIndex(p => p.id === plan.id);
    if (idx >= 0) list[idx] = plan;
    else list.unshift(plan);
    localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export function loadStrengthSportPlan(): StrengthSportPlan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StrengthSportPlan;
  } catch { return null; }
}

export function loadStrengthSportPlans(): StrengthSportPlan[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function removeStrengthSportPlan(id: string): void {
  try {
    const list = loadStrengthSportPlans().filter(p => p.id !== id);
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
    const cur = loadStrengthSportPlan();
    if (cur?.id === id) localStorage.removeItem(KEY);
  } catch {}
}
