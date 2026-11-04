/**
 * data-space.ts — пространства данных («кто сейчас тренируется»).
 *
 * ЗАЧЕМ. Режим тренера ведёт до 20 атлетов, но планы, дневники, анализы и профиль
 * исторически лежат в одном устройстве. Нужно, чтобы данные атлета не смешивались
 * с данными тренера и с данными другого атлета.
 *
 * КАК. Не переписывая 3700 обращений к `localStorage` вручную (это гарантированные
 * пропуски и утечки между атлетами), мы ставим ОДИН шов — обёртку над `localStorage`,
 * которая на входе/выходе переводит логический ключ в физический:
 *
 *   home:     he_profile_v2                       (как было — байт в байт, нулевая миграция)
 *   атлет:    he_ath_<spaceId>__he_profile_v2
 *
 * Приложение по-прежнему вызывает `localStorage.setItem('he_profile_v2', …)` и не
 * знает про префиксы. Это единственная причина, по которой такой шов оправдан:
 * альтернатива — правка каждого вызова с неизбежными пропусками.
 *
 * ИНВАРИАНТЫ (на них держится безопасность):
 *  1. В `home` физические ключи НЕ меняются. Пользователь без режима тренера видит
 *     ровно те же ключи, что и раньше: обновление не переносит и не теряет данные.
 *  2. Ключ, который УЖЕ выглядит физическим (`he_ath_…__…`), всегда читается и
 *     пишется как есть. Поэтому восстановление бэкапа и облачная синхронизация,
 *     где ключ приходит извне, не «удваивают» префикс.
 *  3. `he_coach_*`, `he_sync_*`, `he_data_space_*`, тема/язык/онбординг/сессия —
 *     данные устройства: они не переключаются вместе с атлетом. Иначе тренер,
 *     зайдя в атлета, потерял бы список атлетов и настройки вида.
 *  4. Перечисление ключей (`length` / `key(i)`) показывает только активное
 *     пространство + устройство. Полный список (все пространства) отдаёт
 *     `rawKeys()` — им пользуются бэкап и «удалить всё».
 *  5. Переключение пространства = запись `active` + перезагрузка страницы.
 *     Никакой «горячей» подмены: в приложении десятки модульных кэшей, и
 *     половинчатое переключение = чужие данные в расчётах.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: изоляции IndexedDB на уровне облачной синхронизации (это
 * отдельный шаг — `db.ts` открывает свою базу на пространство, а ключи синка
 * получают пространство в имени). До этого шага локальная изоляция IndexedDB
 * уже работает, а облако для атлетов помечается как частичное.
 */

/** Ключ реестра пространств. Всегда данные устройства (никогда не префиксуется). */
export const DATA_SPACE_KEY = 'he_data_space_v1';
export const HOME_SPACE_ID = 'home';
/** Физический префикс данных атлета. */
export const ATHLETE_SPACE_PREFIX = 'he_ath_';
/** Разделитель между префиксом пространства и логическим ключом. */
export const SPACE_INFIX = '__';
/** Больше 20 пространств не бывает: столько же атлетов разрешено в режиме тренера. */
export const MAX_DATA_SPACES = 20;

/** Соль ключа шифрования IndexedDB (`core/db-encryption.ts`) — свойство устройства. */
export const DEVICE_SALT_KEY = 'health-engine-v2-salt';

/**
 * Данные устройства: не переключаются вместе с атлетом.
 * Тема/язык/онбординг/сессия/шифрование/синк/сам режим тренера.
 */
const DEVICE_LEVEL_PREFIXES: readonly string[] = [
  'he_coach_',
  'he_sync_',
  'he_data_space_',
];

const DEVICE_LEVEL_KEYS: ReadonlySet<string> = new Set([
  // Соль для ключа шифрования IndexedDB (`core/db-encryption.ts`). Это свойство
  // устройства: при переключении пространства ключ шифрования не должен меняться,
  // иначе часть записей после возврата к атлету не расшифруется.
  DEVICE_SALT_KEY,
  'he_theme',
  'he_app_theme',
  'he_apk_theme_v1',
  'he_apk_accent_v1',
  'he_apk_system_hex_v1',
  'he_app_update_v1',
  'he_timer_sound_settings',
  'he_notification_log',
  'he_crypto_key',
  'he_session_v2',
  'he_webauthn_cred_v1',
  'he_manual_onboarding_done',
  'he_lift_master_onboard_v1',
  'he_sync_tg_token_v1',
]);

export interface DataSpaceRecord {
  /** `home` или `asp_<athleteId>`. */
  id: string;
  athleteId: string | null;
  label: string;
  createdAt: string;
  /**
   * Данные из карточки тренера, из которых создаётся ПУСТОЙ профиль при первом
   * входе в пространство. Нужны, чтобы тренер не вводил имя/пол/возраст/рост/вес
   * второй раз. Это не «нормативы»: переносятся только те числа, что тренер ввёл.
   */
  seed?: AthleteProfileSeed;
}

/** Поля карточки, которые переносятся в профиль атлета. */
export interface AthleteProfileSeed {
  name?: string;
  sex?: 'male' | 'female';
  age?: number;
  height?: number;
  weight?: number;
}

export interface DataSpaceRegistry {
  version: 1;
  /** Активное пространство. Неизвестный/битый id трактуется как `home`. */
  active: string;
  spaces: DataSpaceRecord[];
}

/* ------------------------------------------------------------------ */
/* Классификация ключей                                                */
/* ------------------------------------------------------------------ */

/** Ключ принадлежит устройству (не атлету). */
export function isDeviceLevelKey(key: string): boolean {
  if (DEVICE_LEVEL_KEYS.has(key)) return true;
  for (const p of DEVICE_LEVEL_PREFIXES) {
    if (key.startsWith(p)) return true;
  }
  return false;
}

/** Физический (уже префиксованный пространством) ключ. */
export function isPhysicalSpaceKey(key: string): boolean {
  return typeof key === 'string' && key.startsWith(ATHLETE_SPACE_PREFIX);
}

/* ------------------------------------------------------------------ */
/* Идентификаторы пространств                                          */
/* ------------------------------------------------------------------ */

const shortHash = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 6);
};

/**
 * id пространства атлета. Из id атлета убираем всё, что ломает ключ
 * (`%`, `:`, пробелы), и добавляем короткий хеш исходного id: два разных
 * атлета никогда не попадут в одно пространство из-за санитизации.
 */
export function athleteSpaceId(athleteId: string): string {
  const src = String(athleteId ?? '');
  const safe = src.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40) || 'x';
  return `asp_${safe}_${shortHash(src)}`;
}

/* ------------------------------------------------------------------ */
/* Преобразование ключей                                               */
/* ------------------------------------------------------------------ */

/** Логический ключ → физический для указанного пространства (идемпотентно). */
export function toPhysicalKey(spaceId: string, key: string): string {
  if (isDeviceLevelKey(key)) return key;
  // Уже физический или чужой — не трогаем: инвариант №2.
  if (isPhysicalSpaceKey(key)) return key;
  if (!spaceId || spaceId === HOME_SPACE_ID) return key;
  return `${ATHLETE_SPACE_PREFIX}${spaceId}${SPACE_INFIX}${key}`;
}

/** Физический ключ → логический (для `home` и для ключей устройства — без изменений). */
export function toLogicalKey(key: string): string {
  if (!isPhysicalSpaceKey(key)) return key;
  const rest = key.slice(ATHLETE_SPACE_PREFIX.length);
  const at = rest.indexOf(SPACE_INFIX);
  if (at <= 0) return key;
  return rest.slice(at + SPACE_INFIX.length);
}

/** Разбор физического ключа: `{ spaceId, logical }` или null для обычного ключа. */
export function spaceIdOfKey(key: string): { spaceId: string; logical: string } | null {
  if (!isPhysicalSpaceKey(key)) return null;
  const rest = key.slice(ATHLETE_SPACE_PREFIX.length);
  const at = rest.indexOf(SPACE_INFIX);
  if (at <= 0) return null;
  return { spaceId: rest.slice(0, at), logical: rest.slice(at + SPACE_INFIX.length) };
}

/** Префикс всех физических ключей пространства. */
export function spaceKeyPrefix(spaceId: string): string {
  return `${ATHLETE_SPACE_PREFIX}${spaceId}${SPACE_INFIX}`;
}

/* ------------------------------------------------------------------ */
/* Реестр пространств                                                  */
/* ------------------------------------------------------------------ */

export function emptyRegistry(): DataSpaceRegistry {
  return {
    version: 1,
    active: HOME_SPACE_ID,
    spaces: [{ id: HOME_SPACE_ID, athleteId: null, label: 'Мои данные', createdAt: '' }],
  };
}

const clean = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

/** Положительное число из ввода; мусор, минус и абсурд → undefined (не «норматив»). */
function cleanPositive(v: unknown, max: number): number | undefined {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > max) return undefined;
  return Math.round(n * 10) / 10;
}

const cleanSeed = (raw: unknown): AthleteProfileSeed | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<AthleteProfileSeed>;
  const seed: AthleteProfileSeed = {};
  const name = clean(r.name, 60);
  if (name) seed.name = name;
  if (r.sex === 'male' || r.sex === 'female') seed.sex = r.sex;
  const age = cleanPositive(r.age, 120);
  if (age !== undefined) seed.age = age;
  const height = cleanPositive(r.height, 260);
  if (height !== undefined) seed.height = height;
  const weight = cleanPositive(r.weight, 400);
  if (weight !== undefined) seed.weight = weight;
  return Object.keys(seed).length ? seed : undefined;
};

function normalizeSpace(raw: unknown): DataSpaceRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<DataSpaceRecord>;
  const id = clean(r.id, 80);
  if (!id) return null;
  if (id === HOME_SPACE_ID) {
    return { id: HOME_SPACE_ID, athleteId: null, label: 'Мои данные', createdAt: '' };
  }
  // id пространства вклеивается в составной ключ — разделитель и пробелы ломают разбор.
  if (id.includes(SPACE_INFIX) || /\s/.test(id)) return null;
  const seed = cleanSeed(r.seed);
  return {
    id,
    athleteId: r.athleteId == null ? null : clean(r.athleteId, 80),
    label: clean(r.label, 80) || 'Атлет',
    createdAt: clean(r.createdAt, 40),
    ...(seed ? { seed } : {}),
  };
}

/**
 * Терпимый разбор реестра: битый JSON, дубли, чужие версии, активное
 * пространство без записи — всё сводится к корректному состоянию, а не к падению.
 */
export function parseRegistry(raw: string | null | undefined): DataSpaceRegistry {
  const base = emptyRegistry();
  if (!raw) return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!parsed || typeof parsed !== 'object') return base;
  const obj = parsed as Partial<DataSpaceRegistry> & Record<string, unknown>;
  if (obj.version !== 1 || !Array.isArray(obj.spaces)) return base;
  const seen = new Set<string>([HOME_SPACE_ID]);
  const spaces: DataSpaceRecord[] = [base.spaces[0]];
  for (const row of obj.spaces) {
    const rec = normalizeSpace(row);
    if (!rec || seen.has(rec.id)) continue;
    seen.add(rec.id);
    spaces.push(rec);
    if (spaces.length > MAX_DATA_SPACES + 1) break;
  }
  const activeWanted = clean(obj.active, 80) || HOME_SPACE_ID;
  const active = spaces.some(s => s.id === activeWanted) ? activeWanted : HOME_SPACE_ID;
  return { version: 1, active, spaces };
}

export function serializeRegistry(reg: DataSpaceRegistry): string {
  return JSON.stringify({ version: 1, active: reg.active, spaces: reg.spaces });
}

/** Добавить/обновить пространство (лимит — на атлетов, `home` не считается). */
export function upsertSpace(
  reg: DataSpaceRegistry,
  rec: {
    id: string;
    athleteId?: string | null;
    label?: string;
    createdAt?: string;
    seed?: AthleteProfileSeed;
  },
): { registry: DataSpaceRegistry; error: 'limit' | 'invalid' | null } {
  const id = clean(rec.id, 80);
  if (!id || id === HOME_SPACE_ID || id.includes(SPACE_INFIX)) {
    return { registry: reg, error: 'invalid' };
  }
  const incomingSeed = cleanSeed(rec.seed);
  const existing = reg.spaces.find(s => s.id === id);
  if (existing) {
    const merged: AthleteProfileSeed | undefined =
      incomingSeed || existing.seed
        ? cleanSeed({ ...(existing.seed ?? {}), ...(incomingSeed ?? {}) })
        : undefined;
    const spaces = reg.spaces.map(s =>
      s.id === id
        ? {
            ...s,
            athleteId: rec.athleteId === undefined ? s.athleteId : rec.athleteId,
            label: clean(rec.label, 80) || s.label,
            ...(merged ? { seed: merged } : {}),
          }
        : s,
    );
    return { registry: { ...reg, spaces }, error: null };
  }
  const athleteSpaces = reg.spaces.filter(s => s.id !== HOME_SPACE_ID).length;
  if (athleteSpaces >= MAX_DATA_SPACES) return { registry: reg, error: 'limit' };
  const space: DataSpaceRecord = {
    id,
    athleteId: rec.athleteId ?? null,
    label: clean(rec.label, 80) || 'Атлет',
    createdAt: clean(rec.createdAt, 40) || new Date().toISOString(),
    ...(incomingSeed ? { seed: incomingSeed } : {}),
  };
  return { registry: { ...reg, spaces: [...reg.spaces, space] }, error: null };
}

export function removeSpace(reg: DataSpaceRegistry, spaceId: string): DataSpaceRegistry {
  if (!spaceId || spaceId === HOME_SPACE_ID) return reg;
  const spaces = reg.spaces.filter(s => s.id !== spaceId);
  if (spaces.length === reg.spaces.length) return reg;
  return { version: 1, active: reg.active === spaceId ? HOME_SPACE_ID : reg.active, spaces };
}

export function setActiveSpace(reg: DataSpaceRegistry, spaceId: string): DataSpaceRegistry {
  const known = reg.spaces.some(s => s.id === spaceId);
  return { ...reg, active: known ? spaceId : HOME_SPACE_ID };
}

export function findSpace(reg: DataSpaceRegistry, spaceId: string): DataSpaceRecord | null {
  return reg.spaces.find(s => s.id === spaceId) ?? null;
}

export function spaceForAthlete(reg: DataSpaceRegistry, athleteId: string): DataSpaceRecord | null {
  const id = athleteSpaceId(athleteId);
  return reg.spaces.find(s => s.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/* Хранилище с пространствами                                          */
/* ------------------------------------------------------------------ */

/** Минимум Storage, который нам нужен (удобно и для тестов, и для jsdom). */
export interface RawStorageLike {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  clear?: () => void;
}

export interface SpaceStorage {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  clear(): void;
}

/**
 * Обёртка над «сырым» хранилищем. `getActiveSpaceId` вызывается на каждую
 * операцию: значение дешёвое (кэш), зато подмена активного пространства не
 * требует пересоздавать обёртку.
 */
export function createSpaceStorage(raw: RawStorageLike, getActiveSpaceId: () => string): SpaceStorage {
  /** Виден ли физический ключ в текущем пространстве. */
  const visible = (physicalKey: string, active: string): boolean => {
    const device = isDeviceLevelKey(physicalKey);
    const parsed = spaceIdOfKey(physicalKey);
    if (parsed) return device ? true : parsed.spaceId === active;
    // обычный (нерфиксованный) ключ: это данные home
    return device || active === HOME_SPACE_ID;
  };

  const visibleKeys = (): string[] => {
    const active = getActiveSpaceId();
    const out: string[] = [];
    let n = 0;
    try {
      n = raw.length;
    } catch {
      return out;
    }
    for (let i = 0; i < n; i++) {
      let k: string | null = null;
      try {
        k = raw.key(i);
      } catch {
        k = null;
      }
      if (k && visible(k, active)) out.push(k);
    }
    return out;
  };

  const phys = (key: string): string => toPhysicalKey(getActiveSpaceId(), key);

  return {
    get length() {
      return visibleKeys().length;
    },
    key(i: number): string | null {
      const keys = visibleKeys();
      if (!Number.isInteger(i) || i < 0 || i >= keys.length) return null;
      const physical = keys[i];
      // Наружу отдаём логическое имя: код приложения не должен знать про префиксы.
      return isDeviceLevelKey(physical) ? physical : toLogicalKey(physical);
    },
    getItem(key: string): string | null {
      try {
        return raw.getItem(phys(key));
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      raw.setItem(phys(key), value);
    },
    removeItem(key: string): void {
      raw.removeItem(phys(key));
    },
    clear(): void {
      const active = getActiveSpaceId();
      // Ключи устройства (режим тренера, синк, тема) НЕ трогаем: `clear()` — это
      // «очистить данные профиля», а не «выйти из приложения».
      for (const k of rawKeys(raw)) {
        if (isDeviceLevelKey(k)) continue;
        const parsed = spaceIdOfKey(k);
        const mine = parsed ? parsed.spaceId === active : active === HOME_SPACE_ID;
        if (!mine) continue;
        try {
          raw.removeItem(k);
        } catch {
          /* один сбойный ключ не должен блокировать очистку */
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Сырой доступ (бэкап, полная очистка, удаление данных атлета)         */
/* ------------------------------------------------------------------ */

export function rawKeys(raw: RawStorageLike): string[] {
  const out: string[] = [];
  let n = 0;
  try {
    n = raw.length;
  } catch {
    return out;
  }
  for (let i = 0; i < n; i++) {
    let k: string | null = null;
    try {
      k = raw.key(i);
    } catch {
      k = null;
    }
    if (k != null) out.push(k);
  }
  return out;
}

/** «Сырое» хранилище, если шов установлен (иначе null). */
let installedRaw: RawStorageLike | null = null;

export function deviceRaw(): RawStorageLike | null {
  return installedRaw;
}

/**
 * Полная зачистка хранилища устройства: ВСЕ пространства, все ключи.
 * Нужна аварийным сбросам (`location.reload()` после неё) — иначе `clear()`
 * под швом почистил бы только открытое пространство, а базы IndexedDB всех
 * пространств при этом удаляются, и состояние стало бы несогласованным.
 */
export function clearAllDeviceStorage(storage?: Storage | null): number {
  const raw: RawStorageLike | null = storage
    ? (storage as unknown as RawStorageLike)
    : (installedRaw ??
      (typeof localStorage !== 'undefined' ? (localStorage as unknown as RawStorageLike) : null));
  if (!raw) return 0;
  let removed = 0;
  for (const k of rawKeys(raw)) {
    try {
      raw.removeItem(k);
      removed++;
    } catch {
      /* один ключ не должен блокировать сброс */
    }
  }
  cachedActive = null;
  return removed;
}

/**
 * Сырое хранилище или, если шов не ставился, обычные методы.
 * Нужно бэкапу и полной очистке: они обязаны видеть ВСЕ пространства.
 */
export function deviceRawOrFallback(storage: RawStorageLike): RawStorageLike {
  return installedRaw ?? storage;
}

/** Установлен ли шов (нужно тем, кто оборачивает методы `localStorage`). */
export function isDataSpaceInstalled(): boolean {
  return installedRaw !== null;
}

export interface SpaceUsage {
  keys: number;
  bytes: number;
}

/** Сколько занимает пространство (для честного «удалить данные атлета»). */
export function spaceUsage(raw: RawStorageLike, spaceId: string): SpaceUsage {
  const prefix = spaceKeyPrefix(spaceId);
  let keys = 0;
  let bytes = 0;
  for (const k of rawKeys(raw)) {
    if (!k.startsWith(prefix)) continue;
    keys++;
    try {
      bytes += (raw.getItem(k) || '').length;
    } catch {
      /* ignore */
    }
  }
  return { keys, bytes };
}

/** Удалить ВСЕ физические ключи пространства. Возвращает число удалённых ключей. */
export function clearSpaceData(raw: RawStorageLike, spaceId: string): number {
  if (!spaceId || spaceId === HOME_SPACE_ID) return 0;
  const prefix = spaceKeyPrefix(spaceId);
  let removed = 0;
  for (const k of rawKeys(raw)) {
    if (!k.startsWith(prefix)) continue;
    try {
      raw.removeItem(k);
      removed++;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

/* ------------------------------------------------------------------ */
/* Установка шва в приложении                                          */
/* ------------------------------------------------------------------ */

export interface InstalledDataSpace {
  storage: SpaceStorage;
  raw: RawStorageLike;
  /** Прочитать реестр напрямую (без префиксов). */
  readRegistry(): DataSpaceRegistry;
  writeRegistry(reg: DataSpaceRegistry): void;
  activeSpaceId(): string;
}

let cachedActive: string | null = null;

/** Сброс кэша (нужен тестам и после записи реестра). */
export function _resetDataSpaceCache(): void {
  cachedActive = null;
}

/**
 * Активное пространство для модулей, которым нужен только id (например, имя
 * базы IndexedDB). Реестр — ключ устройства, поэтому читается без префиксов.
 */
export function currentSpaceId(): string {
  if (cachedActive != null) return cachedActive;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DATA_SPACE_KEY) : null;
    cachedActive = parseRegistry(raw).active;
  } catch {
    cachedActive = HOME_SPACE_ID;
  }
  return cachedActive;
}

/**
 * Поставить шов. Вызывать РОВНО ОДИН РАЗ на старте приложения, до первого
 * чтения данных. Идемпотентно: повторный вызов возвращает уже установленный шов.
 */
export function installDataSpaceStorage(win: Window | null | undefined): InstalledDataSpace | null {
  if (!win) return null;
  const w = win as Window & { [key: string]: unknown; __heDataSpace?: InstalledDataSpace };
  if (w.__heDataSpace) return w.__heDataSpace;

  let ls: Storage;
  try {
    ls = w.localStorage;
  } catch {
    return null;
  }
  if (!ls) return null;

  // Снимаем «сырые» методы ДО подмены, иначе получим рекурсию.
  const rawGet = ls.getItem.bind(ls);
  const rawSet = ls.setItem.bind(ls);
  const rawRemove = ls.removeItem.bind(ls);
  const rawKey = ls.key.bind(ls);

  // `length` — аксессор на прототипе Storage: после подмены читать его напрямую
  // нельзя (бесконечная рекурсия: наш getter зовёт raw.length). Берём оригинал.
  let rawLength: () => number;
  const proto = Object.getPrototypeOf(ls) as object | null;
  const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'length') : undefined;
  const protoGetter = descriptor?.get as (() => number) | undefined;
  if (typeof protoGetter === 'function') {
    rawLength = () => protoGetter.call(ls);
  } else {
    rawLength = () => {
      let n = 0;
      // Считаем по исходному `key()`: он уже снят до подмены.
      while (n < 100000) {
        let k: string | null = null;
        try {
          k = rawKey(n);
        } catch {
          break;
        }
        if (k == null) break;
        n++;
      }
      return n;
    };
  }

  const raw: RawStorageLike = {
    get length() { return rawLength(); },
    key: (i: number) => rawKey(i),
    getItem: (k: string) => rawGet(k),
    setItem: (k: string, v: string) => rawSet(k, v),
    removeItem: (k: string) => rawRemove(k),
  };

  const readRegistry = (): DataSpaceRegistry => {
    try {
      return parseRegistry(raw.getItem(DATA_SPACE_KEY));
    } catch {
      return emptyRegistry();
    }
  };

  const activeSpaceId = (): string => {
    if (cachedActive != null) return cachedActive;
    cachedActive = readRegistry().active;
    return cachedActive;
  };

  const storage = createSpaceStorage(raw, activeSpaceId);

  const writeRegistry = (reg: DataSpaceRegistry): void => {
    cachedActive = reg.active;
    try {
      raw.setItem(DATA_SPACE_KEY, serializeRegistry(reg));
    } catch {
      /* нет места — реестр не записан, значит и переключения не было */
    }
  };

  // Подмена методов на месте: ссылки, взятые другими модулями раньше, продолжают
  // работать, а порядок вызовов остаётся «приложение → (синк-хук) → пространство → сырое».
  try {
    ls.getItem = (k: string) => storage.getItem(k);
    ls.setItem = (k: string, v: string) => storage.setItem(k, v);
    ls.removeItem = (k: string) => storage.removeItem(k);
    ls.key = (i: number) => storage.key(i);
    ls.clear = () => storage.clear();
    Object.defineProperty(ls, 'length', {
      configurable: true,
      get: () => storage.length,
    });
  } catch {
    // Среда не даёт подменить хранилище: изоляция невозможна. Возвращаем активное
    // пространство в home, иначе приложение читало бы данные устройства, а базу
    // IndexedDB открывало бы от атлета — то есть смешало бы данные.
    try {
      const reg = parseRegistry(raw.getItem(DATA_SPACE_KEY));
      if (reg.active !== HOME_SPACE_ID) {
        raw.setItem(DATA_SPACE_KEY, serializeRegistry(setActiveSpace(reg, HOME_SPACE_ID)));
      }
    } catch {
      /* ignore */
    }
    cachedActive = null;
    return null; // работаем как раньше, без изоляции
  }

  const installedApi: InstalledDataSpace = { storage, raw, readRegistry, writeRegistry, activeSpaceId };
  installedRaw = raw;
  w.__heDataSpace = installedApi;
  return installedApi;
}

/* ------------------------------------------------------------------ */
/* Переключение пространства из UI                                     */
/* ------------------------------------------------------------------ */

/**
 * Реестр из хранилища. Ключ реестра — данные устройства, поэтому читается
 * одинаково и до установки шва, и после.
 */
export function readRegistryFromStorage(): DataSpaceRegistry {
  try {
    return parseRegistry(typeof localStorage !== 'undefined' ? localStorage.getItem(DATA_SPACE_KEY) : null);
  } catch {
    return emptyRegistry();
  }
}

export function writeRegistryToStorage(reg: DataSpaceRegistry): void {
  cachedActive = reg.active;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DATA_SPACE_KEY, serializeRegistry(reg));
  } catch {
    /* нет места — остаёмся в прежнем пространстве */
  }
}

/** Текущее пространство (всегда валидная запись: home, если реестр пуст). */
export function activeSpaceRecord(): DataSpaceRecord {
  if (cachedActive == null) {
    try {
      cachedActive = parseRegistry(
        typeof localStorage !== 'undefined' ? localStorage.getItem(DATA_SPACE_KEY) : null,
      ).active;
    } catch {
      cachedActive = HOME_SPACE_ID;
    }
  }
  const reg = readRegistryFromStorage();
  return findSpace(reg, cachedActive) ?? reg.spaces[0];
}

export function isAthleteDataActive(): boolean {
  return activeSpaceRecord().id !== HOME_SPACE_ID;
}

/**
 * Включить пространство атлета: создаёт его при первом входе и делает активным.
 * Приложение после этого нужно перезагрузить — иначе в памяти останутся данные
 * прежнего пространства (`reloadToApplySpace`).
 */
export function activateAthleteSpace(
  athleteId: string,
  label: string,
  seed?: AthleteProfileSeed,
): { id: string | null; error: 'limit' | 'invalid' | null } {
  const reg = readRegistryFromStorage();
  const id = athleteSpaceId(athleteId);
  const up = upsertSpace(reg, { id, athleteId, label, seed });
  if (up.error) return { id: null, error: up.error };
  writeRegistryToStorage(setActiveSpace(up.registry, id));
  return { id, error: null };
}

/**
 * Данные карточки тренера для активного пространства (или null).
 * Читается профилем как «из чего создать пустой профиль атлета при первом входе».
 */
export function activeSpaceSeed(): AthleteProfileSeed | null {
  try {
    const rec = findSpace(readRegistryFromStorage(), currentSpaceId());
    return rec?.seed ?? null;
  } catch {
    return null;
  }
}

export function activateHomeSpace(): void {
  const reg = readRegistryFromStorage();
  writeRegistryToStorage(setActiveSpace(reg, HOME_SPACE_ID));
}

/** Единственное место, где мы перезагружаем приложение после смены пространства. */
export function reloadToApplySpace(): void {
  try {
    if (typeof location !== 'undefined' && typeof location.reload === 'function') location.reload();
  } catch {
    /* среда без location (tests) — вызывающий сам решает, что делать */
  }
}
