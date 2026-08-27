/**
 * manual-storage.ts — центральный реестр ключей и безопасные обёртки для ручного конструктора.
 * Убирает дублирующие try/catch по 15+ местам, даёт единую точку для миграций и quota-fallback.
 */

export const MANUAL_STORAGE_KEYS = {
  USER_PROGRAMS: 'he_user_programs',
  MACROCYCLE_DESIGNS: 'he_macrocycle_designs',
  BB_MACRO: 'he_bb_macro',
  PL_MACRO: 'he_pl_macro',
  PROGRAM_FAV: 'he_program_fav',
  BB_BOARD_MODE: 'he_bb_board_mode',
  PL_RUNTIME: 'he_pl_runtime',
  ANNUAL_BLOCK_PENDING: 'he_annual_block_pending',
  ANNUAL_TRAINING_PLAN: 'he_annual_training_plan_v1',
  CARDIO_KCAL_NOTE: 'he_cardio_kcal_note',
  EDITOR_STEP: 'he_editor_step',
  MANUAL_MODE: 'he_manual_mode',
  MANUAL_ONBOARDING_DONE: 'he_manual_onboarding_done',
  MANUAL_QUICK_COLLAPSED: 'he_manual_quick_collapsed',
  TRAINING_GOALS: 'he_training_goals',
  HABITS: 'he_habits',
  CHECKIN_LATEST: 'he_checkin_latest',
} as const;

export type ManualStorageKey = typeof MANUAL_STORAGE_KEYS[keyof typeof MANUAL_STORAGE_KEYS];

/** Безопасное чтение JSON из localStorage с fallback. */
export function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Безопасная запись JSON — при QuotaExceeded чистит старые снапшоты программ и пробует снова. */
export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      try {
        // Пытаемся освободить место: урезаем he_user_programs до 20, чистим снапшоты дизайна
        const raw = localStorage.getItem(MANUAL_STORAGE_KEYS.USER_PROGRAMS);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length > 20) {
            localStorage.setItem(MANUAL_STORAGE_KEYS.USER_PROGRAMS, JSON.stringify(arr.slice(0, 20)));
            localStorage.setItem(key, JSON.stringify(value));
            return true;
          }
        }
      } catch { /* ignore */ }
    }
    return false;
  }
}

/** Удалить ключ. */
export function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** Размер занятого storage (для диагностики). */
export function storageBytesFor(keys: string[]): number {
  let total = 0;
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k);
      if (v) total += v.length * 2; // utf16 approx
    } catch { /* ignore */ }
  }
  return total;
}
