/**
 * pl-backup.engine.ts — бэкап/восстановление PL-сессии (Фаза 6, п.8).
 *
 * Зачем: всё PL-авто живёт только в localStorage (сессия, макро-настройки,
 * рантайм тапера, факты попыток, сохранённые планы). Очистка данных браузера
 * или «сброс» в системе стирает сезон — без возможности вернуть.
 *
 * Правила безопасности:
 *  • восстанавливаем ТОЛЬКО ключи белого списка — бэкап не может перезаписать
 *    произвольный ключ приложения;
 *  • значения — только строки, с лимитом размера (localStorage ~5 МБ общий);
 *  • версия формата проверяется; чужая/битая структура → честная ошибка, без
 *    частичной записи;
 *  • ничего не пишем молча: возвращаем список восстановленного/пропущенного.
 */

export const PL_BACKUP_VERSION = 1;
export const PL_BACKUP_KIND = 'pl-backup';

/** Ключи PL-сессии, которые имеет смысл переносить. */
export const PL_BACKUP_KEYS = [
  'he_pl_session',
  'he_pl_macro',
  'he_pl_runtime',
  'he_pl_meet_log',
  'myTrainingPlans',
  'he_opl_history',
] as const;

export type PLBackupKey = typeof PL_BACKUP_KEYS[number];

/** Лимит одного значения (1.5 МБ) — как у персиста тапер-плана. */
export const PL_BACKUP_VALUE_MAX_CHARS = 1_500_000;

export interface PLBackup {
  app: 'bodybuildhealth';
  kind: typeof PL_BACKUP_KIND;
  version: number;
  /** ISO-время создания (локальное время устройства). */
  createdAt: string;
  /** Ключ → JSON-строка значения. */
  keys: Partial<Record<PLBackupKey, string>>;
}

type ReadStorage = { getItem: (key: string) => string | null };
type WriteStorage = { setItem: (key: string, value: string) => void };

/** Собрать бэкап из хранилища. null — если PL-данных нет вовсе. */
export function collectPLBackup(storage: ReadStorage, now: () => string = () => new Date().toISOString()): PLBackup | null {
  const keys: Partial<Record<PLBackupKey, string>> = {};
  for (const key of PL_BACKUP_KEYS) {
    let value: string | null = null;
    try { value = storage.getItem(key); } catch { value = null; }
    if (typeof value !== 'string' || value.length === 0) continue;
    if (value.length > PL_BACKUP_VALUE_MAX_CHARS) continue; // слишком большой — не рискуем квотой
    keys[key] = value;
  }
  if (Object.keys(keys).length === 0) return null;
  return { app: 'bodybuildhealth', kind: PL_BACKUP_KIND, version: PL_BACKUP_VERSION, createdAt: now(), keys };
}

export interface PLBackupParseResult {
  backup: PLBackup | null;
  error: string | null;
}

/** Разбор вставленного JSON: проверяем формат, версию и типы значений. */
export function parsePLBackup(text: string): PLBackupParseResult {
  if (!text || !text.trim()) return { backup: null, error: 'Пустой бэкап.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { backup: null, error: 'Это не JSON — проверьте, что скопировали файл бэкапа целиком.' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { backup: null, error: 'Неверная структура бэкапа.' };
  const obj = raw as Partial<PLBackup>;
  if (obj.app !== 'bodybuildhealth' || obj.kind !== PL_BACKUP_KIND) {
    return { backup: null, error: 'Это не бэкап PL-сессии (другой тип файла).' };
  }
  if (obj.version !== PL_BACKUP_VERSION) {
    return { backup: null, error: `Версия бэкапа ${String(obj.version)} не поддерживается (нужна ${PL_BACKUP_VERSION}).` };
  }
  if (!obj.keys || typeof obj.keys !== 'object' || Array.isArray(obj.keys)) {
    return { backup: null, error: 'В бэкапе нет данных (поле keys).' };
  }
  const keys: Partial<Record<PLBackupKey, string>> = {};
  for (const [key, value] of Object.entries(obj.keys)) {
    if (!(PL_BACKUP_KEYS as readonly string[]).includes(key)) continue; // чужие ключи не восстанавливаем
    if (typeof value !== 'string' || value.length === 0) continue;
    if (value.length > PL_BACKUP_VALUE_MAX_CHARS) continue;
    JSON.parse(JSON.stringify(value)); // гарантия, что значение сериализуемо как есть
    keys[key as PLBackupKey] = value;
  }
  if (Object.keys(keys).length === 0) return { backup: null, error: 'В бэкапе нет ни одного известного ключа PL-сессии.' };
  return {
    backup: {
      app: 'bodybuildhealth',
      kind: PL_BACKUP_KIND,
      version: PL_BACKUP_VERSION,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : '',
      keys,
    },
    error: null,
  };
}

export interface PLBackupRestoreResult {
  restored: string[];
  skipped: string[];
  error: string | null;
}

/** Записать значения из бэкапа (только белый список ключей). */
export function restorePLBackup(backup: PLBackup, storage: WriteStorage): PLBackupRestoreResult {
  const restored: string[] = [];
  const skipped: string[] = [];
  let error: string | null = null;
  for (const [key, value] of Object.entries(backup.keys)) {
    if (!(PL_BACKUP_KEYS as readonly string[]).includes(key) || typeof value !== 'string') {
      skipped.push(key);
      continue;
    }
    try {
      storage.setItem(key, value);
      restored.push(key);
    } catch {
      skipped.push(key);
      error = 'Не хватило места в localStorage — часть данных не восстановлена.';
    }
  }
  return { restored, skipped, error };
}

/** Человекочитаемый список ключей для UI. */
export const PL_BACKUP_KEY_LABEL: Record<PLBackupKey, string> = {
  he_pl_session: 'PL-сессия (план, тапер, настройки)',
  he_pl_macro: 'Макро-цикл',
  he_pl_runtime: 'Рантайм тапера',
  he_pl_meet_log: 'Факты попыток старта',
  myTrainingPlans: 'Сохранённые планы',
  he_opl_history: 'История OpenPowerlifting',
};
