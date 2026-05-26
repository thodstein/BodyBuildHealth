const DB_NAME = 'HealthEngineDB_v11'; const DB_VERSION = 1;
const STORES = ['profile','readiness_log','risk_log','settings'];
class HealthDB {
  private db: IDBDatabase | null = null;
  async init() { return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = e => { const d=(e.target as IDBOpenDBRequest).result; STORES.forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'});}); };
    r.onsuccess = () => { this.db=r.result; res(); }; r.onerror = () => rej(r.error);
  });}
  async put(store: string, data: any) { if(!this.db) throw new Error('DB not init');
    return new Promise((res,rej)=>{const tx=this.db!.transaction(store,'readwrite'); tx.objectStore(store).put(data); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);});}
}
export const db = new HealthDB();