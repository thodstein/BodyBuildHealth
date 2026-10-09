const DB_NAME = 'HealthEngineDB_v3';
const DB_VERSION = 7;

export const STORES = ['users',
  'profile', 'readiness_log', 'risk_log', 'fertility_log', 'settings',
  'labs_log', 'diagnostics_log', 'phase_schedule', 'diary', 'articles',
  'gamification', 'marketplace_cart', 'food_diary', 'sync_queue',
  'course_log', 'doctor_notes', 'progress_photos', 'injuries_log',
  'training_log', 'workout_log', 'food_cache',
  'cardio_sessions'
] as const;

type StoreNames = typeof STORES[number] | string;

/**
 * Открытие БД на живых телефонах. Прежний код режал старт одним окном в 5с
 * и мгновенно отказывал на `blocked`. Обе ситуации реальны на старых
 * Android/WebView (Android 9–10, Huawei без Google-сервисов):
 * - апгрейд схемы (23 хранилища + индексы) на холодном старте спокойно
 *   занимает больше 5 секунд → было «Ошибка инициализации базы данных»;
 * - WebView держит зомби-соединение от прошлого процесса → `blocked`
 *   намертво, хотя соединение вот-вот освободится само.
 * Теперь это ретраи с растущим бюджетом, а `blocked` просто ждёт.
 */
const DB_INIT_MAX_ATTEMPTS = 3;
const DB_INIT_ATTEMPT_TIMEOUT_MS = 8000;

/** Последняя ошибка инициализации — для честной диагностики на экране. */
let lastInitError: string | null = null;
let lastInitAttempts = 0;
let dbReady = false;

export function dbInitDiagnostics(): { ok: boolean; attempts: number; error: string | null } {
  return { ok: dbReady, attempts: lastInitAttempts, error: lastInitError };
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.name + ': ' + (e.message || '(без текста)');
  if (e && typeof e === 'object') {
    const anyE = e as { name?: unknown; message?: unknown };
    const name = typeof anyE.name === 'string' ? anyE.name : 'Error';
    const msg = typeof anyE.message === 'string' ? anyE.message : '';
    return name + (msg ? ': ' + msg : '');
  }
  return String(e ?? 'unknown');
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

const INDEXES: Record<string, { name: string; keyPath: string }[]> = {
  labs_log: [
    { name: 'date', keyPath: 'date' },
    { name: 'code', keyPath: 'code' },
    { name: 'phase', keyPath: 'phase' },
  ],
  readiness_log: [{ name: 'date', keyPath: 'date' }],
  risk_log: [{ name: 'date', keyPath: 'date' }],
  diary: [{ name: 'date', keyPath: 'date' }],
  food_diary: [{ name: 'date', keyPath: 'date' }],
  sync_queue: [
    { name: 'status', keyPath: 'status' },
    { name: 'timestamp', keyPath: 'timestamp' },
  ],
  phase_schedule: [{ name: 'date', keyPath: 'date' }],
  users: [
    { name: 'email', keyPath: 'email' },
    { name: 'role', keyPath: 'role' },
  ],
  fertility_log: [{ name: 'date', keyPath: 'date' }],
  diagnostics_log: [{ name: 'date', keyPath: 'date' }],
  gamification: [{ name: 'date', keyPath: 'date' }],
  training_log: [{ name: 'date', keyPath: 'date' }, { name: 'exerciseId', keyPath: 'exerciseId' }],
  workout_log: [{ name: 'date', keyPath: 'date' }],
  cardio_sessions: [{ name: 'date', keyPath: 'date' }],
};

class HealthDB {
  private db: IDBDatabase | null = null;

  async init() {
    lastInitAttempts = 0;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= DB_INIT_MAX_ATTEMPTS; attempt++) {
      lastInitAttempts = attempt;
      try {
        await this.openOnce(attempt);
        dbReady = true;
        lastInitError = null;
        return;
      } catch (e) {
        lastErr = e;
        lastInitError = describeError(e);
        try {
          this.db?.close();
        } catch {
          /* ignore */
        }
        this.db = null;
        if (attempt < DB_INIT_MAX_ATTEMPTS) await delay(400 * attempt);
      }
    }
    dbReady = false;
    throw lastErr instanceof Error ? lastErr : new Error(lastInitError || 'IndexedDB init failed');
  }

  /** Одна попытка открытия. Бюджет одинаковый: повтор нужен из-за blocked/ошибки, а не из-за медленного старта. */
  private openOnce(attempt: number): Promise<void> {
    const budget = DB_INIT_ATTEMPT_TIMEOUT_MS;
    return new Promise<void>((res, rej) => {
      let r: IDBOpenDBRequest;
      try {
        r = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        rej(e);
        return;
      }
      let settled = false;
      const done = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };
      const timer = setTimeout(
        () => done(() => rej(new Error(`IndexedDB init timeout (попытка ${attempt}/${DB_INIT_MAX_ATTEMPTS})`))),
        budget,
      );
      const finish = (fn: () => void) => {
        clearTimeout(timer);
        done(fn);
      };
      r.onupgradeneeded = e => {
        const d = (e.target as IDBOpenDBRequest).result;
        STORES.forEach(s => {
          let store: IDBObjectStore;
          if (!d.objectStoreNames.contains(s)) {
            store = d.createObjectStore(s, { keyPath: 'id' });
          } else {
            store = (e.target as IDBOpenDBRequest).transaction!.objectStore(s);
          }
          const indexes = INDEXES[s];
          if (indexes) {
            indexes.forEach(idx => {
              if (!store.indexNames.contains(idx.name)) {
                store.createIndex(idx.name, idx.keyPath);
              }
            });
          }
        });
      };
      r.onsuccess = () => {
        this.db = r.result;
        finish(() => res());
      };
      r.onerror = () => finish(() => rej(r.error || new Error('IndexedDB open error')));
      // blocked НЕ отклоняем: чужое соединение освободится само (частая
      // история на Huawei — WebView держит соединение после перезапуска
      // процесса). Если не освободится — отработает бюджет попытки.
      r.onblocked = () => {
        /* ждём освобождения соединения */
      };
    });
  }

  async put(store: StoreNames, data: any) {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async get<T>(store: StoreNames, id: string): Promise<T | undefined> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<T | undefined>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const r = tx.objectStore(store).get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async getAll<T>(store: StoreNames): Promise<T[]> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<T[]>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const r = tx.objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async delete(store: StoreNames, id: string) {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async getByIndex<K>(store: StoreNames, indexName: string, value: IDBValidKey): Promise<K[]> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<K[]>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const idx = tx.objectStore(store).index(indexName);
      const r = idx.getAll(value);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async getByDateRange<K>(store: StoreNames, startDate: string, endDate: string): Promise<K[]> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<K[]>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const idx = tx.objectStore(store).index('date');
      const range = IDBKeyRange.bound(startDate, endDate);
      const r = idx.getAll(range);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async clear(store: StoreNames): Promise<void> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async count(store: StoreNames): Promise<number> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<number>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const r = tx.objectStore(store).count();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async update<K extends { id: string }>(store: StoreNames, data: Partial<K> & { id: string }): Promise<void> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const getReq = os.get(data.id);
      getReq.onsuccess = () => {
        const existing = getReq.result || {};
        os.put({ ...existing, ...data });
      };
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
}

export const db = new HealthDB();
export type { StoreNames };