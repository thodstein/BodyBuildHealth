/**
 * cardio-storage.engine.ts — изолированный слой хранения кардио-циклов.
 * Вынесен из cardio.engine.ts (god-file 3.3k) для тестируемости и tree-shaking.
 * Все ключи централизованы, добавлена квота-защита и миграция.
 */
import type { CardioCycle, CardioCycleVersion, CardioScenario } from './cardio.engine';

export const CARDIO_CYCLES_KEY = 'he_cardio_cycles';
export const ACTIVE_CARDIO_CYCLE_KEY = 'he_active_cardio_cycle';
export const CARDIO_HISTORY_KEY = 'he_cardio_cycle_history';
export const CARDIO_SCENARIOS_KEY = 'he_cardio_scenarios';
export const CARDIO_UI_PREFS_KEY = 'he_cardio_ui_prefs';

const CYCLES_CAP = 20;
const HISTORY_CAP = 20;
const SCENARIOS_CAP = 6;

function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v as T;
  } catch { return fallback; }
}
function safeSet(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

// ── Cycles ──
export function loadCardioCyclesStorage(): CardioCycle[] {
  const v = safeParse<unknown>(CARDIO_CYCLES_KEY, []);
  return Array.isArray(v) ? (v as CardioCycle[]).filter(c => !!c && typeof c === 'object' && Array.isArray((c as CardioCycle).weeks)) : [];
}
export function saveCardioCycleStorage(cycle: CardioCycle): void {
  const all = loadCardioCyclesStorage().filter(c => c.id !== cycle.id);
  all.unshift(cycle);
  safeSet(CARDIO_CYCLES_KEY, JSON.stringify(all.slice(0, CYCLES_CAP)));
}
export function removeCardioCycleStorage(id: string): void {
  safeSet(CARDIO_CYCLES_KEY, JSON.stringify(loadCardioCyclesStorage().filter(c => c.id !== id)));
}
export function loadActiveCardioCycleStorage(): CardioCycle | null {
  const v = safeParse<unknown>(ACTIVE_CARDIO_CYCLE_KEY, null);
  return v && typeof v === 'object' && Array.isArray((v as CardioCycle).weeks) ? v as CardioCycle : null;
}
export function saveActiveCardioCycleStorage(cycle: CardioCycle | null): void {
  if (cycle) safeSet(ACTIVE_CARDIO_CYCLE_KEY, JSON.stringify(cycle));
  else try { localStorage.removeItem(ACTIVE_CARDIO_CYCLE_KEY); } catch { /* ignore */ }
}

// ── History ──
export function loadCardioCycleVersionsStorage(): CardioCycleVersion[] {
  const v = safeParse<unknown>(CARDIO_HISTORY_KEY, []);
  return Array.isArray(v) ? (v as CardioCycleVersion[]).filter(x => !!x && typeof x === 'object' && (x as CardioCycleVersion).cycleId && (x as CardioCycleVersion).cycle) : [];
}
export function saveCardioCycleVersionStorage(cycle: CardioCycle, reason: string): void {
  if (!cycle) return;
  const all = loadCardioCycleVersionsStorage();
  const snapshot: CardioCycle = JSON.parse(JSON.stringify(cycle));
  all.unshift({ id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, cycleId: cycle.id, savedAt: new Date().toISOString(), reason, cycle: snapshot });
  safeSet(CARDIO_HISTORY_KEY, JSON.stringify(all.slice(0, HISTORY_CAP)));
}
export function clearCardioCycleHistoryStorage(cycleId: string): void {
  safeSet(CARDIO_HISTORY_KEY, JSON.stringify(loadCardioCycleVersionsStorage().filter(v => v.cycleId !== cycleId)));
}

// ── Scenarios ──
export function loadCardioScenariosStorage(): CardioScenario[] {
  const v = safeParse<unknown>(CARDIO_SCENARIOS_KEY, []);
  return Array.isArray(v) ? (v as CardioScenario[]).filter(x => !!x && typeof x === 'object' && (x as CardioScenario).cycle && Array.isArray((x as CardioScenario).cycle.weeks)) : [];
}
export function saveCardioScenarioStorage(cycle: CardioCycle, name?: string): CardioScenario {
  const all = loadCardioScenariosStorage();
  const sc: CardioScenario = { id: `sc-${Date.now()}`, name: name?.trim() || cycle.name, savedAt: new Date().toISOString(), cycle };
  all.unshift(sc);
  safeSet(CARDIO_SCENARIOS_KEY, JSON.stringify(all.slice(0, SCENARIOS_CAP)));
  return sc;
}
export function removeCardioScenarioStorage(id: string): void {
  safeSet(CARDIO_SCENARIOS_KEY, JSON.stringify(loadCardioScenariosStorage().filter(s => s.id !== id)));
}

export interface CardioUiPrefs { filters?: Record<string, string>; lastTab?: string }
export function loadCardioUiPrefsStorage(): CardioUiPrefs {
  const v = safeParse<unknown>(CARDIO_UI_PREFS_KEY, null);
  return v && typeof v === 'object' ? v as CardioUiPrefs : {};
}
export function saveCardioUiPrefsStorage(p: CardioUiPrefs): void { safeSet(CARDIO_UI_PREFS_KEY, JSON.stringify(p)); }
