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
 * Байты (2026-11):
 *  • фото и аудио лежат одинаково — сырыми байтами (`bytes`), а не base64-строкой:
 *    dataUrl в IndexedDB это +33 % объёма и лишняя мегабайтная JS-строка в памяти;
 *  • при сохранении байты шифруются AES-GCM ключом устройства (`enc: 'aes-gcm'`),
 *    ключ — в localStorage (`he_note_media_key_v1`), 32 байта, non-extractable
 *    CryptoKey в памяти. Честная граница: это защита от ПРОСТОЙ выгрузки базы
 *    IndexedDB (дампы, копирование каталога), но не от root/forensics — ключ
 *    лежит рядом, на этом же устройстве. Если WebCrypto нет — пишем открыто;
 *  • легаси-записи (dataUrl-строка у фото, открытый Blob у аудио) читаются как
 *    есть и переписываются в новый вид при следующем сохранении.
 *
 * В тестовом окружении (нет indexedDB) — in-memory Map, как в weight-photo-store.
 */

export const NOTE_MEDIA_DB_NAME = 'he_note_media_db';
/** Ключ шифрования байтов. Префикс `he_` — значит попадает в резервную копию. */
export const NOTE_MEDIA_KEY_STORAGE = 'he_note_media_key_v1';
const STORE_NAME = 'media';
const DB_VERSION = 1;

export interface NoteMediaRecord {
  id: string;
  noteId: string;
  kind: 'photo' | 'audio';
  mime: string;
  /** Размер в байтах (сжатого) файла — по нему считаем занятое место. */
  size: number;
  durationMs?: number;
  name?: string;
  createdAt: number;
  /** Байты файла. Если `enc` задан — это шифротекст. */
  bytes?: ArrayBuffer;
  /** 'aes-gcm' — байты зашифрованы ключом устройства. */
  enc?: 'aes-gcm';
  /** Вектор инициализации для `enc`. */
  iv?: Uint8Array<ArrayBuffer>;
  /** Легаси: фото dataUrl-строкой (до перехода на байты). */
  dataUrl?: string;
  /** Легаси: аудио открытым Blob-ом. */
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

/* ── base64 <-> байты (без мегабайтных строк в одном вызове) ──────────── */

const B64_CHUNK = 0x8000;

export function bytesToBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK));
  }
  try {
    return btoa(binary);
  } catch {
    return '';
  }
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const clean = String(b64 ?? '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

export async function blobToBase64(blob: Blob | null): Promise<string> {
  if (!blob) return '';
  const bytes = await readBlobBytes(blob);
  return bytes ? bytesToBase64(bytes) : '';
}

/* ── Шифрование байтов ключом устройства ─────────────────────────────── */

const HEX_RE = /^[0-9a-f]{64}$/i;

const subtleCrypto = (): SubtleCrypto | null => {
  try {
    const c = typeof crypto !== 'undefined' ? (crypto as Crypto) : null;
    return c && c.subtle ? c.subtle : null;
  } catch {
    return null;
  }
};

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function randomKeyHex(): string {
  const bytes = new Uint8Array(32);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

let cachedKey: { hex: string; key: CryptoKey } | null = null;

function readKeyHex(): string {
  try {
    return localStorage.getItem(NOTE_MEDIA_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function writeKeyHex(hex: string): void {
  try {
    localStorage.setItem(NOTE_MEDIA_KEY_STORAGE, hex);
  } catch {
    /* квота/приватный режим: ключ проживёт только в памяти */
  }
}

/**
 * Ключ шифрования байтов: один на устройство, лениво. null — WebCrypto нет.
 *
 * Ключ каждый раз сверяем с localStorage: восстановление копии подменяет
 * `he_note_media_key_v1`, и закэшированный старый ключ расшифровывал бы новые
 * файлы «не тем» ключом — данные стали бы нечитаемыми после перезапуска.
 */
export function noteMediaKey(): Promise<CryptoKey | null> {
  const subtle = subtleCrypto();
  if (!subtle) return Promise.resolve(null);
  let hex = readKeyHex();
  if (!HEX_RE.test(hex)) {
    hex = randomKeyHex();
    writeKeyHex(hex);
  }
  if (cachedKey && cachedKey.hex === hex) return Promise.resolve(cachedKey.key);
  return (async () => {
    try {
      const key = await subtle.importKey('raw', hexToBytes(hex), { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
      ]);
      cachedKey = { hex, key };
      return key;
    } catch {
      return null;
    }
  })();
}

async function sealRecord(record: NoteMediaRecord): Promise<NoteMediaRecord> {
  if (!record.bytes || record.enc) return record;
  const key = await noteMediaKey();
  const subtle = subtleCrypto();
  if (!key || !subtle) return record;
  try {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, key, record.bytes);
    return { ...record, bytes: cipher, iv, enc: 'aes-gcm' };
  } catch {
    return record; // шифрование не удалось — файл важнее секретности
  }
}

async function openBytes(record: NoteMediaRecord): Promise<ArrayBuffer | null> {
  if (record.bytes) {
    if (record.enc !== 'aes-gcm') return record.bytes;
    const key = await noteMediaKey();
    const subtle = subtleCrypto();
    if (!key || !subtle || !record.iv) return null;
    try {
      return await subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.bytes);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Байты Blob-а. В Android WebView `Blob.arrayBuffer` встречается без реализации
 * (та же беда, что в ocr-engine), поэтому есть путь через FileReader.
 */
async function readBlobBytes(blob: Blob): Promise<ArrayBuffer | null> {
  try {
    if (typeof blob.arrayBuffer === 'function') return await blob.arrayBuffer();
  } catch {
    /* ниже FileReader */
  }
  if (typeof FileReader === 'undefined') return null;
  return new Promise<ArrayBuffer | null>(resolve => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(blob);
    } catch {
      resolve(null);
    }
  });
}

/** Байты легаси-записи (dataUrl/Blob) — чтобы хранить всё одинаково. */
async function legacyBytes(record: NoteMediaRecord): Promise<ArrayBuffer | null> {
  if (record.blob) {
    const bytes = await readBlobBytes(record.blob);
    if (bytes) return bytes;
  }
  if (record.dataUrl) {
    const bytes = base64ToBytes(record.dataUrl);
    return bytes.length ? bytes.buffer : null;
  }
  return null;
}

/** Байты файла как есть (расшифрованные). null — файла нет/не читается. */
export async function noteMediaBytes(record: NoteMediaRecord | null): Promise<ArrayBuffer | null> {
  if (!record) return null;
  const opened = await openBytes(record);
  if (opened) return opened;
  return legacyBytes(record);
}

/**
 * Файл вложения как Blob — единственный путь для UI (фото, аудио, шаринг).
 * null — байтов нет: запись битая либо файл удалён.
 */
export async function noteMediaPayload(record: NoteMediaRecord | null): Promise<Blob | null> {
  if (!record) return null;
  const bytes = await noteMediaBytes(record);
  if (!bytes || bytes.byteLength === 0) return null;
  try {
    return new Blob([bytes], { type: record.mime || 'application/octet-stream' });
  } catch {
    return null;
  }
}

/** Записать одно вложение. false — места нет / запись не удалась (UI скажет). */
export async function saveNoteMedia(record: NoteMediaRecord): Promise<boolean> {
  if (!record || !record.id) return false;
  const normalized = await sealRecord(await normalizeRecord(record));
  if (isTestEnv()) {
    memory.set(normalized.id, normalized);
    return true;
  }
  try {
    const db = await openDB();
    return await new Promise<boolean>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(normalized);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Единый вид записи: байты вместо blob/dataUrl, лишние легаси-поля снимаем. */
async function normalizeRecord(record: NoteMediaRecord): Promise<NoteMediaRecord> {
  if (record.bytes) {
    const { dataUrl: _d, blob: _b, ...rest } = record;
    return rest;
  }
  const bytes = await legacyBytes(record);
  if (!bytes) return record;
  const { dataUrl: _d, blob: _b, ...rest } = record;
  return { ...rest, bytes };
}

/** Записать пачку вложений одной транзакцией: отчёт о неудаче — общий. */
export async function saveNoteMediaMany(records: NoteMediaRecord[]): Promise<boolean> {
  const list = Array.isArray(records) ? records.filter(r => r && r.id) : [];
  if (!list.length) return true;
  const sealed: NoteMediaRecord[] = [];
  for (const r of list) sealed.push(await sealRecord(await normalizeRecord(r)));
  if (isTestEnv()) {
    for (const r of sealed) memory.set(r.id, r);
    return true;
  }
  try {
    const db = await openDB();
    return await new Promise<boolean>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const r of sealed) store.put(r);
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

/** Только для тестов: чистое состояние между кейсами. */
export function __resetNoteMediaForTests(): void {
  memory.clear();
  dbPromise = null;
  cachedKey = null;
}
