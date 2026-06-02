const DB_KEY_SALT = 'health-engine-v2-salt';
const DB_KEY_ITERATIONS = 100000;

let cachedKey: CryptoKey | null = null;

async function deriveKey(password: string): Promise<CryptoKey> {
   const enc = new TextEncoder();
   const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
   
   // Get or create persistent salt
   let saltBase64 = localStorage.getItem(DB_KEY_SALT);
   let salt: Uint8Array;
   if (saltBase64) {
     salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
   } else {
     salt = new Uint8Array(16);
      crypto.getRandomValues(salt as unknown as Uint8Array<ArrayBuffer>);
     saltBase64 = btoa(String.fromCharCode(...salt));
     localStorage.setItem(DB_KEY_SALT, saltBase64);
   }
   
   return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt as any, iterations: DB_KEY_ITERATIONS, hash: 'SHA-256' } as any,
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
 }

export async function initEncryption(password: string): Promise<boolean> {
  if (!window.crypto?.subtle) return false;
  cachedKey = await deriveKey(password);
  return true;
}

async function encryptData(data: any): Promise<string> {
  if (!cachedKey) return JSON.stringify(data);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encoded = enc.encode(JSON.stringify(data));
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, cachedKey, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv); combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(base64: string): Promise<any> {
  if (!cachedKey) return JSON.parse(base64);
  const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, cachedKey, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function securePut(db: any, store: string, data: any): Promise<void> {
  const encrypted = await encryptData(data);
  await db.put(store, { id: data.id, payload: encrypted, _encrypted: true });
}

export async function secureGet<T>(db: any, store: string, id: string): Promise<T | undefined> {
  const raw = await db.get(store, id);
  if (!raw) return undefined;
  if (raw._encrypted) return decryptData(raw.payload) as Promise<T>;
  return raw as T;
}

export async function secureGetAll<T>(db: any, store: string): Promise<T[]> {
  const items = await db.getAll(store);
  const decrypted: T[] = [];
  for (const item of items) {
    decrypted.push(item._encrypted ? await decryptData(item.payload) : item);
  }
  return decrypted;
}