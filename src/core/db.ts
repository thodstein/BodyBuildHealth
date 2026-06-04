const DB_NAME = 'HealthEngineDB_v3';
const DB_VERSION = 4;

const STORES = ['users',
  'profile', 'readiness_log', 'risk_log', 'fertility_log', 'settings',
  'labs_log', 'diagnostics_log', 'phase_schedule', 'diary', 'articles',
  'gamification', 'marketplace_cart', 'food_diary', 'sync_queue',
  'course_log', 'doctor_notes'
] as const;

type StoreNames = typeof STORES[number] | string;

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
};

class HealthDB {
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
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
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
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