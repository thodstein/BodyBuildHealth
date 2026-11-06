/**
 * db-space-databases.test.ts — удаление баз IndexedDB по пространствам.
 *
 * Это самая деструктивная операция в приложении, и проверить её «на глаз»
 * нельзя: у каждого пространства своя база, а домашняя база — это данные
 * самого владельца телефона. Инварианты:
 *  • домашнюю базу (`HealthEngineDB_v3`) не удаляет НИКОГДА, даже если её
 *    попросили явно;
 *  • база атлета удаляется по своему имени, а не по имени домашней;
 *  • соединение закрывается только когда удаляют базу ОТКРЫТОГО пространства
 *    (закрыть рабочую базу из-за чужого атлета — значит сломать запись).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, deleteSpaceDatabases, dbNameFor, putSpaceRecords, readSpaceStores, spaceDbRecordCount, writeSpaceStores } from '../db';
import { weightPhotoDbNameFor } from '../../engines/weight-photo-store';
import {
  _resetDataSpaceCache,
  athleteSpaceId,
  emptyRegistry,
  HOME_SPACE_ID,
  setActiveSpace,
  upsertSpace,
  writeRegistryToStorage,
} from '../data-space';

const deletedNames = (): string[] => {
  const fn = indexedDB.deleteDatabase as unknown as { mock?: { calls: unknown[][] } };
  return (fn.mock?.calls ?? []).map(call => String(call[0]));
};

describe('удаление баз пространств', () => {
  beforeEach(() => {
    vi.spyOn(indexedDB, 'deleteDatabase');
    localStorage.clear();
    _resetDataSpaceCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    _resetDataSpaceCache();
  });

  it('домашнюю базу не удаляет никогда, даже по прямому запросу', async () => {
    await deleteSpaceDatabases([HOME_SPACE_ID]);
    await deleteSpaceDatabases(['home', '', HOME_SPACE_ID]);
    // и базу фотографий домашнего пространства — тоже
    expect(deletedNames()).toEqual([]);
  });

  it('база атлета удаляется по своему имени, а домашняя не трогается', async () => {
    const sid = athleteSpaceId('a1');
    await deleteSpaceDatabases(['home', sid]);
    // основная база + отдельная база фотографий веса: обе — его данные
    expect(deletedNames()).toEqual([dbNameFor(sid), weightPhotoDbNameFor(sid)]);
    // удостоверимся, что имена действительно отличаются от домашних
    expect(dbNameFor(sid)).not.toBe(dbNameFor(HOME_SPACE_ID));
    expect(weightPhotoDbNameFor(sid)).not.toBe(weightPhotoDbNameFor(HOME_SPACE_ID));
  });

  it('чужой атлет не закрывает соединение открытого пространства', async () => {
    const close = vi.spyOn(db, 'close');
    await deleteSpaceDatabases([athleteSpaceId('other')]);
    expect(close).not.toHaveBeenCalled();
  });

  it('удаление данных ОТКРЫТОГО атлета закрывает соединение и базу', async () => {
    const sid = athleteSpaceId('a1');
    let reg = upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет' }).registry;
    reg = setActiveSpace(reg, sid);
    writeRegistryToStorage(reg);
    _resetDataSpaceCache();
    const close = vi.spyOn(db, 'close');

    await deleteSpaceDatabases([sid]);

    expect(close).toHaveBeenCalled();
    expect(deletedNames()).toEqual([dbNameFor(sid), weightPhotoDbNameFor(sid)]);
  });

  it('ошибка удаления базы не превращается в отказ интерфейса', async () => {
    (indexedDB.deleteDatabase as unknown as { mockImplementation: (fn: () => never) => void })
      .mockImplementation(() => {
        throw new Error('браузер запретил удаление');
      });
    await expect(deleteSpaceDatabases([athleteSpaceId('a1')])).resolves.toBeUndefined();
  });
});

/**
 * Записи в базе атлета. Цифра нужна в подтверждении «удалить и его данные»:
 * дневники тренировок и анализы живут ТОЛЬКО в IndexedDB, поэтому объём по
 * localStorage занизил бы её в разы.
 */
describe('подсчёт записей в базе пространства', () => {
  type FakeCounts = Record<string, number>;

  /** Поддельный IndexedDB: `exists=false` ведёт себя как отсутствующая база. */
  const stubIdb = (opts: { exists: boolean; counts?: FakeCounts; photoCount?: number }) => {
    const log: string[] = [];
    const fake = {
      open(name: string) {
        log.push(`open:${name}`);
        const req: any = {
          result: null,
          transaction: { abort: () => log.push('abort') },
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
        };
        setTimeout(() => {
          if (!opts.exists) {
            req.onupgradeneeded?.();
            return;
          }
          // У фотографий веса своя база и свой стор — подделка их различает.
          const isPhotos = name.startsWith('he_weight_photos_db');
          const counts: FakeCounts = isPhotos
            ? { photos: opts.photoCount ?? 0 }
            : (opts.counts ?? {});
          const tx: any = { oncomplete: null, onerror: null, onabort: null };
          tx.objectStore = (store: string) => ({
            count: () => {
              const r: any = { result: counts[store] ?? 0, onsuccess: null, onerror: null };
              setTimeout(() => r.onsuccess?.(), 0);
              return r;
            },
          });
          req.result = {
            objectStoreNames: Object.keys(counts),
            close: () => log.push('close'),
            transaction: () => {
              // В настоящем IndexedDB `oncomplete` приходит ПОСЛЕ всех `count()`,
              // поэтому в подделке он срабатывает позже.
              setTimeout(() => tx.oncomplete?.(), 5);
              return tx;
            },
          };
          req.onsuccess?.();
        }, 0);
        return req;
      },
    };
    vi.stubGlobal('indexedDB', fake);
    return log;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('складывает записи всех сторов', async () => {
    stubIdb({ exists: true, counts: { training_log: 300, workout_log: 12, labs_log: 4 } });
    await expect(spaceDbRecordCount('home')).resolves.toBe(316);
  });

  it('считает и отдельную базу фотографий веса', async () => {
    // Фото — тоже данные атлета, и они в другой базе: без них цифра удаления
    // занижала бы объём (фото весят больше всего).
    stubIdb({ exists: true, counts: { training_log: 300 }, photoCount: 7 });
    await expect(spaceDbRecordCount(athleteSpaceId('a1'))).resolves.toBe(307);
  });

  it('если базы нет — 0, и пустая база не создаётся', async () => {
    const log = stubIdb({ exists: false });
    await expect(spaceDbRecordCount(athleteSpaceId('a1'))).resolves.toBe(0);
    // именно прерывание апгрейда не даёт открытию создать пустую базу
    expect(log).toContain('abort');
  });

  it('если среда не дала открыть — «неизвестно», а не ноль', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        throw new Error('запрещено');
      },
    });
    await expect(spaceDbRecordCount(athleteSpaceId('a1'))).resolves.toBeNull();
  });

  it('ищет базу именно своего пространства', async () => {
    const log = stubIdb({ exists: true, counts: {} });
    await spaceDbRecordCount(athleteSpaceId('a1'));
    expect(log).toContain(`open:${dbNameFor(athleteSpaceId('a1'))}`);
  });
});

/**
 * Чтение и запись базы КОНКРЕТНОГО пространства — то, на чём держится бэкап
 * атлетов. Если бы бэкап читал только открытую базу, тренировки и анализы
 * остальных атлетов после смены телефона терялись бы.
 */
describe('чтение и запись базы пространства', () => {
  type DbMap = Record<string, Record<string, any[]>>;

  /** Список имён как у DOMStringList: `contains` + перебор. */
  const nameList = (names: string[]) => {
    const list: any = {
      length: names.length,
      contains: (n: string) => names.includes(n),
      item: (i: number) => names[i] ?? null,
    };
    list[Symbol.iterator] = () => names[Symbol.iterator]();
    return list;
  };

  /** Поддельный IndexedDB с несколькими базами и сторами. */
  const stubDb = (initial: DbMap) => {
    const dbs = new Map<string, Record<string, any[]>>();
    for (const [name, stores] of Object.entries(initial)) {
      dbs.set(name, JSON.parse(JSON.stringify(stores)) as Record<string, any[]>);
    }
    const closed: string[] = [];
    const created: string[] = [];

    const facade = (data: Record<string, any[]>, name: string) => ({
      get objectStoreNames() {
        return nameList(Object.keys(data));
      },
      createObjectStore: (store: string) => {
        data[store] = data[store] || [];
        return { indexNames: nameList([]), createIndex: () => {} };
      },
      close: () => closed.push(name),
      transaction: () => {
        const tx: any = { oncomplete: null, onerror: null, onabort: null };
        tx.objectStore = (store: string) => ({
          getAll: () => {
            const r: any = { result: data[store] ?? [], onsuccess: null, onerror: null };
            setTimeout(() => r.onsuccess?.(), 0);
            return r;
          },
          clear: () => {
            data[store] = [];
          },
          put: (rec: any) => {
            data[store] = data[store] || [];
            data[store].push(rec);
          },
        });
        setTimeout(() => tx.oncomplete?.(), 5);
        return tx;
      },
    });

    vi.stubGlobal('indexedDB', {
      open(name: string) {
        const req: any = {
          result: null,
          transaction: {
            abort() {
              req.aborted = true;
            },
          },
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
        };
        setTimeout(() => {
          const existing = dbs.get(name);
          if (!existing) {
            const data: Record<string, any[]> = {};
            req.result = facade(data, name);
            req.onupgradeneeded?.({ target: req });
            if (req.aborted) {
              // как в настоящем IndexedDB: прерванный апгрейд не создаёт базу
              req.onerror?.();
              return;
            }
            dbs.set(name, data);
            created.push(name);
            req.onsuccess?.({ target: req });
            return;
          }
          req.result = facade(existing, name);
          req.onsuccess?.({ target: req });
        }, 0);
        return req;
      },
    });
    return { dbs, closed, created };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('читает записи из базы нужного пространства', async () => {
    const { dbs } = stubDb({
      [dbNameFor('home')]: { diary: [{ id: 'h1' }] },
      [dbNameFor(athleteSpaceId('a1'))]: { training_log: [{ id: 't1' }, { id: 't2' }] },
    });
    await readSpaceStores(athleteSpaceId('a1'));
    const read = await readSpaceStores(athleteSpaceId('a1'));
    expect(read.training_log).toEqual([{ id: 't1' }, { id: 't2' }]);
    // открытые базы закрываем — иначе чужой бэкап держал бы соединения
    expect(dbs.size).toBe(2);
  });

  it('базы, которой нет, не создаёт при чтении', async () => {
    const { created } = stubDb({ [dbNameFor('home')]: {} });
    const read = await readSpaceStores(athleteSpaceId('nobody'));
    expect(read).toEqual({});
    expect(created).toEqual([]);
  });

  it('запись заменяет содержимое стора, а не дописывает', async () => {
    const sid = athleteSpaceId('a1');
    const { dbs } = stubDb({ [dbNameFor(sid)]: { diary: [{ id: 'old' }] } });
    await writeSpaceStores(sid, { diary: [{ id: 'new' }, { id: 'new2' }] });
    expect(dbs.get(dbNameFor(sid))!.diary).toEqual([{ id: 'new' }, { id: 'new2' }]);
  });

  it('запись создаёт базу, если её нет (восстановление на новом устройстве)', async () => {
    const sid = athleteSpaceId('a1');
    const { dbs } = stubDb({});
    await writeSpaceStores(sid, { diary: [{ id: 'x' }] });
    expect(dbs.get(dbNameFor(sid))!.diary).toEqual([{ id: 'x' }]);
  });

  it('дозапись в существующую базу пространства не стирает остальное', async () => {
    const sid = athleteSpaceId('a1');
    const { dbs } = stubDb({
      [dbNameFor(sid)]: { training_log: [{ id: 'old' }], profile: [{ id: 'p1' }] },
    });
    const written = await putSpaceRecords(sid, {
      training_log: [{ id: 'new' }, { id: 'new2' }],
    });
    expect(written).toBe(2);
    // дописываем, а не заменяем: у тренера в кэше уже лежит прошлая история
    expect(dbs.get(dbNameFor(sid))!.training_log).toEqual([
      { id: 'old' },
      { id: 'new' },
      { id: 'new2' },
    ]);
    expect(dbs.get(dbNameFor(sid))!.profile).toEqual([{ id: 'p1' }]);
  });

  it('не создаёт базу пространства, которое на этом телефоне не открывали', async () => {
    const { created, dbs } = stubDb({ [dbNameFor('home')]: {} });
    const written = await putSpaceRecords(athleteSpaceId('nobody'), {
      training_log: [{ id: 'x' }],
    });
    // null — это «базы нет»: вызывающий не должен считать запись синхронизированной
    expect(written).toBeNull();
    expect(created).toEqual([]);
    expect(dbs.has(dbNameFor(athleteSpaceId('nobody')))).toBe(false);
  });

  it('запись без id пропускается (битая строка не срывает остальные)', async () => {
    const sid = athleteSpaceId('a1');
    const { dbs } = stubDb({ [dbNameFor(sid)]: { training_log: [] } });
    const written = await putSpaceRecords(sid, { training_log: [{ nope: 1 }, { id: 'ok' }] });
    expect(written).toBe(1);
    expect(dbs.get(dbNameFor(sid))!.training_log).toEqual([{ id: 'ok' }]);
  });

  it('сбой хранилища не роняет бэкап', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        throw new Error('нет доступа');
      },
    });
    await expect(readSpaceStores('home')).resolves.toEqual({});
    await expect(writeSpaceStores('home', { diary: [] })).resolves.toBeUndefined();
  });
});

describe('список баз на диске', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('отдаёт пространства наших баз и не путает их с домашней или чужой', async () => {
    const a1 = athleteSpaceId('a1');
    const a2 = athleteSpaceId('a2');
    vi.stubGlobal('indexedDB', {
      ...indexedDB,
      databases: async () => [
        { name: 'HealthEngineDB_v3', version: 7 },
        { name: `HealthEngineDB_v3__${a1}`, version: 7 },
        { name: weightPhotoDbNameFor(a2), version: 1 },
        { name: 'SomeOtherAppDB', version: 1 },
        { name: 'he_weight_photos_db', version: 1 },
      ],
    });

    const { listSpaceDatabaseIds } = await import('../db');
    const ids = await listSpaceDatabaseIds();

    expect(ids).not.toBeNull();
    expect(ids!.sort()).toEqual([a1, a2].sort());
  });

  it('если среда не умеет список баз — null, а не пустой список', async () => {
    vi.stubGlobal('indexedDB', { ...indexedDB, databases: undefined });

    const { listSpaceDatabaseIds } = await import('../db');
    await expect(listSpaceDatabaseIds()).resolves.toBeNull();
  });
});
