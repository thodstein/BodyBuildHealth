import {
  db,
  STORES,
  deleteSpaceDatabases,
  deleteWeightPhotoDatabase,
  readSpaceStores,
  writeSpaceStores,
} from './db';
import {
  DATA_SPACE_KEY,
  DEVICE_SALT_KEY,
  HOME_SPACE_ID,
  _resetDataSpaceCache,
  clearAllSessionStorage,
  clearSessionSpaceData,
  clearSpaceData,
  currentSpaceId,
  deviceRawOrFallback,
  parseRegistry,
  rawKeys,
  readRegistryFromStorage,
  removePhysicalKey,
  writeRegistryToStorage,
} from './data-space';
import { requestSpacePurge } from './space-purge';

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

/**
 * «Забыть всех атлетов»: удалить данные всех пространств атлетов, не трогая
 * домашнее. Это НЕ `softClear` (он вычищает и собственные дневники тренера):
 * здесь человек закончил работу с людьми или отдаёт телефон, но свои данные
 * сохраняет.
 *
 * Возвращает число удалённых пространств — его показывают в подтверждении, а не
 * пишут «все данные удалены» без цифры.
 */
export async function forgetAllAthletes(): Promise<{ spaces: number }> {
  const reg = readRegistryFromStorage();
  const ids = reg.spaces.filter(s => s.id !== HOME_SPACE_ID).map(s => s.id);
  const raw = rawLs();
  for (const id of ids) {
    // Ключи чистим по префиксу, а не по наличию записи в реестре: осиротевшие
    // ключи (реестр переписывали) относятся к тому же человеку.
    clearSpaceData(raw, id);
    // Черновики в sessionStorage — тоже его данные.
    clearSessionSpaceData(id);
  }
  // Базы удаляем ДО записи реестра: пока кэш активного пространства прежний,
  // `deleteSpaceDatabases` закроет соединение этого пространства. Иначе
  // удаление упрётся в «блокировано» и база останется на диске.
  if (ids.length) await deleteSpaceDatabases(ids);
  writeRegistryToStorage({
    ...reg,
    active: HOME_SPACE_ID,
    spaces: reg.spaces.filter(s => s.id === HOME_SPACE_ID),
  });
  // В облаке остались бы копии их дневников — «забыли» было бы правдой только
  // на этом телефоне.
  requestSpacePurge(ids);
  return { spaces: ids.length };
}

export function exportToJSON(b: AppBackup): string {
  return JSON.stringify(b, null, 2);
}

/**
 * Готовый файл копии: имя и текст. Само сохранение — забота UI: на веб это
 * скачивание, в APK — Documents + share (`core/apk-share`), и только там
 * известно, что сработало и что сказать пользователю.
 */
export async function backupFile(): Promise<{ name: string; text: string }> {
  const b = await collectBackup();
  return {
    name: `health-engine-backup-${b.createdAt.slice(0, 10)}.json`,
    text: exportToJSON(b),
  };
}

/**
 * Короткая сводка файла для подтверждения перед заменой: сколько пространств и
 * сколько записей в базе. Нужна, чтобы «восстановить» не было кнопкой-лотереей:
 * человек видит, что именно заменит его данные.
 */
export function describeBackup(b: AppBackup): {
  spaces: number;
  records: number;
  keys: number;
  createdAt: string;
} {
  const perSpace: Record<string, Record<string, any[]>> =
    b.spaceStores && Object.keys(b.spaceStores).length
      ? b.spaceStores
      : { [HOME_SPACE_ID]: b.stores || {} };
  let records = 0;
  for (const stores of Object.values(perSpace)) {
    for (const arr of Object.values(stores || {})) {
      if (Array.isArray(arr)) records += arr.length;
    }
  }
  return {
    spaces: Object.keys(perSpace).length,
    records,
    keys: Object.keys(b.localStorage || {}).length,
    createdAt: typeof b.createdAt === 'string' ? b.createdAt : '',
  };
}

export function parseBackup(text: string): AppBackup {
  const b = JSON.parse(text);
  if (b?.app !== 'health-engine') {
    throw new Error('Неизвестный файл бэкапа');
  }
  return b as AppBackup;
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
      // Через живой метод: синхронизация ставит поверх свой removeItem и только
      // так узнаёт об удалении. Иначе в облаке остались бы копии удалённого.
      removePhysicalKey(raw, k);
    } catch {
      /* ignore */
    }
  }
  // Базы: домашнюю чистим по сторам, базы атлетов удаляем целиком. Чистить
  // только открытое пространство нельзя: если сброс нажали, находясь в данных
  // атлета, домашняя база осталась бы с дневниками и анализами.
  await writeSpaceStores(HOME_SPACE_ID, {});
  // Фотографии веса лежат в отдельной базе и в сторы основной не попадают —
  // без этого «удалил все данные» оставило бы их на диске.
  await deleteWeightPhotoDatabase(HOME_SPACE_ID);
  _resetDataSpaceCache();
  // Черновики атлетов в sessionStorage относятся к «всем данным» так же, как
  // их ключи в localStorage: после сброса они не должны всплыть заново.
  try {
    clearAllSessionStorage();
  } catch {
    /* среда без sessionStorage */
  }
  await deleteSpaceDatabases(athleteSpaces);
  // Базы атлетов удалены целиком — у этих записей в облаке нет надгробий,
  // поэтому просим убрать их префиксы из облака отдельно.
  requestSpacePurge(athleteSpaces);
}
