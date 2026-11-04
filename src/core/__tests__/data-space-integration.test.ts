/**
 * data-space-integration.test.ts — шов пространств, подключённый так же, как в
 * приложении (install первым, потом остальные модули).
 *
 * Проверяем ровно то, что нельзя проверить «на глаз»:
 *  • бэкап уносит ВСЕ пространства, а не только открытое (иначе смена телефона
 *    потеряла бы атлетов);
 *  • восстановление кладёт ключи атлета на место, не префиксуя их повторно;
 *  • «удалить все данные» чистит и пространства атлетов, но оставляет профиль
 *    устройства и сессию;
 *  • облако различает профиль тренера и профиль атлета (одно имя ключа — разные
 *    строки), иначе синхронизация затирала бы чужие данные;
 *  • у каждого пространства своя база IndexedDB.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  DATA_SPACE_KEY,
  DEVICE_SALT_KEY,
  HOME_SPACE_ID,
  _resetDataSpaceCache,
  athleteSpaceId,
  emptyRegistry,
  installDataSpaceStorage,
  rawKeys,
  serializeRegistry,
  setActiveSpace,
  toPhysicalKey,
  upsertSpace,
} from '../data-space';

type KvModule = typeof import('../cloud-kv');

// Шов ставится ДО импорта модулей приложения — как в main.tsx.
const api = installDataSpaceStorage(window);

let kv: KvModule;
let currentKv: any = null;

class FakeTransport {
  cloud = new Map<string, { id: string; key: string; chunk_index: number; chunk_count: number; value: string; updated_at: string }[]>();
  replaceCalls: string[] = [];

  async pull(_t: string, onRows: (rows: any[]) => void, onServerNow?: (ms: number) => void): Promise<void> {
    if (onServerNow) onServerNow(Date.now());
    onRows([...this.cloud.values()].flat());
  }

  async replaceKey(rows: any[]): Promise<void> {
    this.replaceCalls.push(rows[0]?.key || '');
    this.cloud.set(rows[0]?.key || '', rows);
  }

  async removeKey(_t: string, key: string): Promise<void> {
    this.cloud.delete(key);
  }

  keepAlivePush(): void {
    /* не нужен в этих тестах */
  }
}

beforeAll(async () => {
  kv = await import('../cloud-kv');
});

const switchTo = (spaceId: string, athleteId: string | null = null) => {
  const reg = setActiveSpace(
    upsertSpace(emptyRegistry(), { id: spaceId, athleteId, label: 'Атлет' }).registry,
    spaceId,
  );
  api!.writeRegistry(reg);
};

beforeEach(() => {
  _resetDataSpaceCache();
  currentKv?._resetKvForTests?.();
  currentKv = null;
  // Чистим ВСЁ (включая все пространства) — иначе тесты унаследуют чужие ключи.
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  const raw = api!.raw;
  for (let i = raw.length - 1; i >= 0; i--) {
    const k = raw.key(i);
    if (k) raw.removeItem(k);
  }
  api!.writeRegistry(emptyRegistry());
});

afterEach(() => {
  currentKv?._resetKvForTests?.();
  currentKv = null;
});

describe('шов установлен как в приложении', () => {
  it('installDataSpaceStorage подменяет localStorage (иначе изоляции нет)', () => {
    expect(api).not.toBeNull();
    const sid = athleteSpaceId('a1');
    switchTo(sid, 'a1');
    localStorage.setItem('he_profile_v2', 'athlete');
    expect(api!.raw.getItem(toPhysicalKey(sid, 'he_profile_v2'))).toBe('athlete');
    expect(api!.raw.getItem('he_profile_v2')).toBeNull();
  });
});

describe('бэкап: все пространства, восстановление без двойного префикса', () => {
  it('collectBackup содержит ключи домашнего профиля И атлета', async () => {
    const { collectBackup } = await import('../data-backup');
    const sid = athleteSpaceId('a1');

    localStorage.setItem('he_profile_v2', 'home-profile');
    switchTo(sid, 'a1');
    localStorage.setItem('he_profile_v2', 'athlete-profile');
    localStorage.setItem('he_weight_diary', '[{"kg":82}]');

    const backup = await collectBackup();
    const keys = Object.keys(backup.localStorage);
    expect(keys).toContain('he_profile_v2');
    expect(keys).toContain(toPhysicalKey(sid, 'he_profile_v2'));
    expect(keys).toContain(toPhysicalKey(sid, 'he_weight_diary'));
    expect(backup.localStorage[toPhysicalKey(sid, 'he_profile_v2')]).toBe('athlete-profile');
    expect(backup.localStorage['he_profile_v2']).toBe('home-profile');
  });

  it('бэкап уносит соль шифрования IndexedDB (без неё часть записей не расшифруется)', async () => {
    const { collectBackup } = await import('../data-backup');
    api!.raw.setItem(DEVICE_SALT_KEY, 'c2FsdA==');
    const backup = await collectBackup();
    expect(backup.localStorage[DEVICE_SALT_KEY]).toBe('c2FsdA==');
  });

  it('соль шифрования — свойство устройства: под атлетом остаётся тем же ключом', () => {
    const sid = athleteSpaceId('a1');
    switchTo(sid, 'a1');
    localStorage.setItem(DEVICE_SALT_KEY, 'abc');
    expect(api!.raw.getItem(DEVICE_SALT_KEY)).toBe('abc');
    // под атлетом ключ не префиксуется: иначе после переключения расшифровка сломается
    expect(toPhysicalKey(sid, DEVICE_SALT_KEY)).toBe(DEVICE_SALT_KEY);
    expect(rawKeys(api!.raw).filter(k => k.includes('salt'))).toEqual([DEVICE_SALT_KEY]);
  });

  it('importBackup кладёт ключи атлета обратно в его пространство', async () => {
    const { importBackup } = await import('../data-backup');
    const sid = athleteSpaceId('a1');
    await importBackup({
      app: 'health-engine',
      version: '1.0',
      createdAt: '2026-11-04T00:00:00.000Z',
      stores: {},
      localStorage: {
        he_profile_v2: 'home-profile',
        [toPhysicalKey(sid, 'he_profile_v2')]: 'athlete-profile',
      },
    } as any);

    expect(api!.raw.getItem(toPhysicalKey(sid, 'he_profile_v2'))).toBe('athlete-profile');
    // в home по-прежнему свой профиль, а не профиль атлета
    api!.writeRegistry(emptyRegistry());
    expect(localStorage.getItem('he_profile_v2')).toBe('home-profile');
    expect(api!.raw.getItem(toPhysicalKey(athleteSpaceId('a1'), 'he_profile_v2'))).toBe('athlete-profile');
  });

  it('softClear удаляет пространства атлетов и режим тренера, но оставляет профиль и сессию', async () => {
    const { softClear } = await import('../data-backup');
    const sid = athleteSpaceId('a1');
    localStorage.setItem('he_profile_v2', 'home-profile');
    localStorage.setItem('he_session_v2', 'session');
    localStorage.setItem('he_coach_mode', '{"athletes":[1]}');
    switchTo(sid, 'a1');
    localStorage.setItem('he_profile_v2', 'athlete-profile');
    localStorage.setItem('he_weight_diary', '[]');

    await softClear();

    expect(api!.raw.getItem('he_profile_v2')).toBe('home-profile');
    expect(api!.raw.getItem('he_session_v2')).toBe('session');
    expect(api!.raw.getItem(toPhysicalKey(sid, 'he_profile_v2'))).toBeNull();
    expect(api!.raw.getItem(toPhysicalKey(sid, 'he_weight_diary'))).toBeNull();
    expect(api!.raw.getItem('he_coach_mode')).toBeNull();
    expect(api!.raw.getItem(DATA_SPACE_KEY)).toBeNull(); // реестр стёрт → приложение в home
  });
});

describe('IndexedDB: своя база на пространство', () => {
  it('home сохраняет историческое имя базы (нулевая миграция)', async () => {
    const { dbNameFor } = await import('../db');
    expect(dbNameFor(HOME_SPACE_ID)).toBe('HealthEngineDB_v3');
    expect(dbNameFor('')).toBe('HealthEngineDB_v3');
    expect(dbNameFor('asp_a1_x')).toBe('HealthEngineDB_v3__asp_a1_x');
  });
});

describe('облако: профиль атлета не затирает профиль тренера', () => {
  it('ключи уходят в облако с пространством в имени', async () => {
    const transport = new FakeTransport();
    currentKv = kv;
    kv._resetKvForTests();
    const sid = athleteSpaceId('a1');

    // home: профиль тренера
    switchTo(HOME_SPACE_ID);
    await kv.initKvSync('tg_1', { transport: transport as any, token: 'tk', flushDelayMs: 5 });
    localStorage.setItem('he_profile_v2', 'trainer');
    await new Promise(r => setTimeout(r, 40)); // дать стартовому flush завершиться
    await kv.flushKvNow();
    expect(transport.replaceCalls).toContain('he_profile_v2');

    // атлет: его профиль — другое имя строки в облаке
    kv._resetKvForTests();
    switchTo(sid, 'a1');
    await kv.initKvSync('tg_1', { transport: transport as any, token: 'tk', flushDelayMs: 5 });
    localStorage.setItem('he_profile_v2', 'athlete');
    await new Promise(r => setTimeout(r, 40));
    await kv.flushKvNow();

    const athleteKey = toPhysicalKey(sid, 'he_profile_v2');
    expect(transport.replaceCalls).toContain(athleteKey);
    expect(transport.cloud.get('he_profile_v2')?.[0].value).toBe('trainer');
    expect(transport.cloud.get(athleteKey)?.[0].value).toBe('athlete');
  });

  it('правки в пространстве атлета не помечают ключ тренера «грязным»', async () => {
    const transport = new FakeTransport();
    currentKv = kv;
    kv._resetKvForTests();
    const sid = athleteSpaceId('a1');
    switchTo(sid, 'a1');
    await kv.initKvSync('tg_2', { transport: transport as any, token: 'tk2', flushDelayMs: 5 });
    localStorage.setItem('he_profile_v2', 'athlete');
    await new Promise(r => setTimeout(r, 40));
    await kv.flushKvNow();
    // ключ без префикса не должен попасть в облако из пространства атлета
    expect(transport.replaceCalls).not.toContain('he_profile_v2');
    expect(transport.replaceCalls).toContain(toPhysicalKey(sid, 'he_profile_v2'));
  });

  it('исключённые ключи (сессия, синк) не синкаются и под атлетом', () => {
    switchTo(athleteSpaceId('a1'), 'a1');
    const sid = athleteSpaceId('a1');
    for (const k of ['he_session_v2', 'he_sync_meta_v1', 'he_draft_x']) {
      expect(kv.isKvExcludedKey(toPhysicalKey(sid, k) as string)).toBe(true);
    }
    expect(kv.isKvExcludedKey(toPhysicalKey(sid, 'he_profile_v2'))).toBe(false);
  });
});

describe('реестр пространств в хранилище устройства', () => {
  it('реестр пишется один раз и читается после «перезагрузки» (сброса кэша)', () => {
    const sid = athleteSpaceId('a1');
    switchTo(sid, 'a1');
    _resetDataSpaceCache();
    expect(api!.activeSpaceId()).toBe(sid);
    const reg = JSON.parse(api!.raw.getItem(DATA_SPACE_KEY) as string);
    expect(serializeRegistry(reg)).toBe(api!.raw.getItem(DATA_SPACE_KEY));
  });
});
