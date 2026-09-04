/**
 * strength-sport-sm-storage.engine.ts — ХРАНИЛИЩЕ СТРОНГ-ДИАГНОСТИКИ (SM PRO P2)
 *
 * Единая точка ключей SM-хаба: бэкап/восстановление JSON + quota-safe запись + размер.
 * Чужие ключи (TA/BB/arm/planner) не трогаем. Cloud-kv синк — задача владельца
 * cloud-модуля; здесь — атомарный локальный слой с валидацией формы.
 */

export const SM_STORAGE_KEYS = [
  'he_strongman_diagnostics_hub_v1', // состояние хаба
  'he_lv_sm_v1', // LVP-калибровки SM
  'he_grip_profile_v1', // tri-modal профиль хвата
  'he_sm_progress_hist_v1', // прогресс йок/фермер/лог/лестница
  'he_sm_grip_hist_v1', // снапшоты асимметрии хвата
  'he_sm_ohs_hist_v1', // снапшоты OHS
  'he_sm_annual_sync_v1', // годовой overlay
] as const;

export interface SMBackup {
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

function safeGet(key: string): unknown {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(key);
    if (raw == null) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function safeSet(key: string, value: unknown): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // QuotaExceeded: пробуем освободить только SM-историю (старые снапшоты), затем повтор
    try {
      trimSMHistory();
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

/** Урезать истории до свежих (прогресс 30, grip/ohs 10) — только SM-ключи. */
export function trimSMHistory(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const trim = (key: string, keep: number): void => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > keep) localStorage.setItem(key, JSON.stringify(arr.slice(-keep)));
    };
    trim('he_sm_progress_hist_v1', 30);
    trim('he_sm_grip_hist_v1', 10);
    trim('he_sm_ohs_hist_v1', 10);
  } catch { /* noop */ }
}

/** Собрать бэкап всех SM-ключей (только существующие). */
export function buildSMBackup(): SMBackup {
  const data: Record<string, unknown> = {};
  for (const k of SM_STORAGE_KEYS) {
    const v = safeGet(k);
    if (v !== undefined) data[k] = v;
  }
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

/** Валидация формы бэкапа (без доверия содержимому). */
export function isSMBackupShape(v: unknown): v is SMBackup {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const b = v as { version?: unknown; data?: unknown };
  if (b.version !== 1) return false;
  if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return false;
  return Object.keys(b.data).every((k) => (SM_STORAGE_KEYS as readonly string[]).includes(k));
}

/** Восстановить бэкап (только известные SM-ключи, поштучно quota-safe). */
export function restoreSMBackup(b: SMBackup): { restored: string[]; failed: string[] } {
  const restored: string[] = [];
  const failed: string[] = [];
  if (!isSMBackupShape(b)) return { restored, failed: [...SM_STORAGE_KEYS] };
  for (const [k, v] of Object.entries(b.data)) {
    if (safeSet(k, v)) restored.push(k);
    else failed.push(k);
  }
  return { restored, failed };
}

/** Размер SM-данных в байтах (оценка JSON). */
export function smStorageBytes(): { total: number; byKey: Record<string, number> } {
  const byKey: Record<string, number> = {};
  let total = 0;
  for (const k of SM_STORAGE_KEYS) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
      const n = raw ? raw.length : 0;
      byKey[k] = n;
      total += n;
    } catch {
      byKey[k] = 0;
    }
  }
  return { total, byKey };
}

export function downloadSMBackup(filename = 'sm-diagnostics-backup.json'): void {
  try {
    const blob = new Blob([JSON.stringify(buildSMBackup())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* noop */ }
}
