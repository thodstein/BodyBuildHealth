import { db } from './db';
import { secureGetAll, securePut } from './db-encryption';
import type { UserProfile } from './types';

const BACKUP_VERSION = '2.9';
const STORES = ['labs_log', 'nutrition_log', 'diagnostics_log', 'doctor_notes', 'food_diary', 'articles'] as const;

export async function exportEncryptedBackup(profile: UserProfile): Promise<void> {
  const backup: Record<string, any> = { version: BACKUP_VERSION, date: new Date().toISOString(), profile };
  for (const store of STORES) {
    try { backup[store] = await secureGetAll(db, store); } catch { backup[store] = await db.getAll(store); }
  }
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `health-engine-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importEncryptedBackup(file: File, onRestore: () => void): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (data.version !== BACKUP_VERSION) throw new Error(`Версия бэкапа ${data.version} несовместима с текущей ${BACKUP_VERSION}`);
  
  // Восстановление профиля
  if (data.profile) localStorage.setItem('he_profile', JSON.stringify(data.profile));
  
  // Восстановление данных
  for (const store of STORES) {
    if (data[store]?.length) {
      for (const item of data[store]) {
        try { await securePut(db, store, item); } catch { await db.put(store, item); }
      }
    }
  }
  alert('✅ Бэкап успешно восстановлен');
  onRestore();
}