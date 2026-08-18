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

export const CHUNK_SIZE = 100_000;
const PULL_PAGE = 1000;
export const PULL_TIMEOUT_MS = 3000;
export const FLUSH_DELAY_MS = 2500;
const KEEPALIVE_MAX_BYTES = 48_000;
export const META_KEY = 'he_sync_meta_v1';
const CONFLICT_WINDOW_MS = 500;

/** Ключи, которые НЕ синхронизируются (сессия/ключи шифрования/синк-внутренности). */
export const EXCLUDED_KEYS = new Set(['he_session_v2', 'he_crypto_key', 'he_last_active', META_KEY]);
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
}

/** Транспорт вынесен в интерфейс — тесты подставляют фейковый. */
export interface KvTransport {
  pull(token: string, onRows: (rows: KvRow[]) => void): Promise<void>;
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

/** key → локальный mtime (мс). Персистится в he_sync_meta_v1. */
let mtimes = new Map<string, number>();
const dirty = new Set<string>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let metaTimer: ReturnType<typeof setTimeout> | null = null;

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
  opts?: { transport?: KvTransport; token?: string; flushDelayMs?: number },
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
  started = true;
  const flushDelay = opts?.flushDelayMs ?? FLUSH_DELAY_MS;
  setFlushDelay(flushDelay);
  await pullWithTimeout();
  void flush();
  attachLifecycle();
  setState({ status: 'idle', lastPullAt: state.lastPullAt, error: undefined });
  return state;
}

/** Принудительная загрузка из облака (используется при online-событии). */
export async function pullKvNow(): Promise<number> {
  return pull();
}

/** Принудительная выгрузка изменённых ключей. */
export async function flushKvNow(): Promise<void> {
  await flush();
}

/** Best-effort выгрузка маленьких изменений (pagehide/beforeunload). */
export function flushKvKeepAlive(): void {
  keepAliveFlush();
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
  if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null; }
  if (metaTimer != null) { clearTimeout(metaTimer); metaTimer = null; }
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

function markDirty(k: string): void {
  if (!started || !token || isKvExcludedKey(k)) return;
  mtimes.set(k, Date.now());
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
        const ts = new Date(mtimes.get(k) || Date.now()).toISOString();
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
  } catch (e) {
    setState({ status: 'error', error: (e as Error)?.message || 'sync error' });
  } finally {
    flushing = false;
  }
}

async function pull(): Promise<number> {
  if (!transport || !token) return 0;
  const rows: KvRow[] = [];
  try {
    await transport.pull(token, r => rows.push(...r));
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
    const count = keyRows.find(r => r.chunk_index === 0)?.chunk_count;
    if (!count || keyRows.filter(r => r.chunk_index < count).length !== count) {
      // неполная/битая запись в облаке: если локально данные есть — локальные новее,
      // выгружаем их (залечиваем облако)
      let hasLocal = false;
      try { hasLocal = localStorage.getItem(k) != null; } catch { hasLocal = false; }
      if (hasLocal) {
        if (!mtimes.has(k)) mtimes.set(k, Date.now());
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
  setState({ status: 'idle', lastPullAt: Date.now(), error: undefined });
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
      mtimes.set(k, Date.now());
      dirty.add(k);
    }
  }
}

async function pullWithTimeout(): Promise<void> {
  if (!transport || !token) return;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; }, PULL_TIMEOUT_MS);
  try {
    await pull();
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
    const ts = new Date(mtimes.get(k) || Date.now()).toISOString();
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

function attachLifecycle(): void {
  if (lifecycleAttached || typeof window === 'undefined') return;
  lifecycleAttached = true;
  window.addEventListener('online', () => {
    void pull();
    void flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      writeMetaNow();
      void flush();
      keepAliveFlush();
    }
  });
  window.addEventListener('pagehide', () => {
    writeMetaNow();
    keepAliveFlush();
  });
  window.addEventListener('beforeunload', () => {
    writeMetaNow();
    keepAliveFlush();
  });
}

/* ------------------------------------------------------------------ */
/* Транспорт на Supabase REST                                          */
/* ------------------------------------------------------------------ */

class SupabaseKvTransport implements KvTransport {
  constructor(private client: SupabaseClient) {}

  async pull(token: string, onRows: (rows: KvRow[]) => void): Promise<void> {
    let from = 0;
    for (;;) {
      const { data, error } = await this.client
        .from('user_kv')
        .select('*')
        .eq('id', token)
        .order('key')
        .order('chunk_index')
        .range(from, from + PULL_PAGE - 1);
      if (error) throw new Error(error.message);
      onRows((data as KvRow[]) || []);
      if (!data || data.length < PULL_PAGE) break;
      from += PULL_PAGE;
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
