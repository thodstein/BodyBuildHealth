/**
 * note-media-store.ts — IndexedDB-хранилище вложений заметок (фото/аудио).
 *
 * Зачем отдельно от `coach-notes.engine`: заметки живут в localStorage, а один
 * снимок в base64 (до 2–4 МБ) выжигает квоту и роняет ВСЕ заметки сразу.
 * Поэтому в заметке — только метаданные (`CoachNote.attachments`), а байты тут.
 *
 * База одна на устройство, без суффикса пространства: заметки в приложении —
 * ключ уровня устройства (`he_coach_notes` не префиксуется под атлета), значит
 * и вложение, привязанное к заметке, не должно теряться при переключении
 * атлета. Удаление пространства/базы атлета эти файлы не трогает — иначе
 * заметка осталась бы с битой ссылкой.
 *
 * В тестовом окружении (нет indexedDB) — in-memory Map, как в weight-photo-store.
 */

export const NOTE_MEDIA_DB_NAME = 'he_note_media_db';
const STORE_NAME = 'media';
const DB_VERSION = 1;

export interface NoteMediaRecord {
  id: string;
  noteId: string;
  kind: 'photo' | 'audio';
  mime: string;
  /** Размер в байтах (для фото — уже сжатого dataUrl). */
  size: number;
  durationMs?: number;
  name?: string;
  createdAt: number;
  /** Фото: сжатый dataUrl. */
  dataUrl?: string;
  /** Аудио: исходный blob (объект-URL делает UI и сам же отзывает). */
  blob?: Blob;
}

const isTestEnv = () =>
  (typeof process !== 'undefined' && process.env?.VITEST === 'true') ||
  typeof indexedDB === 'undefined' ||
  typeof window === 'undefined';

/** In-memory fallback: тесты и среды без IndexedDB. */
const memory = new Map<string, NoteMediaRecord>();

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(NOTE_MEDIA_DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise = promise;
  promise.catch(() => {
    dbPromise = null; // неудачное открытие не запоминаем навсегда
  });
  return promise;
}

/** Записать одно вложение. false — места нет / запись не удалась (UI скажет). */
export async function saveNoteMedia(record: NoteMediaRecord): Promise<boolean> {
  if (!record || !record.id) return false;
  if (isTestEnv()) {
    memory.set(record.id, record);
    return true;
  }
  try {
    const db = await openDB();
    return await new Promise<boolean>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Записать пачку вложений одной транзакцией: отчёт о неудаче — общий. */
export async function saveNoteMediaMany(records: NoteMediaRecord[]): Promise<boolean> {
  const list = Array.isArray(records) ? records.filter(r => r && r.id) : [];
  if (!list.length) return true;
  if (isTestEnv()) {
    for (const r of list) memory.set(r.id, r);
    return true;
  }
  try {
    const db = await openDB();
    return await new Promise<boolean>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const r of list) store.put(r);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Одно вложение. null — файла нет (удалён/другая установка). */
export async function getNoteMedia(id: string): Promise<NoteMediaRecord | null> {
  if (!id) return null;
  if (isTestEnv()) return memory.get(id) ?? null;
  try {
    const db = await openDB();
    return await new Promise<NoteMediaRecord | null>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        const row = req.result;
        resolve(row && typeof row === 'object' ? (row as NoteMediaRecord) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Все вложения. null — хранилище не читается (это «нельзя проверить», не «пусто»). */
export async function listNoteMedia(): Promise<NoteMediaRecord[] | null> {
  if (isTestEnv()) return [...memory.values()];
  try {
    const db = await openDB();
    return await new Promise<NoteMediaRecord[] | null>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        resolve(rows.filter((r): r is NoteMediaRecord => !!r && typeof r === 'object' && typeof r.id === 'string'));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Удалить вложения по id (при удалении заметки/вложения). */
export async function deleteNoteMedia(ids: ReadonlyArray<string>): Promise<void> {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return;
  if (isTestEnv()) {
    for (const id of list) memory.delete(id);
    return;
  }
  try {
    const db = await openDB();
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const id of list) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* ignore: файл всё равно останется сиротой — его подберёт cleanup */
  }
}

/** Удалить все вложения заметки. */
export async function deleteNoteMediaForNote(noteId: string): Promise<void> {
  if (!noteId) return;
  const all = await listNoteMedia();
  if (!all) return;
  await deleteNoteMedia(all.filter(r => r.noteId === noteId).map(r => r.id));
}

/** Стереть все вложения сразу: «забыть всех атлетов» стирает и заметки. */
export async function deleteAllNoteMedia(): Promise<void> {
  if (isTestEnv()) {
    memory.clear();
    return;
  }
  try {
    const db = await openDB();
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* ignore: следующий mount вычистит сирот */
  }
}

/**
 * Убрать файлы, на которые не ссылается ни одна заметка. Нужен после сбоя
 * сохранения/импорта: иначе квота тихо съедается мусором.
 */
export async function cleanupNoteMedia(keepIds: ReadonlySet<string>): Promise<number> {
  const all = await listNoteMedia();
  if (!all) return 0;
  const orphans = all.filter(r => !keepIds.has(r.id)).map(r => r.id);
  if (orphans.length) await deleteNoteMedia(orphans);
  return orphans.length;
}

/** Суммарный размер вложений в байтах (для «сколько занимают заметки»). */
export async function noteMediaTotalBytes(): Promise<number> {
  const all = await listNoteMedia();
  if (!all) return 0;
  return all.reduce((sum, r) => sum + (Number.isFinite(r.size) && r.size > 0 ? r.size : 0), 0);
}

export async function closeNoteMediaDb(): Promise<void> {
  const promise = dbPromise;
  dbPromise = null;
  if (!promise) return;
  try {
    const database = await promise;
    database.close();
  } catch {
    /* соединения и не было */
  }
}

/**
 * Синхронно снести базу вложений: вызывается из «сбросить всё» (там нельзя
 * ждать). Заметки при этом тоже стираются, поэтому сирот не остаётся.
 */
export function deleteNoteMediaDatabaseSync(): void {
  try {
    dbPromise = null;
    memory.clear();
    if (typeof indexedDB === 'undefined') return;
    indexedDB.deleteDatabase(NOTE_MEDIA_DB_NAME);
  } catch {
    /* ignore */
  }
}

/** Только для тестов: чистое in-memory состояние между кейсами. */
export function __resetNoteMediaForTests(): void {
  memory.clear();
  dbPromise = null;
}
