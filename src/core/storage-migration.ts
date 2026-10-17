/**
 * storage-migration.ts — безопасные миграции ключей localStorage.
 * Запускается один раз на старте (bootstrap), в try/catch: любая ошибка
 * не должна ронять приложение. Идемпотентна: версия хранится в
 * `he_storage_migration_version`.
 */

const MIGRATION_VERSION = 1;
const VERSION_KEY = 'he_storage_migration_version';

function safeGet(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function runStorageMigrations(): void {
  try {
    const raw = safeGet(VERSION_KEY);
    const current = raw ? Number(raw) || 0 : 0;
    if (current >= MIGRATION_VERSION) return;

    // v1: перенос legacy-ключа дневника тренировок (если есть) в v2-ключ.
    // Только если v2 пуст — чтобы не затереть свежие данные.
    try {
      const legacy = safeGet('he_workout_log');
      const modern = safeGet('he_workout_log_v2');
      if (legacy && !modern) {
        safeSet('he_workout_log_v2', legacy);
      }
    } catch { /* ignore */ }

    // v1: перенос legacy-ключа живой сессии (если есть).
    try {
      const legacy = safeGet('he_workout_active');
      const modern = safeGet('he_workout_active_v1');
      if (legacy && !modern) {
        safeSet('he_workout_active_v1', legacy);
      }
    } catch { /* ignore */ }

    safeSet(VERSION_KEY, String(MIGRATION_VERSION));
  } catch {
    /* миграции не критичны — приложение продолжает работу */
  }
}
