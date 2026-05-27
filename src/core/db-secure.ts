import { db } from './db';
import { securePut as encrypt, secureGetAll as decryptAll } from './db-encryption';

export const secureDB = {
  async put(store: string, data: any) {
    try { await encrypt(db, store, data); }
    catch (e) { console.warn('⚠️ Encrypt failed, falling back to plaintext:', e); await db.put(store, data); }
  },
  async getAll<T>(store: string): Promise<T[]> {
    try { return await decryptAll<T>(db, store); }
    catch (e) { console.warn('⚠️ Decrypt failed, falling back to plaintext:', e); return await db.getAll(store); }
  }
};