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
import { db, deleteSpaceDatabases, dbNameFor } from '../db';
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
