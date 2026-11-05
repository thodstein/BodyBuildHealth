import { db, STORES, deleteSpaceDatabases, readSpaceStores, writeSpaceStores } from './db';
import {
  DATA_SPACE_KEY,
  DEVICE_SALT_KEY,
  HOME_SPACE_ID,
  _resetDataSpaceCache,
  clearAllSessionStorage,
  currentSpaceId,
  deviceRawOrFallback,
  parseRegistry,
  rawKeys,
} from './data-space';

/** Сырое хранилище: бэкап и полная очистка обязаны видеть все пространства. */
function rawLs() {
  return deviceRawOrFallback(localStorage as unknown as Parameters<typeof deviceRawOrFallback>[0]);
}

export const BACKUP_VERSION = '2.0';

export interface AppBackup {
  app: 'health-engine';
  version: string;
  createdAt: string; // ISO timestamp
  /**
   * Легаси-поле (формат 1.0): база ТОГО пространства, в котором делали экспорт.
   * Читается старыми версиями приложения и пишется в домашнюю базу при
   * восстановлении файла, где нет `spaceStores`.
   */
  stores: Record<string, any[]>;
  /**
   * База каждого пространства: `{ home: {…}, '<spaceId>': {…} }`. Без этого
   * бэкап уносил бы тренировки и анализы только открытого атлета — а остальные
   * после смены телефона терялись бы.
   */
  spaceStores?: Record<string, Record<string, any[]>>;
  localStorage: Record<string, string>;
}

const EMPTY_STORES = (): Record<string, any[]> => {
  const out: Record<string, any[]> = {};
  for (const s of STORES) out[s] = [];
  return out;
};

/** Все пространства устройства: домашнее + атлеты из реестра. */
function allSpaceIds(): string[] {
  const ids = [HOME_SPACE_ID];
  try {
    for (const s of parseRegistry(rawLs().getItem(DATA_SPACE_KEY)).spaces) {
      if (s.id && s.id !== HOME_SPACE_ID) ids.push(s.id);
    }
  } catch {
    /* реестр недоступен — хотя бы домашнее пространство */
  }
  return Array.from(new Set(ids));
}

export async function collectBackup(): Promise<AppBackup> {
  await db.init();
  // База каждого пространства: атлеты живут в своих базах IndexedDB.
  const spaceStores: Record<string, Record<string, any[]>> = {};
  for (const spaceId of allSpaceIds()) {
    const data = await readSpaceStores(spaceId);
    const hasRecords = Object.values(data).some(records => records.length > 0);
    if (hasRecords) spaceStores[spaceId] = data;
  }
  // Легаси-поле — база открытого пространства (так его прочитают старые версии).
  const current = currentSpaceId();
  const stores = spaceStores[current] ??
    (current !== HOME_SPACE_ID ? await readSpaceStores(current) : EMPTY_STORES());

  const local: Record<string, string> = {};
  // Перечисляем СЫРЫЕ ключи: бэкап должен унести все пространства (атлетов),
  // а не только то, в котором сейчас открыто приложение. Ключи атлетов уже
  // физические (`he_ath_…__…`), поэтому восстановление кладёт их на место.
  const raw = rawLs();
  for (const k of rawKeys(raw)) {
    // Соль шифрования IndexedDB не начинается с `he_`, но без неё после
    // восстановления часть записей не расшифруется (secureDB упадёт в plaintext).
    if (!k.startsWith('he_') && k !== DEVICE_SALT_KEY) continue;
    try {
      local[k] = raw.getItem(k) || '';
    } catch {
      /* один сбойный ключ не должен срывать весь бэкап */
    }
  }
  return {
    app: 'health-engine',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    stores,
    spaceStores,
    localStorage: local,
  };
}

export function exportToJSON(b: AppBackup): string {
  return JSON.stringify(b, null, 2);
}

export function parseBackup(text: string): AppBackup {
  const b = JSON.parse(text);
  if (b?.app !== 'health-engine') {
    throw new Error('Неизвестный файл бэкапа');
  }
  return b as AppBackup;
}

// Client-only cascade:
// 1) navigator.share with File (Android TMA → system sheet; iOS 17+ often works)
// 2) clipboard copy (reliable in TMA; user pastes to Saved Messages)
// 3) browser <a download> (only works OUTSIDE TMA WebView — blocked there)
export async function exportBackup(): Promise<void> {
  const b = await collectBackup();
  const name = `health-engine-backup-${b.createdAt.slice(0, 10)}.json`;
  const text = exportToJSON(b);
  const file = new File([text], name, { type: 'application/json' });
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], title: name });
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fallthrough to browser download */
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Full replace (restore). Caller wraps parseBackup in try/catch.
export async function importBackup(b: AppBackup): Promise<void> {
  // Ключи восстанавливаем СЫРЫМИ: в файле они уже физические
  // (`he_ath_<spaceId>__…`), и через шов домашний профиль попал бы в текущее
  // пространство — то есть в данные атлета.
  const raw = rawLs();
  for (const k of Object.keys(b.localStorage || {})) {
    try {
      raw.setItem(k, b.localStorage[k]);
    } catch {
      /* один ключ не должен срывать восстановление */
    }
  }
  // Базы: у каждого пространства своя. Файлы формата 1.0 содержат одну базу —
  // это база домашнего пространства (изоляции тогда не было).
  const perSpace: Record<string, Record<string, any[]>> =
    b.spaceStores && Object.keys(b.spaceStores).length
      ? b.spaceStores
      : { [HOME_SPACE_ID]: b.stores || {} };
  for (const [spaceId, stores] of Object.entries(perSpace)) {
    await writeSpaceStores(spaceId, stores);
  }
  _resetDataSpaceCache();
  // Черновики в sessionStorage принадлежат тому, кто работал здесь до восстановления.
  // После восстановления бэкапа они не «его» — снимаем, чтобы не подставить чужие
  // цифры в открытую форму.
  try {
    clearAllSessionStorage();
  } catch {
    /* среда без sessionStorage */
  }
}

// Soft clear: wipe everything EXCEPT he_profile_v2 + he_session_v2
export async function softClear(): Promise<void> {
  await db.init();
  const raw = rawLs();
  // Пространства атлетов помним ДО зачистки: их базы IndexedDB нужно удалить,
  // иначе «удалил все данные» оставило бы дневники/анализы атлетов на диске.
  const athleteSpaces = parseRegistry(raw.getItem(DATA_SPACE_KEY)).spaces
    .filter(s => s.id !== HOME_SPACE_ID)
    .map(s => s.id);

  const keep = new Set(['he_profile_v2', 'he_session_v2']);
  const toRemove: string[] = [];
  for (const k of rawKeys(raw)) {
    if (!k.startsWith('he_') || keep.has(k)) continue;
    toRemove.push(k);
  }
  for (const k of toRemove) {
    try {
      raw.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  // Базы: домашнюю чистим по сторам, базы атлетов удаляем целиком. Чистить
  // только открытое пространство нельзя: если сброс нажали, находясь в данных
  // атлета, домашняя база осталась бы с дневниками и анализами.
  await writeSpaceStores(HOME_SPACE_ID, {});
  _resetDataSpaceCache();
  // Черновики атлетов в sessionStorage относятся к «всем данным» так же, как
  // их ключи в localStorage: после сброса они не должны всплыть заново.
  try {
    clearAllSessionStorage();
  } catch {
    /* среда без sessionStorage */
  }
  await deleteSpaceDatabases(athleteSpaces);
}
