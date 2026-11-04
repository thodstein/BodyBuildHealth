import { db, STORES, deleteSpaceDatabases } from './db';
import {
  DATA_SPACE_KEY,
  DEVICE_SALT_KEY,
  HOME_SPACE_ID,
  _resetDataSpaceCache,
  deviceRawOrFallback,
  parseRegistry,
  rawKeys,
} from './data-space';

/** Сырое хранилище: бэкап и полная очистка обязаны видеть все пространства. */
function rawLs() {
  return deviceRawOrFallback(localStorage as unknown as Parameters<typeof deviceRawOrFallback>[0]);
}

export const BACKUP_VERSION = '1.0';

export interface AppBackup {
  app: 'health-engine';
  version: string;
  createdAt: string; // ISO timestamp
  stores: Record<string, any[]>;
  localStorage: Record<string, string>;
}

export async function collectBackup(): Promise<AppBackup> {
  await db.init();
  const stores: Record<string, any[]> = {};
  for (const s of STORES) {
    try {
      stores[s] = await db.getAll(s);
    } catch {
      stores[s] = [];
    }
  }
  const local: Record<string, string> = {};
  // Перечисляем СЫРЫЕ ключи: бэкап должен унести все пространства (атлетов),
  // а не только то, в котором сейчас открыто приложение. Ключи атлетов уже
  // физические (`he_ath_…__…`), поэтому восстановление кладёт их на место.
  const raw = rawLs();
  for (const k of rawKeys(raw)) {
    // Соль шифрования IndexedDB не начинается с `he_`, но без неё после
    // восстановления часть записей не расшифруется (secureDB упадёт в plaintext).
    if (!k.startsWith('he_') && k !== DEVICE_SALT_KEY) continue;
    try {
      local[k] = raw.getItem(k) || '';
    } catch {
      /* один сбойный ключ не должен срывать весь бэкап */
    }
  }
  return {
    app: 'health-engine',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    stores,
    localStorage: local,
  };
}

export function exportToJSON(b: AppBackup): string {
  return JSON.stringify(b, null, 2);
}

export function parseBackup(text: string): AppBackup {
  const b = JSON.parse(text);
  if (b?.app !== 'health-engine') {
    throw new Error('Неизвестный файл бэкапа');
  }
  return b as AppBackup;
}

// Client-only cascade:
// 1) navigator.share with File (Android TMA → system sheet; iOS 17+ often works)
// 2) clipboard copy (reliable in TMA; user pastes to Saved Messages)
// 3) browser <a download> (only works OUTSIDE TMA WebView — blocked there)
export async function exportBackup(): Promise<void> {
  const b = await collectBackup();
  const name = `health-engine-backup-${b.createdAt.slice(0, 10)}.json`;
  const text = exportToJSON(b);
  const file = new File([text], name, { type: 'application/json' });
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], title: name });
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fallthrough to browser download */
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Full replace (restore). Caller wraps parseBackup in try/catch.
export async function importBackup(b: AppBackup): Promise<void> {
  await db.init();
  for (const s of STORES) {
    try {
      await db.clear(s);
    } catch {
      /* ignore */
    }
    const recs = b.stores?.[s] || [];
    for (const r of recs) {
      try {
        await db.put(s, r);
      } catch {
        /* ignore bad record */
      }
    }
  }
  for (const k of Object.keys(b.localStorage || {})) {
    localStorage.setItem(k, b.localStorage[k]);
  }
}

// Soft clear: wipe everything EXCEPT he_profile_v2 + he_session_v2
export async function softClear(): Promise<void> {
  await db.init();
  for (const s of STORES) {
    try {
      await db.clear(s);
    } catch {
      /* ignore */
    }
  }
  const raw = rawLs();
  // Пространства атлетов помним ДО зачистки: их базы IndexedDB нужно удалить,
  // иначе «удалил все данные» оставило бы дневники/анализы атлетов на диске.
  const athleteSpaces = parseRegistry(raw.getItem(DATA_SPACE_KEY)).spaces
    .filter(s => s.id !== HOME_SPACE_ID)
    .map(s => s.id);

  const keep = new Set(['he_profile_v2', 'he_session_v2']);
  const toRemove: string[] = [];
  for (const k of rawKeys(raw)) {
    if (!k.startsWith('he_') || keep.has(k)) continue;
    toRemove.push(k);
  }
  for (const k of toRemove) {
    try {
      raw.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  _resetDataSpaceCache();
  await deleteSpaceDatabases(athleteSpaces);
}
