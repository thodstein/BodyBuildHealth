/**
 * weight-photo-store.ts — IndexedDB-хранилище фото для WeightDiary.
 * Избавляет localStorage от base64-раздувания (фото до 2Мб каждое, до 5 шт/запись).
 * Ключ записи = дата (ISO). Значение = { photos: string[], updatedAt: number }.
 *
 * База — **своя у каждого пространства данных**: у тренера в одном приложении
 * живут несколько человек. С одной общей базой фото за ту же дату у разных
 * атлетов затирали бы друг друга (ключ — только дата), а «удалить его данные»
 * не убрало бы фото вообще.
 *
 * В тестовом окружении (нет indexedDB) использует in-memory Map.
 */
import { HOME_SPACE_ID, currentSpaceId } from '../core/data-space';

const DB_NAME = 'he_weight_photos_db';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

/** Имя базы фото для пространства: home — без изменений (обновление ничего не переносит). */
export function weightPhotoDbNameFor(spaceId: string): string {
  if (!spaceId || spaceId === HOME_SPACE_ID) return DB_NAME;
  return `${DB_NAME}__${spaceId}`;
}

// Проверка тестового окружения во время выполнения (не при загрузке модуля)
// Vitest устанавливает process.env.VITEST = 'true'
const isTestEnv = () =>
  typeof process !== 'undefined' && process.env?.VITEST === 'true' ||
  typeof indexedDB === 'undefined' ||
  typeof window === 'undefined';

// In-memory fallback для тестов
export const memoryStore = new Map<string, { photos: string[]; updatedAt: number }>();

/** Открытые соединения по пространствам: при удалении базы их нужно закрыть. */
const dbPromises = new Map<string, Promise<IDBDatabase>>();

function openDB(): Promise<IDBDatabase> {
  if (isTestEnv()) return Promise.resolve({} as IDBDatabase);
  const spaceId = currentSpaceId();
  const cached = dbPromises.get(spaceId);
  if (cached) return cached;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(weightPhotoDbNameFor(spaceId), DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'date' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromises.set(spaceId, promise);
  // Неудачное открытие не должно запоминаться навсегда.
  promise.catch(() => dbPromises.delete(spaceId));
  return promise;
}

/**
 * Закрыть соединение с базой фото пространства (нужно перед её удалением —
 * иначе `deleteDatabase` ждёт, пока базу отпустят, и фото остаются на диске).
 */
export async function closeWeightPhotoDb(spaceId: string): Promise<void> {
  const promise = dbPromises.get(spaceId);
  dbPromises.delete(spaceId);
  if (!promise) return;
  try {
    const database = await promise;
    database.close();
  } catch {
    /* соединения и не было */
  }
}

/** Сохранить фото для даты (перезаписывает). */
export async function saveWeightPhotos(date: string, photos: string[]): Promise<void> {
  console.log('[weight-photo-store] saveWeightPhotos called, isTestEnv:', isTestEnv());
  if (isTestEnv()) {
    console.log('[weight-photo-store] Using memory store');
    memoryStore.set(date, { photos, updatedAt: Date.now() });
    return Promise.resolve();
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ date, photos, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Получить фото для даты. */
export async function getWeightPhotos(date: string): Promise<string[] | undefined> {
  if (isTestEnv()) {
    return memoryStore.get(date)?.photos;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(date);
    req.onsuccess = () => resolve(req.result?.photos);
    req.onerror = () => reject(req.error);
  });
}

/** Удалить фото для даты. */
export async function deleteWeightPhotos(date: string): Promise<void> {
  if (isTestEnv()) {
    memoryStore.delete(date);
    return Promise.resolve();
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(date);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Очистить ВСЕ фото. */
export async function clearAllWeightPhotos(): Promise<void> {
  if (isTestEnv()) {
    memoryStore.clear();
    return Promise.resolve();
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Получить общий размер фото в байтах (для мониторинга квоты). */
export async function getWeightPhotosTotalSize(): Promise<number> {
  if (isTestEnv()) {
    let total = 0;
    for (const item of memoryStore.values()) {
      if (item.photos) {
        for (const p of item.photos) total += p.length * 0.75;
      }
    }
    return total;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      let total = 0;
      for (const item of req.result) {
        if (item.photos) {
          for (const p of item.photos) total += p.length * 0.75;
        }
      }
      resolve(total);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Миграция фото из localStorage weight log в IndexedDB. Запускать 1 раз при загрузке. */
export async function migrateWeightPhotosFromLocalStorage(): Promise<void> {
  try {
    const raw = localStorage.getItem('he_weight_log');
    if (!raw) return;
    const log = JSON.parse(raw);
    if (!Array.isArray(log)) return;
    for (const entry of log) {
      if (entry.date && entry.photos && entry.photos.length > 0) {
        await saveWeightPhotos(entry.date, entry.photos);
      }
    }
    // После успешной миграции можно очистить фото из localStorage (опционально)
    // Но лучше оставить для обратной совместимости — saveWeightLog сам очистит при следующем сохранении
  } catch {
    // silent — миграция не критична
  }
}

/** Очистка фото старее указанной даты (для авто-квоты). */
export async function cleanupOldWeightPhotos(keepDates: Set<string>): Promise<number> {
  if (isTestEnv()) {
    let deleted = 0;
    for (const key of memoryStore.keys()) {
      if (!keepDates.has(key)) {
        memoryStore.delete(key);
        deleted++;
      }
    }
    return deleted;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      let deleted = 0;
      for (const key of req.result) {
        if (!keepDates.has(key as string)) {
          store.delete(key);
          deleted++;
        }
      }
      tx.oncomplete = () => resolve(deleted);
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}