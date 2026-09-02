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

function migrateCombatPlan(raw: any): CombatPlan {
  if (!raw || typeof raw !== 'object') return raw;
  // v1→v2: normDiscipline
  const discMap: Record<string,string> = { boxing:'boxing', 'бокс':'boxing', mma:'mma', 'мма':'mma', wrestling:'wrestling', 'борьба':'wrestling', kickboxing:'kickboxing', 'кик':'kickboxing', general:'general' };
  if (typeof raw.discipline === 'string') {
    const low = raw.discipline.toLowerCase();
    if (discMap[low]) raw.discipline = discMap[low];
  }
  // phase remap: gpp→accumulation для ATR (для linear gpp валиден). Для старых без модели — считаем ATR по умолчанию.
  const model = raw.inputSnapshot?.periodizationModel || raw.periodizationModel;
  if (Array.isArray(raw.weeksData)) {
    for(const w of raw.weeksData) {
      if (w.phase === 'gpp' && (!model || model === 'atr_10' || model === 'atr')) w.phase = 'accumulation';
    }
  }
  // ensure conditioning field exists (null for old)
  if (!('conditioning' in raw)) raw.conditioning = null;
  // ensure inputSnapshot new fields defaults (v3)
  if (raw.inputSnapshot) {
    if (!('periodizationModel' in raw.inputSnapshot)) raw.inputSnapshot.periodizationModel = 'atr_10';
    if (!('conditioningMode' in raw.inputSnapshot)) raw.inputSnapshot.conditioningMode = 'auto';
    if (!('fightStyle' in raw.inputSnapshot)) raw.inputSnapshot.fightStyle = 'hybrid';
    if (!('weighInType' in raw.inputSnapshot) && raw.inputSnapshot.weightCutProtocol) {
      raw.inputSnapshot.weightCutProtocol.weighInType = raw.inputSnapshot.weightCutProtocol.weighInType || 'day_before_24h';
    }
    if (raw.inputSnapshot.weightCutProtocol) {
      if (!('fiberGPerDay' in raw.inputSnapshot.weightCutProtocol)) raw.inputSnapshot.weightCutProtocol.fiberGPerDay = 10;
      if (!('orsSodiumMmolPerDl' in raw.inputSnapshot.weightCutProtocol)) raw.inputSnapshot.weightCutProtocol.orsSodiumMmolPerDl = 65;
      if (!('confirmedManipulation' in raw.inputSnapshot.weightCutProtocol)) raw.inputSnapshot.weightCutProtocol.confirmedManipulation = false;
    }
    if (!('sparringLoad' in raw.inputSnapshot)) raw.inputSnapshot.sparringLoad = null;
  }
  // tag version
  const v = Number(raw.version) || 1;
  if (v < 2) raw.version = 2;
  if (v < 3) raw.version = 3;
  if (!raw.version) raw.version = 3;
  return raw as CombatPlan;
}

export function loadCombatPlan(): CombatPlan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrateCombatPlan(parsed);
  } catch { return null; }
}

export function loadCombatPlans(): CombatPlan[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    const list = Array.isArray(arr) ? arr : [];
    return list.map(migrateCombatPlan);
  } catch { return []; }
}

export function migrateAllCombatStorage(): void {
  try {
    const cur = loadCombatPlan();
    if (cur) localStorage.setItem(KEY, JSON.stringify(cur));
    const list = loadCombatPlans();
    if (list.length) localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0,20)));
  } catch {}
}

export function removeCombatPlan(id: string): void {
  try {
    const list = loadCombatPlans().filter(p => p.id !== id);
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
    const cur = loadCombatPlan();
    if (cur?.id === id) localStorage.removeItem(KEY);
  } catch {}
}
