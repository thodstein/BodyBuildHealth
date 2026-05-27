const DB_NAME = 'HealthEngineDB_v2';
const DB_VERSION = 2; // Увеличена версия для миграции sync_queue
const STORES: string[] = [
  'profile', 'readiness_log', 'risk_log', 'fertility_log', 'settings',
  'labs_log', 'diagnostics_log', 'phase_schedule', 'diary', 'articles',
  'gamification', 'marketplace_cart', 'food_diary', 'sync_queue'
];

class HealthDB {
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = e => {
        const d = (e.target as IDBOpenDBRequest).result;
        STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  }

  async put(store: string, data: any) {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async get<T>(store: string, id: string): Promise<T | undefined> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<T | undefined>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const r = tx.objectStore(store).get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async getAll<T>(store: string): Promise<T[]> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<T[]>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const r = tx.objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async delete(store: string, id: string) {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
}

export const db = new HealthDB();