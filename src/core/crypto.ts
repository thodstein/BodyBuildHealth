// ТЗ §23.3: Шифрование чувствительных данных AES-GCM
export class SecureCrypto {
  private static async getKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: encoder.encode('health-engine-salt'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  static async encrypt(data: string, password: string): Promise<string> {
    const key = await this.getKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const buffer = new Uint8Array(iv.byteLength + (encrypted as ArrayBuffer).byteLength);
    buffer.set(iv, 0);
    buffer.set(new Uint8Array(encrypted), 12);
    return btoa(String.fromCharCode(...buffer));
  }

  static async decrypt(base64: string, password: string): Promise<string> {
    const key = await this.getKey(password);
    const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const iv = buffer.slice(0, 12);
    const encrypted = buffer.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  }
}