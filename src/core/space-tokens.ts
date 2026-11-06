/**
 * space-tokens.ts — облачный ключ доступа к ОДНОМУ пространству атлета.
 *
 * ЗАЧЕМ. Пространства данных (`data-space`) изолируют атлетов на устройстве, но
 * в облаке всё лежало под одним sync-токеном тренера. Чтобы телефон атлета мог
 * получить СВОИ данные, не получая чужие, у пространства должен быть отдельный
 * токен: RLS в Supabase (`id = x-user-token`) тогда сам гарантирует, что по
 * этому токену видны только строки этого пространства.
 *
 * КАК. Запись `he_coach_space_tokens` — данные УСТРОЙСТВА (как и `he_coach_*`):
 *   • на телефоне тренера она синкается под его токеном → остальные устройства
 *     тренера узнают токены пространств;
 *   • на телефоне атлета в ней лежит только тот токен, который ему выдали.
 * Токен — секрет: кто его знает, тот видит данные пространства. Поэтому это не
 * «код приглашения» в бытовом смысле, а ключ, и в интерфейсе это написано.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: хэширования токена на устройстве. Устройство обязано уметь
 * предъявить токен серверу, значит хранит его как есть. Граница защиты — доступ
 * к телефону (PIN режима тренера), а не шифрование этого файла.
 *
 * Сервер НЕ требует изменений: `user_kv` уже разрешает доступ только к строкам
 * с `id = x-user-token`, а токен пространства — обычное значение `id`.
 */

/** Реестр токенов пространств. Данные устройства, не атлета. */
export const SPACE_TOKENS_KEY = 'he_coach_space_tokens';

/**
 * Технический потолок разбора (защита от испорченного/поддельного файла).
 * Это НЕ продуктовый лимит: тренер не ограничен числом атлетов.
 */
export const MAX_SPACE_TOKENS = 1000;

export const SPACE_TOKEN_PREFIX = 'tk_';
/** Префикс кода приглашения. Меняется, если поменяется формат. */
export const INVITE_PREFIX = 'BBA1';

export type SpaceTokenRole = 'coach' | 'athlete';

export interface SpaceTokenRecord {
  spaceId: string;
  /** `tk_` + случайные байты. Предъявляется серверу как `x-user-token`. */
  token: string;
  role: SpaceTokenRole;
  /** Подпись для интерфейса (имя атлета/тренера). Не является данными профиля. */
  label?: string;
  createdAt: string;
  /**
   * Когда данные пространства перенесены под этот токен. До этого момента
   * синхронизация обязана продолжать работать под токеном владельца — иначе
   * уже накопленные в облаке ключи стали бы «невидимыми» на этом устройстве.
   */
  migratedAt?: string;
  /**
   * Когда токен отозван. Запись НЕ удаляется: реестр синкается между
   * устройствами тренера, и удаление на одном устройстве воскресило бы токен
   * из копии на другом (merge по `spaceId`). Могила переживает объединение.
   */
  revokedAt?: string;
  /**
   * Время последнего изменения записи (не данных). Нужно для объединения
   * реестра между устройствами: побеждает запись с более поздним `updatedAt`.
   */
  updatedAt?: string;
}

export interface SpaceTokenStore {
  version: 1;
  items: SpaceTokenRecord[];
}

export function emptySpaceTokens(): SpaceTokenStore {
  return { version: 1, items: [] };
}

const clean = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

/** id пространства: `asp_...` и без разделителя `__` (он ломает разбор ключа). */
export function isValidSpaceId(id: string): boolean {
  if (typeof id !== 'string' || id.length < 5 || id.length > 80) return false;
  if (!id.startsWith('asp_')) return false;
  if (id.includes('__') || /\s/.test(id)) return false;
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/** Токен: `tk_` + 32…64 hex. Строго — чтобы мусор из буфера не стал ключом. */
export function isValidSyncToken(token: string): boolean {
  return typeof token === 'string' && /^tk_[0-9a-f]{32,64}$/.test(token);
}

/** Случайный sync-токен. WebCrypto; на древних WebView — честный слабый фолбэк. */
export function randomSyncToken(): string {
  const bytes = new Uint8Array(24);
  let strong = false;
  try {
    const c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(bytes);
      strong = true;
    }
  } catch {
    strong = false;
  }
  if (!strong) {
    // Старый WebView без WebCrypto. Токен всё равно нужен, но он слабее:
    // это записано в ограничениях экрана. Время+Math.random не «криптостойко».
    let seed = Date.now();
    for (let i = 0; i < bytes.length; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      bytes[i] = seed & 0xff;
    }
  }
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return SPACE_TOKEN_PREFIX + hex;
}

function normalizeRecord(raw: unknown): SpaceTokenRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const spaceId = clean(r.spaceId, 80);
  const token = clean(r.token, 80).toLowerCase();
  if (!isValidSpaceId(spaceId) || !isValidSyncToken(token)) return null;
  const role: SpaceTokenRole = r.role === 'athlete' ? 'athlete' : 'coach';
  const label = clean(r.label, 60);
  const createdAt = clean(r.createdAt, 40) || new Date(0).toISOString();
  const migratedAt = clean(r.migratedAt, 40);
  const revokedAt = clean(r.revokedAt, 40);
  const updatedAt = clean(r.updatedAt, 40);
  return {
    spaceId,
    token,
    role,
    ...(label ? { label } : {}),
    createdAt,
    ...(migratedAt ? { migratedAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

/** Терпимый разбор: битый JSON/чужие версии/дубли → корректный короткий список. */
export function parseSpaceTokens(raw: string | null | undefined): SpaceTokenStore {
  if (!raw) return emptySpaceTokens();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptySpaceTokens();
  }
  if (!parsed || typeof parsed !== 'object') return emptySpaceTokens();
  const obj = parsed as { version?: unknown; items?: unknown };
  if (obj.version !== 1 || !Array.isArray(obj.items)) return emptySpaceTokens();
  const bySpace = new Map<string, SpaceTokenRecord>();
  for (const row of obj.items as unknown[]) {
    const rec = normalizeRecord(row);
    if (!rec) continue;
    // Дубли по spaceId: побеждает последняя запись (так писал бы и writer).
    bySpace.delete(rec.spaceId);
    bySpace.set(rec.spaceId, rec);
    if (bySpace.size >= MAX_SPACE_TOKENS) break;
  }
  return { version: 1, items: [...bySpace.values()] };
}

export function serializeSpaceTokens(store: SpaceTokenStore): string {
  return JSON.stringify({ version: 1, items: store.items });
}

/* ------------------------------------------------------------------ */
/* Хранилище (локальный кэш разбора — токен спрашивают на каждую запись) */
/* ------------------------------------------------------------------ */

let cachedRaw: string | null = null;
let cachedStore: SpaceTokenStore = emptySpaceTokens();

function readRaw(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(SPACE_TOKENS_KEY) : null;
  } catch {
    return null;
  }
}

export function readSpaceTokens(): SpaceTokenStore {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStore = parseSpaceTokens(raw);
  }
  return cachedStore;
}

export function writeSpaceTokens(store: SpaceTokenStore): SpaceTokenStore {
  const next: SpaceTokenStore = { version: 1, items: store.items.slice(0, MAX_SPACE_TOKENS) };
  const text = serializeSpaceTokens(next);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SPACE_TOKENS_KEY, text);
  } catch {
    /* нет места — приглашение всё равно не должно ронять экран */
  }
  cachedRaw = text;
  cachedStore = next;
  return next;
}

/** Сброс кэша (тесты, ручная правка ключа). */
export function _resetSpaceTokensCache(): void {
  cachedRaw = null;
  cachedStore = emptySpaceTokens();
}

export function spaceTokenRecord(spaceId: string): SpaceTokenRecord | null {
  if (!spaceId || spaceId === 'home') return null;
  return readSpaceTokens().items.find(r => r.spaceId === spaceId) ?? null;
}

/** Токен, под которым обязаны синхронизироваться данные пространства (после переноса). */
export function spaceTokenFor(spaceId: string): string | null {
  const rec = spaceTokenRecord(spaceId);
  return rec && rec.migratedAt && !rec.revokedAt ? rec.token : null;
}

/** Все записи, включая отозванные (могилы нужны объединению реестра). */
export function listSpaceTokens(): SpaceTokenRecord[] {
  return readSpaceTokens().items;
}

/** Только живые токены: отозванные не участвуют ни в синке, ни в интерфейсе. */
export function listLiveSpaceTokens(): SpaceTokenRecord[] {
  return readSpaceTokens().items.filter(r => !r.revokedAt);
}

/** Вставить/заменить запись (используется при подключении и смене кода). */
export function writeSpaceTokenRecord(rec: SpaceTokenRecord): SpaceTokenRecord | null {
  const stamped = { ...rec, updatedAt: new Date().toISOString() };
  const normalized = normalizeRecord(stamped);
  if (!normalized) return null;
  const store = readSpaceTokens();
  const items = store.items.filter(r => r.spaceId !== normalized.spaceId);
  items.push(normalized);
  writeSpaceTokens({ version: 1, items });
  return normalized;
}

export interface EnsureTokenOptions {
  label?: string;
  role?: SpaceTokenRole;
  /** Задать готовый токен (подключение по коду). */
  token?: string;
  /** Отметить перенос данных завершённым (подключение по коду). */
  migratedAt?: string;
}

/**
 * Вернуть токен пространства, создав его при необходимости.
 * `created` — чтобы интерфейс мог сказать «код создан», а не «уже был».
 */
export function ensureSpaceToken(
  spaceId: string,
  opts: EnsureTokenOptions = {},
): { record: SpaceTokenRecord | null; created: boolean } {
  if (!isValidSpaceId(spaceId)) return { record: null, created: false };
  const current = spaceTokenRecord(spaceId);
  // Отозванный токен — как его отсутствие: «Создать код» выдаёт новый.
  const existing = current && !current.revokedAt ? current : null;
  if (existing) {
    const patch: SpaceTokenRecord = {
      ...existing,
      ...(opts.label ? { label: opts.label } : {}),
      ...(opts.migratedAt ? { migratedAt: opts.migratedAt } : {}),
    };
    if (!existing.migratedAt && opts.token && isValidSyncToken(opts.token)) {
      // Подключение по коду: чужой токен главнее локальной заготовки.
      patch.token = opts.token;
    }
    const saved = writeSpaceTokenRecord(patch);
    return { record: saved, created: false };
  }
  const token = opts.token && isValidSyncToken(opts.token) ? opts.token : randomSyncToken();
  const rec: SpaceTokenRecord = {
    spaceId,
    token,
    role: opts.role ?? 'coach',
    ...(opts.label ? { label: opts.label } : {}),
    createdAt: new Date().toISOString(),
    ...(opts.migratedAt ? { migratedAt: opts.migratedAt } : {}),
  };
  const saved = writeSpaceTokenRecord(rec);
  return { record: saved, created: !!saved };
}

export function markSpaceTokenMigrated(spaceId: string, at?: string): void {
  const existing = spaceTokenRecord(spaceId);
  if (!existing || existing.revokedAt) return;
  writeSpaceTokenRecord({ ...existing, migratedAt: at ?? new Date().toISOString() });
}

/**
 * Отозвать токен. Запись остаётся могилой (`revokedAt`), а не исчезает:
 * иначе другое устройство тренера, у которого ещё лежит живая копия реестра,
 * вернуло бы отозванный токен при объединении.
 */
export function removeSpaceToken(spaceId: string): void {
  const existing = spaceTokenRecord(spaceId);
  if (!existing || existing.revokedAt) return;
  writeSpaceTokenRecord({ ...existing, revokedAt: new Date().toISOString() });
}

export function removeSpaceTokens(spaceIds: readonly string[]): void {
  for (const id of spaceIds) removeSpaceToken(id);
}

/**
 * Объединить реестр с облачной копией (по одному пространству).
 *
 * Реестр синкается одним ключом, поэтому «последний писавший» затирал бы
 * токены, созданные на ДРУГОМ устройстве. Объединение сохраняет оба; при
 * конфликте по одному пространству побеждает более поздняя запись, а могила
 * отзыва всегда новее живого токена, который она отзывает.
 *
 * `changed` — объединённый текст отличается от облачного, значит его надо
 * поднять обратно в облако (иначе второе устройство не узнает о токене).
 */
export function mergeSpaceTokens(
  localRaw: string | null | undefined,
  remoteRaw: string | null | undefined,
): { store: SpaceTokenStore; text: string; changed: boolean } {
  const bySpace = new Map<string, SpaceTokenRecord>();
  for (const r of parseSpaceTokens(localRaw).items) bySpace.set(r.spaceId, r);
  for (const r of parseSpaceTokens(remoteRaw).items) {
    const cur = bySpace.get(r.spaceId);
    if (!cur) {
      bySpace.set(r.spaceId, r);
      continue;
    }
    const a = Date.parse(cur.updatedAt || cur.createdAt) || 0;
    const b = Date.parse(r.updatedAt || r.createdAt) || 0;
    if (b >= a) bySpace.set(r.spaceId, r);
  }
  const store: SpaceTokenStore = {
    version: 1,
    items: [...bySpace.values()].slice(0, MAX_SPACE_TOKENS),
  };
  const text = serializeSpaceTokens(store);
  return { store, text, changed: text !== String(remoteRaw ?? '') };
}

/* ------------------------------------------------------------------ */
/* Код приглашения                                                     */
/* ------------------------------------------------------------------ */

/**
 * Формат: `BBA1.<spaceId>.<token>.<a|с>.<label>`
 *
 * Почему текст, а не JSON+base64: код вставляют руками/пересылают в мессенджере,
 * и его должно быть видно глазами (префикс, пространство, тип). Подпись идёт
 * последней и может содержать что угодно — её кодирует `encodeURIComponent`.
 */
export function encodeSpaceInvite(rec: SpaceTokenRecord): string {
  const role = rec.role === 'athlete' ? 'a' : 'c';
  const label = rec.label ? '.' + encodeURIComponent(rec.label) : '';
  return `${INVITE_PREFIX}.${rec.spaceId}.${rec.token}.${role}${label}`;
}

export type InviteError = 'empty' | 'format' | 'space' | 'token' | 'label';

export interface DecodedInvite {
  spaceId: string;
  token: string;
  role: SpaceTokenRole;
  label?: string;
}

export function decodeSpaceInvite(code: string): { ok: true; invite: DecodedInvite } | { ok: false; error: InviteError } {
  const text = String(code ?? '').trim();
  if (!text) return { ok: false, error: 'empty' };
  const m = /^BBA1\.([^.]+)\.([^.]+)\.([ac])(?:\.(.*))?$/.exec(text);
  if (!m) return { ok: false, error: 'format' };
  const spaceId = m[1];
  const token = m[2].toLowerCase();
  if (!isValidSpaceId(spaceId)) return { ok: false, error: 'space' };
  if (!isValidSyncToken(token)) return { ok: false, error: 'token' };
  let label: string | undefined;
  if (m[4]) {
    try {
      label = decodeURIComponent(m[4]).trim().slice(0, 60);
    } catch {
      return { ok: false, error: 'label' };
    }
    if (!label) label = undefined;
  }
  return { ok: true, invite: { spaceId, token, role: m[3] === 'a' ? 'athlete' : 'coach', ...(label ? { label } : {}) } };
}

/** Понятный текст ошибки — без технических кодов в интерфейсе. */
export function inviteErrorText(error: InviteError): string {
  switch (error) {
    case 'empty':
      return 'Вставьте код, который прислал тренер.';
    case 'format':
      return 'Это не код приглашения: он начинается с BBA1 и состоит из четырёх частей.';
    case 'space':
      return 'В коде повреждено имя пространства — попросите новый код.';
    case 'token':
      return 'В коде повреждён ключ доступа — попросите новый код.';
    case 'label':
      return 'В коде повреждена подпись — попросите новый код.';
    default:
      return 'Код не подошёл.';
  }
}
