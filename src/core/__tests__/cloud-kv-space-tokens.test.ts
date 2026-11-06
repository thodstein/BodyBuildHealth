import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dbm = vi.hoisted(() => ({ stores: {} as Record<string, Record<string, unknown[]>> }));

/**
 * База пространства: в тестах достаточно «какие записи есть в базе SID».
 * Мок отдаёт их в `readSpaceStores`; остальные записи идут через транспорт.
 */
vi.mock('../db', () => ({
  db: {
    getAll: async () => [],
    get: async () => undefined,
    put: async () => undefined,
    delete: async () => undefined,
  },
  readSpaceStores: async (spaceId: string) => dbm.stores[spaceId] ?? {},
  deleteSpaceDatabases: async () => undefined,
}));
import {
  DATA_SPACE_KEY,
  HOME_SPACE_ID,
  athleteSpaceId,
  emptyRegistry,
  readRegistryFromStorage,
  spaceKeyPrefix,
  upsertSpace,
  serializeRegistry,
  setActiveSpace,
} from '../data-space';
import {
  FLUSH_DELAY_MS,
  _resetKvForTests,
  chunkValue,
  flushKvNow,
  initKvSync,
  migrateSpaceToToken,
  purgeSpacesFromCloud,
  rotateSpaceToken,
  spaceRevokedKey,
  type KvRow,
  type KvTransport,
} from '../cloud-kv';
import {
  SPACE_TOKENS_KEY,
  _resetSpaceTokensCache,
  ensureSpaceToken,
  listSpaceTokens,
  markSpaceTokenMigrated,
  spaceTokenFor,
  spaceTokenRecord,
} from '../space-tokens';

class TokenTransport implements KvTransport {
  /** token → key → строки чанков */
  cloud = new Map<string, Map<string, KvRow[]>>();
  replaceCalls: { token: string; key: string }[] = [];
  removePrefixCalls: { token: string; prefix: string }[] = [];

  async pull(token: string, onRows: (rows: KvRow[]) => void, onServerNow?: (ms: number) => void): Promise<void> {
    if (onServerNow) onServerNow(Date.now());
    onRows([...(this.cloud.get(token)?.values() ?? [])].flat());
  }

  async replaceKey(rows: KvRow[]): Promise<void> {
    const key = rows[0]?.key;
    const token = rows[0]?.id;
    if (!key || !token) return;
    this.replaceCalls.push({ token, key });
    const bucket = this.cloud.get(token) ?? new Map<string, KvRow[]>();
    bucket.set(key, rows);
    this.cloud.set(token, bucket);
  }

  async removeKey(token: string, key: string): Promise<void> {
    this.cloud.get(token)?.delete(key);
  }

  async removePrefix(token: string, prefix: string): Promise<void> {
    this.removePrefixCalls.push({ token, prefix });
    const bucket = this.cloud.get(token);
    if (!bucket) return;
    for (const k of [...bucket.keys()]) if (k.startsWith(prefix)) bucket.delete(k);
  }

  keepAlivePush(rows: KvRow[]): void {
    void this.replaceKey(rows);
  }

  seed(token: string, key: string, value: string, tsMs: number): void {
    const chunks = chunkValue(value);
    const bucket = this.cloud.get(token) ?? new Map<string, KvRow[]>();
    bucket.set(
      key,
      chunks.map((c, i) => ({
        id: token,
        key,
        chunk_index: i,
        chunk_count: i === 0 ? chunks.length : 0,
        value: c,
        updated_at: new Date(tsMs).toISOString(),
      })),
    );
    this.cloud.set(token, bucket);
  }

  keys(token: string): string[] {
    return [...(this.cloud.get(token)?.keys() ?? [])];
  }

  value(token: string, key: string): string | null {
    const rows = this.cloud.get(token)?.get(key);
    if (!rows) return null;
    return rows
      .slice()
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map(r => r.value)
      .join('');
  }
}

const TRAINER = 'tk_' + '1'.repeat(48);
const SPACE_TOKEN = 'tk_' + '2'.repeat(48);
const SID = athleteSpaceId('ivanov');

function setRegistry(active: string): void {
  const reg = upsertSpace(emptyRegistry(), { id: SID, athleteId: 'ivanov', label: 'Иван' }).registry;
  localStorage.setItem(DATA_SPACE_KEY, serializeRegistry(setActiveSpace(reg, active)));
}

function seedToken(spaceId: string, token: string, migrated = true): void {
  ensureSpaceToken(spaceId, { token, role: 'coach', label: 'Иван' });
  if (migrated) markSpaceTokenMigrated(spaceId, '2026-11-06T10:00:00.000Z');
}

async function init(transport: TokenTransport, reloadFn?: () => void) {
  await initKvSync('tg_1', { transport, token: TRAINER, flushDelayMs: 5, reloadFn });
  // Стартовый flush идёт в фоне; даём ему закончить, иначе ручной flush ниже
  // вернётся сразу (`flushing`) и тест проверит состояние «до».
  await new Promise(r => setTimeout(r, 15));
  await flushKvNow();
}

beforeEach(() => {
  _resetKvForTests();
  _resetSpaceTokensCache();
  localStorage.clear();
  for (const k of Object.keys(dbm.stores)) delete dbm.stores[k];
  vi.useRealTimers();
});

afterEach(() => {
  _resetKvForTests();
  _resetSpaceTokensCache();
  vi.useRealTimers();
});

describe('токен пространства в облаке', () => {
  it('после переноса ключи атлета уходят под токен пространства, а не тренера', async () => {
    setRegistry(SID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    await init(transport);

    const key = spaceKeyPrefix(SID) + 'he_note';
    localStorage.setItem(key, 'заметка атлета');
    await flushKvNow();

    expect(transport.value(SPACE_TOKEN, key)).toBe('заметка атлета');
    expect(transport.value(TRAINER, key)).toBeNull();
  });

  it('до переноса ключи остаются под токеном тренера (ничего не «пропадает»)', async () => {
    setRegistry(SID);
    ensureSpaceToken(SID, { token: SPACE_TOKEN });
    expect(spaceTokenFor(SID)).toBeNull();
    const transport = new TokenTransport();
    await init(transport);

    const key = spaceKeyPrefix(SID) + 'he_note';
    localStorage.setItem(key, 'до переноса');
    await flushKvNow();
    expect(transport.value(TRAINER, key)).toBe('до переноса');
    expect(transport.value(SPACE_TOKEN, key)).toBeNull();
  });

  it('дома кэш пространств обновляется — сводки в списке атлетов не отстают', async () => {
    setRegistry(HOME_SPACE_ID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    const key = spaceKeyPrefix(SID) + 'he_pl_runtime';
    transport.seed(SPACE_TOKEN, key, '{"done":1}', Date.now() - 10_000);
    await init(transport);
    // Дома активного пространства нет, но токен этого пространства тянется
    // по кругу: иначе карточка показывала бы данные, которых на устройстве нет.
    expect(localStorage.getItem(key)).toBe('{"done":1}');
  });

  it('реестр токенов с двух устройств объединяется, а не затирается', async () => {
    setRegistry(HOME_SPACE_ID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    await init(transport);
    // Второе устройство тренера создало токен для ДРУГОГО пространства.
    const SID2 = athleteSpaceId('petrov');
    const t2 = 'tk_' + '7'.repeat(48);
    transport.seed(
      TRAINER,
      SPACE_TOKENS_KEY,
      JSON.stringify({
        version: 1,
        items: [
          {
            spaceId: SID2,
            token: t2,
            role: 'coach',
            createdAt: '2026-11-06T12:00:00.000Z',
            updatedAt: '2026-11-06T12:00:00.000Z',
          },
        ],
      }),
      Date.now(),
    );
    const { pullKvNow } = await import('../cloud-kv');
    await pullKvNow();
    await new Promise(r => setTimeout(r, 10));
    await flushKvNow();
    expect(listSpaceTokens().map(r => r.spaceId).sort()).toEqual([SID, SID2].sort());
    // Объединённый реестр поднят обратно: иначе второе устройство его не увидит.
    const raw = transport.value(TRAINER, SPACE_TOKENS_KEY) ?? '';
    expect(raw).toContain(SID);
    expect(raw).toContain(SID2);
  });

  it('домашние ключи тренер не вливает в профиль атлета при pull', async () => {
    setRegistry(SID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    transport.seed(TRAINER, 'he_profile_v2', 'тренер', Date.now() - 60_000);
    const athleteKey = spaceKeyPrefix(SID) + 'he_profile_v2';
    transport.seed(SPACE_TOKEN, athleteKey, 'атлет', Date.now() - 60_000);

    localStorage.setItem('he_profile_v2', 'тренер-локально');
    await init(transport);

    expect(localStorage.getItem('he_profile_v2')).toBe('тренер-локально');
    expect(localStorage.getItem(athleteKey)).toBe('атлет');
  });

  it('старые копии под токеном тренера после переноса игнорируются', async () => {
    setRegistry(SID);
    seedToken(SID, SPACE_TOKEN);
    const key = spaceKeyPrefix(SID) + 'he_note';
    const transport = new TokenTransport();
    transport.seed(TRAINER, key, 'старьё', Date.now() + 60_000); // даже «новее»
    transport.seed(SPACE_TOKEN, key, 'актуально', Date.now() - 60_000);
    await init(transport);
    expect(localStorage.getItem(key)).toBe('актуально');
  });

  it('перенос копирует строки пространства под токен пространства', async () => {
    setRegistry(SID);
    ensureSpaceToken(SID, { token: SPACE_TOKEN, label: 'Иван' });
    const transport = new TokenTransport();
    const key = spaceKeyPrefix(SID) + 'he_plan';
    transport.seed(TRAINER, key, 'план', Date.now() - 10_000);
    await init(transport);

    const ok = await migrateSpaceToToken(SID);
    expect(ok).toBe(true);
    expect(transport.value(SPACE_TOKEN, key)).toBe('план');
    expect(spaceTokenRecord(SID)?.migratedAt).toBeTruthy();
  });

  it('перенос дописывает локальные ключи, которых нет в облаке', async () => {
    setRegistry(SID);
    ensureSpaceToken(SID, { token: SPACE_TOKEN });
    const transport = new TokenTransport();
    await init(transport);
    const key = spaceKeyPrefix(SID) + 'he_local_only';
    localStorage.setItem(key, 'локально');
    const ok = await migrateSpaceToToken(SID);
    expect(ok).toBe(true);
    expect(transport.value(SPACE_TOKEN, key)).toBe('локально');
  });

  it('перенос дописывает записи IndexedDB, которых нет в облаке', async () => {
    setRegistry(HOME_SPACE_ID);
    ensureSpaceToken(SID, { token: SPACE_TOKEN, label: 'Иван' });
    const transport = new TokenTransport();
    await init(transport);
    dbm.stores[SID] = { training_log: [{ id: 'w1', date: '2026-11-05' }] };
    const ok = await migrateSpaceToToken(SID);
    expect(ok).toBe(true);
    const row = transport.value(SPACE_TOKEN, `idb:${SID}:training_log:w1`);
    expect(row).toContain('w1');
  });
});

describe('удаление и отзыв доступа', () => {
  it('purge убирает оба токена и оставляет маркер для телефона атлета', async () => {
    setRegistry(HOME_SPACE_ID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    const key = spaceKeyPrefix(SID) + 'he_note';
    transport.seed(TRAINER, key, 'копия', Date.now() - 10_000);
    transport.seed(SPACE_TOKEN, key, 'копия', Date.now() - 10_000);
    await init(transport);

    await purgeSpacesFromCloud([SID]);

    expect(transport.keys(TRAINER).filter(k => k.startsWith(spaceKeyPrefix(SID)))).toEqual([]);
    expect(transport.keys(SPACE_TOKEN).filter(k => k.startsWith(spaceKeyPrefix(SID)))).toEqual([]);
    expect(transport.value(SPACE_TOKEN, spaceRevokedKey(SID))).toBe('1');
    // Запись остаётся могилой (объединение реестра не должно её воскресить).
    expect(spaceTokenRecord(SID)?.revokedAt).toBeTruthy();
    expect(spaceTokenFor(SID)).toBeNull();
  });

  it('маркер отзыва стирает пространство на телефоне атлета и возвращает home', async () => {
    setRegistry(SID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    const key = spaceKeyPrefix(SID) + 'he_note';
    transport.seed(SPACE_TOKEN, key, 'данные атлета', Date.now() - 10_000);
    transport.seed(TRAINER, 'he_profile_v2', 'свои данные', Date.now() - 10_000);

    localStorage.setItem(key, 'данные атлета');
    const reload = vi.fn();
    await init(transport, reload);

    // Отзыв приходит в следующем pull.
    transport.seed(SPACE_TOKEN, spaceRevokedKey(SID), '1', Date.now());
    const { pullKvNow } = await import('../cloud-kv');
    await pullKvNow();
    await new Promise(r => setTimeout(r, 10));

    expect(localStorage.getItem(key)).toBeNull();
    expect(readRegistryFromStorage().active).toBe(HOME_SPACE_ID);
    expect(spaceTokenRecord(SID)?.revokedAt).toBeTruthy();
    expect(spaceTokenFor(SID)).toBeNull();
    expect(reload).toHaveBeenCalled();
    expect(localStorage.getItem('he_profile_v2')).toBe('свои данные');
  });
});

describe('смена кода', () => {
  it('rotate переносит данные на новый токен, старый отзывает', async () => {
    setRegistry(HOME_SPACE_ID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    const key = spaceKeyPrefix(SID) + 'he_note';
    transport.seed(SPACE_TOKEN, key, 'данные', Date.now() - 10_000);
    await init(transport);

    const next = await rotateSpaceToken(SID);
    expect(next).toBeTruthy();
    expect(next).not.toBe(SPACE_TOKEN);
    expect(transport.value(next as string, key)).toBe('данные');
    expect(transport.value(SPACE_TOKEN, key)).toBeNull();
    expect(transport.value(SPACE_TOKEN, spaceRevokedKey(SID))).toBe('1');
    expect(spaceTokenFor(SID)).toBe(next);
    expect(listSpaceTokens()).toHaveLength(1);
  });

  it('rotate без токена — честный null', async () => {
    setRegistry(HOME_SPACE_ID);
    const transport = new TokenTransport();
    await init(transport);
    expect(await rotateSpaceToken(SID)).toBeNull();
  });
});

describe('служебные строки не считаются данными', () => {
  it('маркер отзыва не попадает в localStorage и в push', async () => {
    setRegistry(SID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    transport.seed(SPACE_TOKEN, spaceRevokedKey('asp_other_x1'), '1', Date.now());
    await init(transport);
    expect(localStorage.getItem(spaceRevokedKey('asp_other_x1'))).toBeNull();
  });

  it('flush не трогает токен пространства, если ключ домашний', async () => {
    setRegistry(HOME_SPACE_ID);
    seedToken(SID, SPACE_TOKEN);
    const transport = new TokenTransport();
    await init(transport);
    localStorage.setItem('he_theme', 'dark');
    await flushKvNow();
    expect(transport.value(TRAINER, 'he_theme')).toBe('dark');
    expect(transport.value(SPACE_TOKEN, 'he_theme')).toBeNull();
  });
});

// FLUSH_DELAY_MS импортирован, чтобы тест явно говорил: задержка не влияет на flushKvNow.
void FLUSH_DELAY_MS;
