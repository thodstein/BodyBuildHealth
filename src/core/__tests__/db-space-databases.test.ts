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
import { db, deleteSpaceDatabases, dbNameFor, spaceDbRecordCount } from '../db';
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
    expect(deletedNames()).toEqual([]);
  });

  it('база атлета удаляется по своему имени, а домашняя не трогается', async () => {
    const sid = athleteSpaceId('a1');
    await deleteSpaceDatabases(['home', sid]);
    expect(deletedNames()).toEqual([dbNameFor(sid)]);
    // удостоверимся, что имя действительно отличается от домашней базы
    expect(dbNameFor(sid)).not.toBe(dbNameFor(HOME_SPACE_ID));
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
    expect(deletedNames()).toEqual([dbNameFor(sid)]);
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
  const stubIdb = (opts: { exists: boolean; counts?: FakeCounts }) => {
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
          const counts = opts.counts ?? {};
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
