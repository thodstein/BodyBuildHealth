import { DBStoreName } from './types';

const DB_NAME = 'HealthEngineDB';
const DB_VERSION = 2;
const STORES: DBStoreName[] = [
  'profile', 'food_diary', 'lab_results', 'training_log',
  'articles', 'settings', 'gamification', 'calc_cache'
];

class HealthDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        STORES.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  async get<T>(store: DBStoreName, id: string): Promise<T | undefined> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put<T>(store: DBStoreName, data: T): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll<T>(store: DBStoreName): Promise<T[]> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}

export const db = new HealthDB();