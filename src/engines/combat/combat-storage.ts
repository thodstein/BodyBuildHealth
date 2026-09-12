/**
 * combat-storage.ts — сохранение планов единоборств (изолированно).
 */
import type { CombatPlan } from './combat.types';

const KEY = 'he_combat_plan_v1';
const LIST_KEY = 'he_combat_plans_v1';
// Связанные ключи плана (чистятся вместе с планом по planId)
const PAYLOAD_KEYS = ['he_combat_nutrition_payload', 'he_combat_cardio_payload'];

/** P7: проверка формы плана (битый стор отбраковывается, а не пропускается). id не требуем — legacy без id мигрируется. */
export function isCombatPlanShape(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (!Array.isArray(raw.weeksData) || raw.weeksData.length === 0) return false;
  for (const w of raw.weeksData) {
    if (typeof w?.week !== 'number' || !Array.isArray(w?.sessions)) return false;
  }
  return true;
}

function writeWithQuotaFallback(list: CombatPlan[]): boolean {
  // P7: quota — режем список пополам до успеха (кап 20 → 10 → 5 → 1), честно без молчаливой потери текущего
  let cur = list.slice(0, 20);
  while (cur.length > 0) {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(cur));
      return true;
    } catch {
      if (cur.length <= 1) return false;
      cur = cur.slice(0, Math.max(1, Math.floor(cur.length / 2)));
    }
  }
  return false;
}

export function saveCombatPlan(plan: CombatPlan): void {
  try {
    try {
      localStorage.setItem(KEY, JSON.stringify(plan));
    } catch {
      // текущий план важнее истории: квоту чистим за счёт списка, текущий пишем последним шансом
      try { localStorage.removeItem(LIST_KEY); } catch { /* no-op */ }
      try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch { return; }
    }
    const list: CombatPlan[] = loadCombatPlans();
    const idx = list.findIndex(p => p.id === plan.id);
    if (idx >= 0) list[idx] = plan;
    else list.unshift(plan);
    writeWithQuotaFallback(list);
  } catch { /* честно молчим только при полном провале — план живёт в памяти конструктора */ }
}

function migrateCombatPlan(raw: any): CombatPlan {
  if (!raw || typeof raw !== 'object') return raw;
  // P7: legacy без id — детерминированный id (иначе список/удаление не работает)
  if (typeof raw.id !== 'string' || !raw.id) raw.id = 'cb_legacy_migrated';
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
    // P7: битый weeksData отбраковывается (раньше пропускался как есть)
    if (!isCombatPlanShape(parsed)) return null;
    return migrateCombatPlan(parsed);
  } catch { return null; }
}

export function loadCombatPlans(): CombatPlan[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    const list = Array.isArray(arr) ? arr : [];
    // P7: отбраковка битых записей списка
    return list.filter(isCombatPlanShape).map(migrateCombatPlan);
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
    // P7: чистим связанные payload-ключи этого плана (питание/кардио), чужие планы не трогаем
    for (const k of PAYLOAD_KEYS) {
      try {
        const raw = localStorage.getItem(k);
        if (raw && JSON.parse(raw)?.planId === id) localStorage.removeItem(k);
      } catch { /* no-op */ }
    }
  } catch {}
}
