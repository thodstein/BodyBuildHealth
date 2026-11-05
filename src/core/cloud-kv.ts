/**
 * cloud-kv.ts — облачная синхронизация localStorage (ключи he_*) через Supabase
 * (таблица user_kv), привязанная к аккаунту Telegram.
 *
 * Принцип:
 * - идентификация: внутри Telegram Mini App Telegram сам сообщает id пользователя
 *   (одинаковый на телефоне и ПК) — никаких логинов/паролей;
 * - sync-токен: tk_<sha256(VITE_CRYPTO_KEY + ':' + tgId)> — отправляется заголовком
 *   x-user-token, RLS на стороне Supabase отдаёт пользователю только его строки;
 * - pull: при входе скачиваются все ключи пользователя, конфликт решается
 *   last-write-wins (по времени изменения каждого ключа);
 * - push: перехватываются setItem/removeItem localStorage → изменённые ключи
 *   уезжают в облако с задержкой ~2.5с, при уходе со страницы — keepalive-запрос;
 * - крупные значения (фото) режутся на чанки ~100k символов; реальный chunk_count
 *   пишется только в чанк 0, неполная запись на pull пропускается и «залечивается»
 *   устройством с более свежими данными.
 *
 * Ограничение безопасности (важно): VITE_CRYPTO_KEY лежит в клиентском бандле,
 * поэтому токен защищает от случайного доступа, но не от целенаправленного
 * извлечения ключа. Для много-пользовательской безопасности следующий шаг —
 * edge function, верифицирующая Telegram initData серверным TELEGRAM_BOT_TOKEN.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from './db';
import {
  DATA_SPACE_KEY,
  HOME_SPACE_ID,
  currentSpaceId,
  spaceIdOfKey,
  spaceKeyPrefix,
  toLogicalKey,
  toPhysicalKey,
} from './data-space';
import { setSpacePurgeHandler } from './space-purge';
import { COACH_AUDIT_KEY, mergeCoachAudit, serializeCoachAudit } from '../engines/coach/coach-audit.engine';

export const CHUNK_SIZE = 100_000;
const PULL_PAGE = 1000;
export const PULL_TIMEOUT_MS = 3000;
export const FLUSH_DELAY_MS = 2500;
export const PULL_INTERVAL_MS = 30_000;
const KEEPALIVE_MAX_BYTES = 48_000;
export const META_KEY = 'he_sync_meta_v1';
const CONFLICT_WINDOW_MS = 500;

/** IndexedDB-хранилища с реальными пользовательскими данными (анализы, курс, дневник силы). */
export const IDB_STORES = ['labs_log', 'course_log', 'workout_log', 'training_log', 'cardio_sessions'] as const;
const IDB_META_KEY = 'he_sync_meta_idb_v1';
const IDB_KV_PREFIX = 'idb:';

/** Ключ локально хранимого tg-токена после привязки АПК кодом (не синкается). */
export const LINKED_TG_TOKEN_KEY = 'he_sync_tg_token_v1';

/** Ключи, которые НЕ синхронизируются (сессия/ключи шифрования/синк-внутренности). */
export const EXCLUDED_KEYS = new Set([
  'he_session_v2',
  'he_crypto_key',
  'he_last_active',
  // PIN режима тренера — свойство УСТРОЙСТВА, а не аккаунта. Синкать хэш PIN
  // значит: включил на телефоне — заблокировал себя на планшете, а слабый
  // хэш (на старых WebView) уехал бы в облако. Граница защиты — устройство.
  'he_coach_lock',
  // Реестр пространств — свойство УСТРОЙСТВА. Если его синкать, переключение на
  // атлета уедет в облако и на другом устройстве приложение откроется «в
  // пространстве атлета», которого там нет: пустой профиль вместо своих данных.
  DATA_SPACE_KEY,
  META_KEY,
  IDB_META_KEY,
  LINKED_TG_TOKEN_KEY,
]);
export const EXCLUDED_PREFIXES = ['he_sync_ts_', 'he_draft_', 'he_nav_', 'he_admin_', 'he_data_space_'];

export interface KvRow {
  id: string;
  key: string;
  chunk_index: number;
  chunk_count: number;
  value: string;
  updated_at: string;
}

export type KvSyncStatus = 'off' | 'idle' | 'syncing' | 'error';

export interface KvSyncState {
  status: KvSyncStatus;
  lastSyncAt?: number;
  lastPullAt?: number;
  error?: string;
  /** Появились данные с другого устройства — ждут перезагрузки/применения пользователем. */
  pendingUpdate?: { applied: number; at: number };
}

/** Транспорт вынесен в интерфейс — тесты подставляют фейковый. */
export interface KvTransport {
  pull(token: string, onRows: (rows: KvRow[]) => void, onServerNow?: (ms: number) => void): Promise<void>;
  replaceKey(rows: KvRow[]): Promise<void>;
  removeKey(token: string, key: string): Promise<void>;
  /** Пачкой: все ключи с префиксом (нужно для «удалил данные атлета»). */
  removePrefix?(token: string, prefix: string): Promise<void>;
  keepAlivePush(rows: KvRow[]): void;
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let state: KvSyncState = { status: 'off' };
const listeners = new Set<(s: KvSyncState) => void>();

let token = '';
let transport: KvTransport | null = null;
let started = false;
let flushing = false;
let lifecycleAttached = false;

let idbBusy = false;
let idbEnabled = false;

/** Адаптер IndexedDB — тесты подставляют фейковый. */
export interface IdbAdapter {
  getAll(store: string): Promise<any[]>;
  get(store: string, id: string): Promise<any | undefined>;
  put(store: string, rec: any): Promise<void>;
  delete(store: string, id: string): Promise<void>;
}

const defaultIdbAdapter: IdbAdapter = {
  async getAll(store) {
    try { return (await db.getAll(store)) || []; } catch { return []; }
  },
  async get(store, id) {
    try { return await db.get(store, id); } catch { return undefined; }
  },
  async put(store, rec) {
    try { await db.put(store, rec); } catch { /* DB not init */ }
  },
  async delete(store, id) {
    try { await db.delete(store, id); } catch { /* DB not init */ }
  },
};

let idbAdapter: IdbAdapter = defaultIdbAdapter;

/** Серверные часы (калибруются из HTTP Date-заголовка при pull). */
let skewMs = 0;

/** key → локальный mtime (мс). Персистится в he_sync_meta_v1. */
let mtimes = new Map<string, number>();
const dirty = new Set<string>();

/** IndexedDB: kvKey (idb:<store>:<id>) → { sig, ts, deleted? } — последняя известная сигнатура и время. */
let idbMeta = new Map<string, { sig: string; ts: number; deleted?: boolean }>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let metaTimer: ReturnType<typeof setTimeout> | null = null;
let pullInterval: ReturnType<typeof setInterval> | null = null;

let reloadFn: () => void = () => {
  try { if (typeof location !== 'undefined') location.reload(); } catch { /* no-op */ }
};

let installed = false;
const origSetItem = typeof localStorage !== 'undefined' ? localStorage.setItem.bind(localStorage) : null;
const origRemoveItem = typeof localStorage !== 'undefined' ? localStorage.removeItem.bind(localStorage) : null;
const origGetItem = typeof localStorage !== 'undefined' ? localStorage.getItem.bind(localStorage) : null;

/**
 * Методы, которые оборачивает хук. Снимаем их В МОМЕНТ установки хука, а не при
 * импорте модуля: к этому времени шов пространств данных уже стоит (он ставится
 * первым импортом приложения), поэтому цепочка получается
 * «хук синка → шов пространств → сырое хранилище». Если снять методы при импорте,
 * хук мог бы писать в домашнее пространство даже под атлетом.
 */
let hookOrig: {
  set: ((k: string, v: string) => void) | null;
  remove: ((k: string) => void) | null;
  get: ((k: string) => string | null) | null;
} = { set: origSetItem, remove: origRemoveItem, get: origGetItem };

/** Признак «пишем сами из pull()» — такие записи не считаются локальной правкой. */
let applyingRemote = false;

/** Признак «идёт сетевой pull» — правки, сделанные в это время, не должны затираться. */
let pulling = false;
const dirtyDuringPull = new Set<string>();

/* ------------------------------------------------------------------ */
/* Публичное API                                                       */
/* ------------------------------------------------------------------ */

export function onKvSyncStatus(cb: (s: KvSyncState) => void): () => void {
  listeners.add(cb);
  cb(state);
  return () => { listeners.delete(cb); };
}

export function getKvSyncState(): KvSyncState {
  return { ...state };
}

export function isKvSyncEnabled(): boolean {
  return state.status !== 'off';
}

/** Настроено ли облако в этой сборке (есть URL и anon-ключ Supabase). */
export function isKvCloudConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON);
}

/** Прочитать сохранённый tg-токен привязки АПК (null — не привязано). */
export function getLinkedTgToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const v = localStorage.getItem(LINKED_TG_TOKEN_KEY);
    return v && v.startsWith('tk_') ? v : null;
  } catch {
    return null;
  }
}

/** Сохранить tg-токен после ввода кода (не синкается — в EXCLUDED_KEYS). */
export function saveLinkedTgToken(tgToken: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!tgToken || !tgToken.startsWith('tk_')) return;
    localStorage.setItem(LINKED_TG_TOKEN_KEY, tgToken);
  } catch { /* quota — честно никак */ }
}

/** Отвязать АПК от ТГ-аккаунта (локальные данные остаются, облако больше не тянется). */
export function clearLinkedTgToken(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(LINKED_TG_TOKEN_KEY);
  } catch { /* no-op */ }
}

/**
 * Инициализация синка. Вызывается после успешного входа (auth-module).
 * userId — локальный id пользователя вида 'tg_<telegramId>'.
 */
export async function initKvSync(
  userId: string,
  opts?: {
    transport?: KvTransport;
    token?: string;
    flushDelayMs?: number;
    pullIntervalMs?: number;
    reloadFn?: () => void;
    idbAdapter?: IdbAdapter;
  },
): Promise<KvSyncState> {
  const hasEnv = !!(SUPABASE_URL && SUPABASE_ANON);
  if (!opts?.transport && !hasEnv) {
    setState({ status: 'off', error: undefined });
    return state;
  }
  const tgId = userId.startsWith('tg_') ? userId.slice(3) : '';
  // Один аккаунт = один токен: `tg_<id>` у Telegram, `dev_<uuid>` у АПК/веба.
  // Явный токен (привязка кодом) главнее — устройство становится вторым экраном
  // того же Telegram-аккаунта.
  const identity = tgId || userId.trim();
  if (!identity && !opts?.token && !opts?.transport) {
    setState({ status: 'off', error: undefined });
    return state;
  }
  installHook();
  // «Удалил данные атлета» должно унести и облачную копию: локальная очистка
  // просит об этом через крошечный канал (space-purge), чтобы экран профиля не
  // тянул supabase-js.
  setSpacePurgeHandler(async ids => { await purgeSpacesFromCloud(ids); });
  try {
    token = opts?.token || (identity ? await deriveSyncToken(identity) : '');
    if (!token) {
      setState({ status: 'off', error: undefined });
      return state;
    }
    if (opts?.transport) {
      transport = opts.transport;
    } else {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { 'x-user-token': token } },
      });
      transport = new SupabaseKvTransport(client);
    }
  } catch (e) {
    setState({ status: 'error', error: (e as Error)?.message || 'kv init failed' });
    return state;
  }
  loadMeta();
  loadIdbMeta();
  started = true;
  const flushDelay = opts?.flushDelayMs ?? FLUSH_DELAY_MS;
  setFlushDelay(flushDelay);
  if (opts?.reloadFn) reloadFn = opts.reloadFn;
  if (opts?.idbAdapter) idbAdapter = opts.idbAdapter;
  idbEnabled = true;
  await pullWithTimeout();
  void flush();
  attachLifecycle(opts?.pullIntervalMs ?? PULL_INTERVAL_MS);
  setState({ status: 'idle', lastPullAt: state.lastPullAt, error: undefined });
  return state;
}

/** Принудительная загрузка из облака (фоновый pull; при новых данных — флаг pendingUpdate). */
export async function pullKvNow(): Promise<number> {
  return pull({ reload: true });
}

/** Принудительная выгрузка изменённых ключей. */
export async function flushKvNow(): Promise<void> {
  await flush();
}

/**
 * Явный touch ключей для кнопок «синхронизировать сейчас».
 * Обходит value-diff (перезапись теми же данными иначе не считается правкой —
 * анти-отскок), поэтому вызывать ТОЛЬКО по жесту пользователя, не в эффектах.
 * Исключённые ключи молча пропускаются.
 */
export function touchKvKeys(keys: string[]): void {
  try {
    let touched = false;
    for (const k of keys || []) {
      if (typeof k !== 'string' || !k) continue;
      const sk = syncKey(k);
      if (isKvExcludedKey(toLogicalKey(sk))) continue;
      dirty.add(sk);
      touched = true;
    }
    if (touched) scheduleFlush();
  } catch { /* no-op */ }
}

/** Принудительная синхронизация (кнопка в шапке): выгрузка локального + загрузка из облака. */
export async function syncKvNow(): Promise<number> {
  await flush();
  return pullKvNow();
}

/** Локальные ключи текущего пространства, которые имеют право уехать в облако. */
function collectPushableKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('he_')) continue;
      if (isKvExcludedKey(toLogicalKey(k))) continue;
      // Чужие пространства не трогаем: их ключи уедут, когда в них зайдут.
      if (!_ownsKvKey(k)) continue;
      out.push(k);
    }
  } catch { /* нет localStorage — нечего выгружать */ }
  return out;
}

/** Сколько локальных ключей готовы к выгрузке (для подписи кнопки в UI). */
export function countPushableKvKeys(): number {
  return collectPushableKeys().length;
}

/**
 * Полная повторная выгрузка текущего пространства.
 *
 * Зачем отдельно от `syncKvNow`: обычный flush отправляет только «грязные»
 * ключи, а их правка отслеживается по значению. Если облако получило версию,
 * которую локально уже не считают изменённой (ручные правки через экспорт,
 * сбой ровно между записью и выгрузкой), синхронизация навсегда расходится —
 * обе стороны молчат. Здесь мы честно помечаем ВСЁ изменённым и перезаписываем
 * облако локальной версией (локальные данные — источник правды по кнопке).
 */
export async function forcePushAllKv(): Promise<number> {
  if (!started || !token) return 0;
  const keys = collectPushableKeys();
  if (!keys.length) return 0;
  const now = serverNowMs();
  for (const k of keys) {
    dirty.add(k);
    mtimes.set(k, now);
  }
  persistMeta();
  await flush();
  return keys.length;
}

/** Best-effort выгрузка маленьких изменений (pagehide/beforeunload). */
export function flushKvKeepAlive(): void {
  keepAliveFlush();
}

/** Перезагрузка приложения по кнопке «Обновить» (данные уже записаны локально). */
export function reloadKvView(): void {
  try { reloadFn(); } catch { /* no-op */ }
}

/** Снять флаг «есть обновления» (например, после нажатия ✕ в баннере). */
export function clearKvPendingUpdate(): void {
  if (state.pendingUpdate) setState({ ...state, pendingUpdate: undefined });
}

/** Сброс состояния (используется только в тестах). */
export function _resetKvForTests(): void {
  started = false;
  flushing = false;
  token = '';
  transport = null;
  dirty.clear();
  mtimes = new Map();
  lifecycleAttached = false;
  skewMs = 0;
  idbAdapter = defaultIdbAdapter;
  idbBusy = false;
  idbEnabled = false;
  idbMeta = new Map();
  state = { status: 'off' };
  setSpacePurgeHandler(null);
  applyingRemote = false;
  pulling = false;
  dirtyDuringPull.clear();
  reloadFn = () => { try { if (typeof location !== 'undefined') location.reload(); } catch { /* no-op */ } };
  if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null; }
  if (metaTimer != null) { clearTimeout(metaTimer); metaTimer = null; }
  if (pullInterval != null) { clearInterval(pullInterval); pullInterval = null; }
  if (installed && typeof localStorage !== 'undefined') {
    try {
      // Возвращаем ровно те методы, которые обернули (под швом — методы шва).
      localStorage.setItem = hookOrig.set ?? origSetItem ?? localStorage.setItem;
      localStorage.removeItem = hookOrig.remove ?? origRemoveItem ?? localStorage.removeItem;
    } catch { /* no-op */ }
    installed = false;
  }
  hookOrig = { set: origSetItem, remove: origRemoveItem, get: origGetItem };
  state = { status: 'off' };
  listeners.clear();
}

/* ------------------------------------------------------------------ */
/* Чистые хелперы (покрыты тестами)                                    */
/* ------------------------------------------------------------------ */

export function isKvExcludedKey(k: string): boolean {
  // Ключ может прийти физическим (из облака): исключения заданы логическими именами.
  const key = toLogicalKey(k);
  if (EXCLUDED_KEYS.has(key)) return true;
  for (const p of EXCLUDED_PREFIXES) {
    if (key.startsWith(p)) return true;
  }
  return false;
}

/** Разбивка строки на чанки без разрыва суррогатных пар (эмодзи). */
export function chunkValue(value: string): string[] {
  if (value.length <= CHUNK_SIZE) return [value];
  const chunks: string[] = [];
  let i = 0;
  while (i < value.length) {
    let end = Math.min(i + CHUNK_SIZE, value.length);
    if (end < value.length) {
      const c = value.charCodeAt(end - 1);
      if (c >= 0xd800 && c <= 0xdbff) end -= 1;
    }
    chunks.push(value.slice(i, end));
    i = end;
  }
  return chunks;
}

export function joinChunks(rows: KvRow[]): string {
  return rows
    .slice()
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map(r => r.value)
    .join('');
}

export function pickConflict(localMtimeMs: number, remoteTsMs: number): 'local' | 'remote' | 'none' {
  if (localMtimeMs === 0) return remoteTsMs > 0 ? 'remote' : 'none';
  if (remoteTsMs === 0) return 'local';
  const diff = remoteTsMs - localMtimeMs;
  if (diff > CONFLICT_WINDOW_MS) return 'remote';
  if (diff < -CONFLICT_WINDOW_MS) return 'local';
  return 'none';
}

/** Sync-токен: tk_<sha256(VITE_CRYPTO_KEY + ':' + tgId)>. Детерминированный. */
export async function deriveSyncToken(tgId: string): Promise<string> {
  const secret = import.meta.env.VITE_CRYPTO_KEY || 'he-cloud-kv-fallback-key';
  return 'tk_' + (await sha256Hex(secret + ':' + tgId));
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* Внутренняя логика                                                   */
/* ------------------------------------------------------------------ */

function setState(patch: Partial<KvSyncState>): void {
  state = { ...state, ...patch };
  listeners.forEach(l => { try { l(state); } catch { /* no-op */ } });
}

let flushDelayMs = FLUSH_DELAY_MS;
function setFlushDelay(ms: number): void {
  flushDelayMs = ms;
}

function serverNowMs(): number {
  return Date.now() + skewMs;
}

/**
 * Ключ синхронизации: логический ключ → физический (с пространством).
 * Без этого профиль атлета уезжал бы в облако под именем `he_profile_v2` и
 * затирал профиль тренера. Ключи устройства (`he_coach_*`, `he_sync_*`) не
 * меняются — они общие.
 */
function syncKey(k: string): string {
  return toPhysicalKey(currentSpaceId(), k);
}

/** Принадлежит ли ключ текущему пространству (а не другому атлету). */
export function _ownsKvKey(k: string): boolean {
  const space = currentSpaceId();
  if (k.startsWith(IDB_KV_PREFIX)) {
    const parsed = parseIdbKvKey(k);
    return !!parsed && parsed.space === space;
  }
  const physical = spaceIdOfKey(k);
  if (physical) return physical.spaceId === space;
  return space === HOME_SPACE_ID;
}

function markDirty(k: string): void {
  const sk = syncKey(k);
  if (!started || !token || isKvExcludedKey(toLogicalKey(sk))) return;
  mtimes.set(sk, serverNowMs());
  dirty.add(sk);
  persistMeta();
  scheduleFlush();
}

function markRemoved(k: string): void {
  const sk = syncKey(k);
  if (!started || !token || isKvExcludedKey(toLogicalKey(sk))) return;
  mtimes.delete(sk);
  dirty.add(sk);
  persistMeta();
  scheduleFlush();
}

function installHook(): void {
  if (installed || typeof localStorage === 'undefined') return;
  // Снимаем методы сейчас: под швом это методы шва (иначе писали бы в home).
  try {
    hookOrig = {
      set: localStorage.setItem.bind(localStorage),
      remove: localStorage.removeItem.bind(localStorage),
      get: localStorage.getItem.bind(localStorage),
    };
  } catch {
    return;
  }
  const origSet = hookOrig.set;
  const origRemove = hookOrig.remove;
  const origGet = hookOrig.get;
  if (!origSet || !origRemove || !origGet) return;
  installed = true;
  localStorage.setItem = (k, v) => {
    if (applyingRemote) {
      // запись из pull() — не локальная правка
      origSet(k, v);
      return;
    }
    let prev: string | null = null;
    try { prev = origGet(k); } catch { /* no-op */ }
    origSet(k, v);
    // значение не изменилось (перезапись теми же данными) — не считаем правкой,
    // иначе пустой flush с «свежим» временем затирал бы правки другого устройства
    if (prev === v) return;
    markDirty(k);
    // правка сделана, пока шёл сетевой pull — её нет в снимке облака, нельзя затирать
    if (pulling) dirtyDuringPull.add(syncKey(k));
  };
  localStorage.removeItem = (k) => {
    origRemove(k);
    markRemoved(k);
    if (pulling) dirtyDuringPull.add(syncKey(k));
  };
}

function scheduleFlush(): void {
  if (flushTimer != null || !started) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, flushDelayMs);
}

function persistMeta(): void {
  if (metaTimer != null) return;
  metaTimer = setTimeout(() => {
    metaTimer = null;
    writeMetaNow();
  }, 300);
}

function writeMetaNow(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const data = JSON.stringify(Object.fromEntries(mtimes));
    origSetItem ? origSetItem(META_KEY, data) : localStorage.setItem(META_KEY, data);
  } catch { /* quota — не критично */ }
}

function loadMeta(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      mtimes = new Map(Object.entries(obj).map(([k, v]) => [k, Number(v) || 0]));
    }
  } catch { mtimes = new Map(); }
}

/* ------------------------------------------------------------------ */
/* IndexedDB-синхронизация (анализы, курс, дневник силы)               */
/* ------------------------------------------------------------------ */

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function idbKvKey(store: string, id: string): string {
  const space = currentSpaceId();
  // home — исторический формат (`idb:store:id`): старые записи в облаке остаются валидными.
  return space === HOME_SPACE_ID
    ? IDB_KV_PREFIX + store + ':' + id
    : IDB_KV_PREFIX + space + ':' + store + ':' + id;
}

function parseIdbKvKey(k: string): { store: string; id: string; space: string } | null {
  if (!k.startsWith(IDB_KV_PREFIX)) return null;
  const rest = k.slice(IDB_KV_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length < 2) return null;
  // Домашний формат узнаём по имени стора: id записи может содержать двоеточия.
  const isStore = (name: string) => (IDB_STORES as readonly string[]).includes(name);
  if (isStore(parts[0])) {
    return { store: parts[0], id: parts.slice(1).join(':'), space: HOME_SPACE_ID };
  }
  if (parts.length >= 3 && isStore(parts[1])) {
    return { store: parts[1], id: parts.slice(2).join(':'), space: parts[0] };
  }
  return null;
}

function loadIdbMeta(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(IDB_META_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, { sig: string; ts: number }>;
      idbMeta = new Map(Object.entries(obj));
    }
  } catch { idbMeta = new Map(); }
}

function persistIdbMeta(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const data = JSON.stringify(Object.fromEntries(idbMeta));
    origSetItem ? origSetItem(IDB_META_KEY, data) : localStorage.setItem(IDB_META_KEY, data);
  } catch { /* quota — не критично */ }
}

/** Выгрузка изменённых/новых записей IndexedDB и удалений. */
async function pushIdb(): Promise<void> {
  if (!started || !transport || !token || !idbEnabled || idbBusy) return;
  idbBusy = true;
  let changed = false;
  try {
    const localKeys = new Set<string>();
    for (const store of IDB_STORES) {
      let recs: any[] = [];
      try { recs = await idbAdapter.getAll(store); } catch { continue; }
      for (const rec of recs) {
        const id = rec?.id;
        if (id == null) continue;
        const kvKey = idbKvKey(store, String(id));
        localKeys.add(kvKey);
        const sig = stableStringify(rec);
        const prev = idbMeta.get(kvKey);
        if (prev && prev.sig === sig) continue;
        const ts = new Date(serverNowMs()).toISOString();
        const chunks = chunkValue(JSON.stringify(rec));
        const rows: KvRow[] = chunks.map((c, i) => ({
          id: token,
          key: kvKey,
          chunk_index: i,
          chunk_count: i === 0 ? chunks.length : 0,
          value: c,
          updated_at: ts,
        }));
        await transport.replaceKey(rows);
        idbMeta.set(kvKey, { sig, ts: Date.parse(ts) });
        changed = true;
      }
    }
    // локальные удаления → удалить в облаке
    for (const [kvKey, meta] of idbMeta) {
      if (localKeys.has(kvKey)) continue;
      const parsed = parseIdbKvKey(kvKey);
      if (!parsed) { idbMeta.delete(kvKey); continue; }
      // Чужие пространства не трогаем: их записи не наши — удалять их из облака нельзя.
      if (parsed.space !== currentSpaceId()) continue;
      let localRec: any;
      try { localRec = await idbAdapter.get(parsed.store, parsed.id); } catch { localRec = undefined; }
      if (localRec) continue; // запись есть, просто цикл начался до неё — не трогаем
      await transport.removeKey(token, kvKey);
      idbMeta.delete(kvKey);
      changed = true;
    }
  } catch (e) {
    setState({ status: 'error', error: (e as Error)?.message || 'idb push failed' });
  } finally {
    idbBusy = false;
    if (changed) persistIdbMeta();
  }
}

/** Применение удалённых записей IndexedDB (LWW по сигнатуре). */
async function pullIdb(byKey: Map<string, KvRow[]>): Promise<number> {
  if (!started || !idbEnabled) return 0;
  let applied = 0;
  let metaChanged = false;
  const remoteKeys = new Set<string>();
  for (const [k, keyRows] of byKey) {
    if (!k.startsWith(IDB_KV_PREFIX)) continue;
    const parsed0 = parseIdbKvKey(k);
    // Записи других пространств не применяем в текущую базу: они приедут, когда
    // тренер откроет этого атлета. Иначе анализы атлета легли бы в чужие данные.
    if (!parsed0 || parsed0.space !== currentSpaceId()) continue;
    remoteKeys.add(k);
    const parsed = parsed0;
    if (!parsed || !IDB_STORES.includes(parsed.store as any)) continue;
    const count = keyRows.find(r => r.chunk_index === 0)?.chunk_count;
    if (!count || keyRows.filter(r => r.chunk_index < count).length !== count) continue;
    let rec: any;
    try { rec = JSON.parse(joinChunks(keyRows.filter(r => r.chunk_index < count))); } catch { continue; }
    if (!rec?.id) continue;
    const remoteTs = Math.max(...keyRows.map(r => Date.parse(r.updated_at) || 0));
    const localRec = await idbAdapter.get(parsed.store, String(rec.id));
    const remoteSig = stableStringify(rec);
    const prev = idbMeta.get(k);
    if (!localRec) {
      if (prev && prev.deleted) continue; // локально удалена — не воскрешаем
      if (prev) {
        // новая локальная правка-удаление: помечаем, выгрузку удаления сделает pushIdb
        idbMeta.set(k, { sig: prev.sig, ts: prev.ts, deleted: true });
        metaChanged = true;
        continue;
      }
      await idbAdapter.put(parsed.store, rec);
      idbMeta.set(k, { sig: remoteSig, ts: remoteTs });
      applied++;
      metaChanged = true;
    } else {
      const localSig = stableStringify(localRec);
      if (prev && prev.sig === localSig) {
        // локально не менялось с последней синхронизации — принимаем удалённую версию
        if (localSig !== remoteSig) {
          await idbAdapter.put(parsed.store, rec);
          idbMeta.set(k, { sig: remoteSig, ts: remoteTs });
          applied++;
          metaChanged = true;
        } else {
          idbMeta.set(k, { sig: localSig, ts: Math.max(prev.ts, remoteTs) });
          metaChanged = true;
        }
      }
      // prev отсутствует или localSig !== prev.sig → локальная версия побеждает (pushIdb)
    }
  }
  // удаления в облаке: локально не менялось → применяем
  for (const [kvKey, meta] of idbMeta) {
    if (remoteKeys.has(kvKey)) continue;
    const parsed = parseIdbKvKey(kvKey);
    if (!parsed) continue;
    // Удаления чужого пространства к нашей базе не применяем.
    if (parsed.space !== currentSpaceId()) continue;
    const localRec = await idbAdapter.get(parsed.store, parsed.id);
    if (!localRec) {
      idbMeta.delete(kvKey);
      metaChanged = true;
      continue;
    }
    if (stableStringify(localRec) === meta.sig) {
      await idbAdapter.delete(parsed.store, parsed.id);
      idbMeta.delete(kvKey);
      applied++;
      metaChanged = true;
    }
  }
  if (metaChanged) persistIdbMeta();
  return applied;
}

async function flush(): Promise<void> {
  if (!started || !transport || !token || flushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const keys = Array.from(dirty);
  if (!keys.length) return;
  flushing = true;
  setState({ status: 'syncing' });
  try {
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v === null) {
        await transport.removeKey(token, k);
        mtimes.delete(k);
      } else {
        const ts = new Date(mtimes.get(k) || serverNowMs()).toISOString();
        const chunks = chunkValue(v);
        const rows: KvRow[] = chunks.map((c, i) => ({
          id: token,
          key: k,
          chunk_index: i,
          chunk_count: i === 0 ? chunks.length : 0,
          value: c,
          updated_at: ts,
        }));
        await transport.replaceKey(rows);
      }
      dirty.delete(k);
    }
    writeMetaNow();
    setState({ status: 'idle', lastSyncAt: Date.now(), error: undefined });
    await pushIdb();
  } catch (e) {
    setState({ status: 'error', error: (e as Error)?.message || 'sync error' });
  } finally {
    flushing = false;
  }
}

async function pull(opts?: { reload?: boolean }): Promise<number> {
  if (!transport || !token) return 0;
  const rows: KvRow[] = [];
  pulling = true;
  try {
    // onServerNow калибрует skewMs ДО обработки строк (часы сервера — источник правды)
    await transport.pull(
      token,
      r => rows.push(...r),
      serverNow => { skewMs = serverNow - Date.now(); },
    );
  } catch (e) {
    pulling = false;
    dirtyDuringPull.clear();
    setState({ status: 'error', error: (e as Error)?.message || 'pull failed' });
    return 0;
  } finally {
    pulling = false;
  }
  const byKey = new Map<string, KvRow[]>();
  for (const r of rows) {
    const list = byKey.get(r.key) || [];
    list.push(r);
    byKey.set(r.key, list);
  }
  let applied = 0;
  applyingRemote = true;
  try {
    for (const [k, keyRows] of byKey) {
      if (k.startsWith(IDB_KV_PREFIX)) continue; // IndexedDB-записи обрабатывает pullIdb
      const count = keyRows.find(r => r.chunk_index === 0)?.chunk_count;
      if (!count || keyRows.filter(r => r.chunk_index < count).length !== count) {
        // неполная/битая запись в облаке: если локально данные есть — локальные новее,
        // выгружаем их (залечиваем облако)
        let hasLocal = false;
        try { hasLocal = localStorage.getItem(k) != null; } catch { hasLocal = false; }
        if (hasLocal) {
          if (!mtimes.has(k)) mtimes.set(k, serverNowMs());
          dirty.add(k);
        }
        continue;
      }
      const chunks = keyRows.filter(r => r.chunk_index < count);
      const value = joinChunks(chunks);
      const remoteTs = Math.max(...keyRows.map(r => Date.parse(r.updated_at) || 0));
      const localMtime = mtimes.get(k) || 0;
      // локальная правка сделана ПОКА шёл сетевой pull — её нет в снимке облака → локальная
      const winner = dirtyDuringPull.has(k) ? 'local' : pickConflict(localMtime, remoteTs);
      if (winner === 'remote') {
        // Журнал тренера — объединяем, а не затираем: два устройства пишут
        // события независимо, и «последний записавший» не должен съедать чужие.
        let nextValue = value;
        let mergedGrew = false;
        if (toLogicalKey(k) === COACH_AUDIT_KEY) {
          let localRaw: string | null = null;
          try { localRaw = localStorage.getItem(k); } catch { localRaw = null; }
          const mergedText = serializeCoachAudit(mergeCoachAudit(localRaw, value));
          if (mergedText !== value) {
            nextValue = mergedText;
            mergedGrew = true;
          }
        }
        localStorage.setItem(k, nextValue);
        mtimes.set(k, remoteTs);
        dirty.delete(k);
        if (mergedGrew) {
          // Слияние — локальная правка: поднимаем объединённое наверх, чтобы
          // второе устройство получило события, а не только первое.
          mtimes.set(k, serverNowMs());
          dirty.add(k);
          scheduleFlush();
        }
        applied++;
      } else if (winner === 'local') {
        dirty.add(k);
      }
    }
  } finally {
    applyingRemote = false;
    dirtyDuringPull.clear();
  }
  reconcileLocalKeys(byKey);
  writeMetaNow();
  applied += await pullIdb(byKey);
  setState({ status: 'idle', lastPullAt: Date.now(), error: undefined });
  // выгрузка локальных правок IndexedDB (изменения анализов/курса/дневника без LS-триггера)
  await pushIdb();
  if (opts?.reload && applied > 0) {
    console.debug('[kv] background pull applied', applied, 'keys — show update hint');
    // без авто-перезагрузки: данные уже записаны локально, ждём пользователя
    setState({ ...state, pendingUpdate: { applied, at: Date.now() } });
  }
  return applied;
}

/** Префиксы, под которыми в облаке лежат данные пространства (LS-ключи и записи IndexedDB). */
function spacePrefixes(spaceId: string): string[] {
  return [spaceKeyPrefix(spaceId), IDB_KV_PREFIX + spaceId + ':'];
}

/** Резервный путь, если транспорт не умеет удалять по префиксу: тянем строки и удаляем по одной. */
async function removeByPrefixFallback(prefix: string): Promise<void> {
  if (!transport || !token) return;
  const keys = new Set<string>();
  await transport.pull(token, rows => {
    for (const r of rows) if (r.key.startsWith(prefix)) keys.add(r.key);
  });
  let n = 0;
  for (const k of keys) {
    // Ограничение: удаление не должно превращаться в тысячи запросов на телефоне.
    if (n++ >= 500) break;
    await transport.removeKey(token, k);
  }
}

/**
 * Убрать из облака всё, что принадлежит пространству атлета.
 *
 * Нужно после локального «удалил данные атлета»: без этого удаление было бы
 * правдой только на этом телефоне, а копия осталась бы на сервере (и вернулась
 * бы на новом устройстве). Домашнее пространство не трогаем — это данные
 * тренера.
 */
export async function purgeSpacesFromCloud(spaceIds: readonly string[]): Promise<number> {
  if (!started || !transport || !token) return 0;
  const ids = (spaceIds || []).filter(id => !!id && id !== HOME_SPACE_ID);
  if (!ids.length) return 0;
  let purged = 0;
  for (const spaceId of ids) {
    const prefixes = spacePrefixes(spaceId);
    for (const prefix of prefixes) {
      try {
        if (transport.removePrefix) await transport.removePrefix(token, prefix);
        else await removeByPrefixFallback(prefix);
      } catch {
        // Транспорт не справился — пробуем по одной строке (и молчим: локальные
        // данные уже удалены, это «догоняющая» уборка).
        try { await removeByPrefixFallback(prefix); } catch { /* сеть недоступна */ }
      }
    }
    // Метаданные (mtime/dirty/сигнатуры IndexedDB) этого пространства больше не нужны:
    // иначе при следующем pull мы считали бы удалённые ключи «локально изменёнными».
    const hit = (k: string) => prefixes.some(p => k.startsWith(p));
    let metaChanged = false;
    for (const k of Array.from(mtimes.keys())) {
      if (!hit(k)) continue;
      mtimes.delete(k);
      dirty.delete(k);
      metaChanged = true;
    }
    let idbChanged = false;
    for (const k of Array.from(idbMeta.keys())) {
      if (!hit(k)) continue;
      idbMeta.delete(k);
      idbChanged = true;
    }
    if (metaChanged) persistMeta();
    if (idbChanged) persistIdbMeta();
    purged++;
  }
  return purged;
}

/** Локальные ключи, которых нет ни в облаке, ни в mtimes (никогда не синкались) → выгрузить. */
function reconcileLocalKeys(remoteByKey: Map<string, KvRow[]>): void {  if (typeof localStorage === 'undefined') return;
  const remoteKeys = new Set(remoteByKey.keys());
  for (let i = 0; i < localStorage.length; i++) {
    const logical = localStorage.key(i);
    if (!logical || !logical.startsWith('he_')) continue;
    // В облаке ключи лежат физическими (с пространством) — сравниваем как физические.
    const k = syncKey(logical);
    if (isKvExcludedKey(logical)) continue;
    if (!mtimes.has(k) && !remoteKeys.has(k)) {
      mtimes.set(k, serverNowMs());
      dirty.add(k);
    }
  }
}

async function pullWithTimeout(): Promise<void> {
  if (!transport || !token) return;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; }, PULL_TIMEOUT_MS);
  try {
    await pull(); // стартовый pull: reload не нужен — приложение ещё не отрисовано
  } catch { /* ошибка обработана внутри pull */ }
  if (!timedOut) clearTimeout(timer);
}

function keepAliveFlush(): void {
  if (!transport || !token || !dirty.size) return;
  const rows: KvRow[] = [];
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const k of dirty) {
    let v: string | null = null;
    try { v = localStorage.getItem(k); } catch { continue; }
    if (v == null) continue;
    const ts = new Date(mtimes.get(k) || serverNowMs()).toISOString();
    const total = encoder.encode(v).length + 48;
    // слишком большие ключи отправляет обычный flush (visibilitychange/pagehide);
    // keepalive-запрос лимитирован браузером (~64КБ)
    if (bytes + total > KEEPALIVE_MAX_BYTES) continue;
    const chunks = chunkValue(v);
    for (let i = 0; i < chunks.length; i++) {
      rows.push({
        id: token,
        key: k,
        chunk_index: i,
        chunk_count: i === 0 ? chunks.length : 0,
        value: chunks[i],
        updated_at: ts,
      });
    }
    bytes += total;
  }
  if (rows.length) {
    try { transport.keepAlivePush(rows); } catch { /* no-op */ }
  }
}

function attachLifecycle(pullIntervalMs: number): void {
  if (lifecycleAttached || typeof window === 'undefined') return;
  lifecycleAttached = true;
  window.addEventListener('online', () => {
    void pull({ reload: true });
    void flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      writeMetaNow();
      void flush();
      keepAliveFlush();
    } else {
      // вернулись в приложение → подтянуть изменения с другого устройства
      void pull({ reload: true });
      void flush();
    }
  });
  window.addEventListener('focus', () => {
    void pull({ reload: true });
    void flush();
  });
  // APK: WebView не всегда шлёт pagehide при сворачивании, а Capacitor знает
  // точно. Свернули/закрыли приложение — выгружаем накопленное; вернулись —
  // подтягиваем изменения с другого устройства.
  void (async () => {
    try {
      const { isCapacitorNative } = await import('./app-platform');
      if (!isCapacitorNative()) return;
      const { App } = await import('@capacitor/app');
      await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          void pull({ reload: true });
          void flush();
          return;
        }
        writeMetaNow();
        keepAliveFlush();
        void flush();
      });
    } catch {
      /* веб или плагин недоступен — хватает pagehide/visibilitychange */
    }
  })();
  window.addEventListener('pagehide', () => {
    writeMetaNow();
    keepAliveFlush();
  });
  window.addEventListener('beforeunload', () => {
    writeMetaNow();
    keepAliveFlush();
  });
  // фоновый цикл: pull + повторная попытка flush (застрявшие dirty-ключи)
  pullInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void pull({ reload: true });
    void flush();
  }, pullIntervalMs);
}

/* ------------------------------------------------------------------ */
/* Транспорт на Supabase REST                                          */
/* ------------------------------------------------------------------ */

class SupabaseKvTransport implements KvTransport {
  constructor(private client: SupabaseClient) {}

  async pull(token: string, onRows: (rows: KvRow[]) => void, onServerNow?: (ms: number) => void): Promise<void> {
    if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase not configured');
    let offset = 0;
    for (;;) {
      const qs = new URLSearchParams({
        select: '*',
        id: `eq.${token}`,
        order: 'key.asc,chunk_index.asc',
        limit: String(PULL_PAGE),
        offset: String(offset),
      });
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/user_kv?${qs.toString()}`, {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          'x-user-token': token,
          Accept: 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`pull failed: HTTP ${resp.status}`);
      // серверные часы из Date-заголовка — единый источник правды для LWW
      if (onServerNow) {
        const dateHeader = resp.headers.get('date');
        const serverNow = dateHeader ? Date.parse(dateHeader) : 0;
        if (serverNow) onServerNow(serverNow);
      }
      const data = (await resp.json()) as KvRow[];
      onRows(data || []);
      if (!data || data.length < PULL_PAGE) break;
      offset += PULL_PAGE;
    }
  }

  async replaceKey(rows: KvRow[]): Promise<void> {
    const key = rows[0]?.key;
    if (!key) return;
    const { error: delErr } = await this.client
      .from('user_kv')
      .delete()
      .eq('id', rows[0].id)
      .eq('key', key);
    if (delErr) throw new Error(delErr.message);
    const { error } = await this.client
      .from('user_kv')
      .upsert(rows, { onConflict: 'id,key,chunk_index' });
    if (error) throw new Error(error.message);
  }

  async removeKey(token: string, key: string): Promise<void> {
    const { error } = await this.client.from('user_kv').delete().eq('id', token).eq('key', key);
    if (error) throw new Error(error.message);
  }

  /**
   * Удаление всех ключей пространства одной операцией.
   * `_` и `%` в LIKE — шаблоны, а в ключах приложения их полно (`he_ath_...`):
   * без экранирования префикс мог бы зацепить соседние ключи.
   */
  async removePrefix(token: string, prefix: string): Promise<void> {
    const pattern = prefix.replace(/[\\%_]/g, m => '\\' + m) + '%';
    const { error } = await this.client.from('user_kv').delete().eq('id', token).like('key', pattern);
    if (error) throw new Error(error.message);
  }

  keepAlivePush(rows: KvRow[]): void {
    if (!SUPABASE_URL || !SUPABASE_ANON || !rows.length) return;
    void fetch(`${SUPABASE_URL}/rest/v1/user_kv?on_conflict=id,key,chunk_index`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
        'x-user-token': rows[0].id,
      },
      body: JSON.stringify(rows),
    }).catch(() => { /* best-effort */ });
  }
}
