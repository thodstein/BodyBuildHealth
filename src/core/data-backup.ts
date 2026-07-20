import { db, STORES } from './db';

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
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith('he_')) local[k] = localStorage.getItem(k) || '';
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
  const keep = new Set(['he_profile_v2', 'he_session_v2']);
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith('he_') && !keep.has(k)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}
