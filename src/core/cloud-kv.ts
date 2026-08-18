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

export const CHUNK_SIZE = 100_000;
const PULL_PAGE = 1000;
export const PULL_TIMEOUT_MS = 3000;
export const FLUSH_DELAY_MS = 2500;
export const PULL_INTERVAL_MS = 30_000;
const KEEPALIVE_MAX_BYTES = 48_000;
export const META_KEY = 'he_sync_meta_v1';
const CONFLICT_WINDOW_MS = 500;

/** IndexedDB-хранилища с реальными пользовательскими данными (анализы, курс, дневник силы). */
export const IDB_STORES = ['labs_log', 'course_log', 'workout_log', 'training_log'] as const;
const IDB_META_KEY = 'he_sync_meta_idb_v1';
const IDB_KV_PREFIX = 'idb:';

/** Ключи, которые НЕ синхронизируются (сессия/ключи шифрования/синк-внутренности). */
export const EXCLUDED_KEYS = new Set(['he_session_v2', 'he_crypto_key', 'he_last_active', META_KEY, IDB_META_KEY]);
export const EXCLUDED_PREFIXES = ['he_sync_ts_', 'he_draft_', 'he_nav_', 'he_admin_'];

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
  if (!tgId && !opts?.transport) {
    setState({ status: 'off', error: undefined });
    return state;
  }
  installHook();
  try {
    token = opts?.token || (await deriveSyncToken(tgId));
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
  reloadFn = () => { try { if (typeof location !== 'undefined') location.reload(); } catch { /* no-op */ } };
  if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null; }
  if (metaTimer != null) { clearTimeout(metaTimer); metaTimer = null; }
  if (pullInterval != null) { clearInterval(pullInterval); pullInterval = null; }
  if (installed && origSetItem && origRemoveItem && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem = origSetItem;
      localStorage.removeItem = origRemoveItem;
    } catch { /* no-op */ }
    installed = false;
  }
  state = { status: 'off' };
  listeners.clear();
}

/* ------------------------------------------------------------------ */
/* Чистые хелперы (покрыты тестами)                                    */
/* ------------------------------------------------------------------ */

export function isKvExcludedKey(k: string): boolean {
  if (EXCLUDED_KEYS.has(k)) return true;
  for (const p of EXCLUDED_PREFIXES) {
    if (k.startsWith(p)) return true;
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

function markDirty(k: string): void {
  if (!started || !token || isKvExcludedKey(k)) return;
  mtimes.set(k, serverNowMs());
  dirty.add(k);
  persistMeta();
  scheduleFlush();
}

function markRemoved(k: string): void {
  if (!started || !token || isKvExcludedKey(k)) return;
  mtimes.delete(k);
  dirty.add(k);
  persistMeta();
  scheduleFlush();
}

function installHook(): void {
  if (installed || typeof localStorage === 'undefined' || !origSetItem || !origRemoveItem) return;
  installed = true;
  localStorage.setItem = (k, v) => {
    origSetItem(k, v);
    markDirty(k);
  };
  localStorage.removeItem = (k) => {
    origRemoveItem(k);
    markRemoved(k);
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
  return IDB_KV_PREFIX + store + ':' + id;
}

function parseIdbKvKey(k: string): { store: string; id: string } | null {
  if (!k.startsWith(IDB_KV_PREFIX)) return null;
  const rest = k.slice(IDB_KV_PREFIX.length);
  const i = rest.indexOf(':');
  if (i <= 0 || i === rest.length - 1) return null;
  return { store: rest.slice(0, i), id: rest.slice(i + 1) };
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
    remoteKeys.add(k);
    const parsed = parseIdbKvKey(k);
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
      // localSig !== prev.sig → локальная правка: победит pushIdb
    }
  }
  // удаления в облаке: локально не менялось → применяем
  for (const [kvKey, meta] of idbMeta) {
    if (remoteKeys.has(kvKey)) continue;
    const parsed = parseIdbKvKey(kvKey);
    if (!parsed) continue;
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
  try {
    // onServerNow калибрует skewMs ДО обработки строк (часы сервера — источник правды)
    await transport.pull(
      token,
      r => rows.push(...r),
      serverNow => { skewMs = serverNow - Date.now(); },
    );
  } catch (e) {
    setState({ status: 'error', error: (e as Error)?.message || 'pull failed' });
    return 0;
  }
  const byKey = new Map<string, KvRow[]>();
  for (const r of rows) {
    const list = byKey.get(r.key) || [];
    list.push(r);
    byKey.set(r.key, list);
  }
  let applied = 0;
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
    const winner = pickConflict(mtimes.get(k) || 0, remoteTs);
    if (winner === 'remote') {
      localStorage.setItem(k, value);
      mtimes.set(k, remoteTs);
      dirty.delete(k);
      applied++;
    } else if (winner === 'local') {
      dirty.add(k);
    }
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

/** Локальные ключи, которых нет ни в облаке, ни в mtimes (никогда не синкались) → выгрузить. */
function reconcileLocalKeys(remoteByKey: Map<string, KvRow[]>): void {
  if (typeof localStorage === 'undefined') return;
  const remoteKeys = new Set(remoteByKey.keys());
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('he_') || isKvExcludedKey(k)) continue;
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
