/**
 * data-backup-spaces.test.ts — бэкап и пространства данных.
 *
 * До изоляции у приложения была одна база IndexedDB, и «бэкап» был плоским.
 * Теперь у каждого атлета своя база, поэтому плоский бэкап (а) не уносил бы
 * тренировки и анализы атлетов, (б) при восстановлении в пространстве атлета
 * положил бы домашние данные в его базу.
 *
 * Здесь база подменена: проверяем именно разводку — какие пространства
 * спрашиваются при экспорте и в какие базы пишется восстановление.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const { readSpaceStores, writeSpaceStores } = vi.hoisted(() => {
  const read = vi.fn(async (spaceId: string): Promise<Record<string, any[]>> => {
    if (spaceId === 'home') return { diary: [], training_log: [], labs_log: [{ id: 'l1' }] };
    return { diary: [{ id: 'd1' }], training_log: [{ id: 't1' }], labs_log: [] };
  });
  const write = vi.fn(async (_spaceId: string, _stores: Record<string, any[]>) => {});
  return { readSpaceStores: read, writeSpaceStores: write };
});

vi.mock('../db', () => ({
  STORES: ['diary', 'training_log', 'labs_log'],
  db: { init: vi.fn(async () => {}), clear: vi.fn(async () => {}), put: vi.fn(async () => {}) },
  deleteSpaceDatabases: vi.fn(async () => {}),
  deleteWeightPhotoDatabase: vi.fn(async () => {}),
  readSpaceStores: (spaceId: string) => readSpaceStores(spaceId),
  writeSpaceStores: (spaceId: string, stores: Record<string, any[]>) =>
    writeSpaceStores(spaceId, stores),
}));

/**
 * Фото веса живут в отдельной базе на каждое пространство — в тесте они тоже
 * раздельные, иначе «унесли фото всех атлетов» нельзя было бы отличить от
 * «одно и то же фото записали дважды».
 */
const photos = vi.hoisted(() => ({
  bySpace: {} as Record<string, Array<{ date: string; photos: string[]; updatedAt?: number }>>,
  written: [] as Array<{ spaceId: string; date: string; photos: string[] }>,
}));

vi.mock('../../engines/weight-photo-store', () => ({
  listWeightPhotosFor: async (spaceId: string) => photos.bySpace[spaceId] ?? [],
  saveWeightPhotosFor: async (spaceId: string, date: string, list: string[]) => {
    photos.written.push({ spaceId, date, photos: list });
  },
}));

import { collectBackup, importBackup, type AppBackup } from '../data-backup';
import { setSpacePurgeHandler } from '../space-purge';
import {
  DATA_SPACE_KEY,
  HOME_SPACE_ID,
  athleteSpaceId,
  emptyRegistry,
  parseRegistry,
  serializeRegistry,
  toPhysicalKey,
  setActiveSpace,
  upsertSpace,
} from '../data-space';

describe('бэкап уносит базы всех пространств', () => {
  beforeEach(() => {
    localStorage.clear();
    readSpaceStores.mockClear();
    writeSpaceStores.mockClear();
  });

  it('экспорт спрашивает базу каждого атлета, а не только открытого', async () => {
    const a1 = athleteSpaceId('a1');
    const reg = setActiveSpace(
      upsertSpace(emptyRegistry(), { id: a1, athleteId: 'a1', label: 'Иван' }).registry,
      'home',
    );
    localStorage.setItem(DATA_SPACE_KEY, serializeRegistry(reg));

    const b = await collectBackup();

    const asked = readSpaceStores.mock.calls.map(c => c[0]);
    expect(asked).toContain('home');
    expect(asked).toContain(a1);
    // спрашиваем ровно пространства устройства: домашнее + атлет из реестра
    expect(asked.sort()).toEqual(['home', a1].sort());
    // база атлета попала в файл (дневник и тренировки)
    expect(b.spaceStores?.[a1]?.diary).toEqual([{ id: 'd1' }]);
    expect(b.spaceStores?.[a1]?.training_log).toEqual([{ id: 't1' }]);
    // формат помечен как новый (3.0 добавил фотографии веса)
    expect(b.version).toBe('3.0');
  });

  it('восстановление пишет каждую базу в её собственное пространство', async () => {
    const a1 = athleteSpaceId('a1');
    const file: AppBackup = {
      app: 'health-engine',
      version: '2.0',
      createdAt: '2026-11-04T00:00:00.000Z',
      stores: {},
      spaceStores: {
        home: { diary: [{ id: 'h' }] },
        [a1]: { diary: [{ id: 'a' }], training_log: [{ id: 't' }] },
      },
      localStorage: {
        he_profile_v2: '{"name":"Тренер"}',
        [toPhysicalKey(a1, 'he_profile_v2')]: '{"name":"Иван"}',
      },
    };

    await importBackup(file);

    const written = writeSpaceStores.mock.calls.map(c => c[0]);
    expect(written).toContain('home');
    expect(written).toContain(a1);
    // данные атлета — в базу атлета, домашние — в домашнюю
    const homeCall = writeSpaceStores.mock.calls.find(c => c[0] === 'home');
    const athleteCall = writeSpaceStores.mock.calls.find(c => c[0] === a1);
    expect(homeCall?.[1].diary).toEqual([{ id: 'h' }]);
    expect(athleteCall?.[1].diary).toEqual([{ id: 'a' }]);
  });

  it('файл старого формата (одна база) восстанавливается в домашнюю', async () => {
    const legacy: AppBackup = {
      app: 'health-engine',
      version: '1.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      stores: { diary: [{ id: 'old' }] },
      localStorage: { he_profile_v2: '{"name":"Старый"}' },
    };

    await importBackup(legacy);

    expect(writeSpaceStores.mock.calls.map(c => c[0])).toEqual(['home']);
  });

  it('ключи пишутся физическими: домашний профиль не попадает в пространство атлета', async () => {
    const a1 = athleteSpaceId('a1');
    const reg = setActiveSpace(
      upsertSpace(emptyRegistry(), { id: a1, athleteId: 'a1', label: 'Иван' }).registry,
      a1,
    );
    localStorage.setItem(DATA_SPACE_KEY, serializeRegistry(reg));

    // Шов в этом файле не стоит, поэтому проверяем именно сырые ключи: файл хранит
    // их физическими, и восстановление обязано писать их как есть.
    await importBackup({
      app: 'health-engine',
      version: '2.0',
      createdAt: '2026-11-04T00:00:00.000Z',
      stores: {},
      spaceStores: {},
      localStorage: {
        he_profile_v2: '{"name":"Тренер"}',
        [toPhysicalKey(a1, 'he_profile_v2')]: '{"name":"Иван"}',
      },
    });

    expect(localStorage.getItem('he_profile_v2')).toBe('{"name":"Тренер"}');
    expect(localStorage.getItem(toPhysicalKey(a1, 'he_profile_v2'))).toBe('{"name":"Иван"}');
    // и ни один ключ не «удвоился» префиксом
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '');
    expect(keys.filter(k => k.startsWith('he_ath_he_ath_'))).toEqual([]);
  });

  it('«удалить все данные» из пространства атлета чистит и домашнюю базу', async () => {
    const { softClear } = await import('../data-backup');
    const { deleteSpaceDatabases, deleteWeightPhotoDatabase } = await import('../db');
    const a1 = athleteSpaceId('a1');
    const reg = setActiveSpace(
      upsertSpace(emptyRegistry(), { id: a1, athleteId: 'a1', label: 'Иван' }).registry,
      a1,
    );
    localStorage.setItem(DATA_SPACE_KEY, serializeRegistry(reg));
    localStorage.setItem('he_profile_v2', 'тренер');
    localStorage.setItem('he_session_v2', 'сессия');
    localStorage.setItem(toPhysicalKey(a1, 'he_profile_v2'), 'иван');
    writeSpaceStores.mockClear();
    const purged: string[][] = [];
    setSpacePurgeHandler(ids => { purged.push([...ids]); });

    await softClear();

    // домашняя база чистится по сторам — чистить только открытое пространство
    // (а открыт атлет) значило бы оставить домашние дневники на диске
    const homeWrite = writeSpaceStores.mock.calls.find(c => c[0] === 'home');
    expect(homeWrite).toBeTruthy();
    // база атлета удаляется целиком
    // аргумент — массив пространств, поэтому разворачиваем на два уровня
    expect(vi.mocked(deleteSpaceDatabases).mock.calls.flat(2)).toContain(a1);
    // фотографии веса живут в отдельной базе — «всё» значит и её
    expect(vi.mocked(deleteWeightPhotoDatabase).mock.calls.flat()).toContain('home');
    // профиль устройства и сессия остаются, данные атлета уходят
    expect(localStorage.getItem('he_profile_v2')).toBe('тренер');
    expect(localStorage.getItem('he_session_v2')).toBe('сессия');
    expect(localStorage.getItem(toPhysicalKey(a1, 'he_profile_v2'))).toBeNull();
    // и облачная копия данных атлета тоже убирается
    expect(purged.flat()).toContain(a1);
  });
});

describe('файл копии для пользователя', () => {
  beforeEach(() => {
    localStorage.clear();
    readSpaceStores.mockClear();
    writeSpaceStores.mockClear();
  });

  it('backupFile отдаёт имя с датой и текст, который читается обратно', async () => {
    const a1 = athleteSpaceId('a1');
    const reg = setActiveSpace(
      upsertSpace(emptyRegistry(), { id: a1, athleteId: 'a1', label: 'Иван' }).registry,
      'home',
    );
    localStorage.setItem(DATA_SPACE_KEY, serializeRegistry(reg));
    localStorage.setItem('he_profile_v2', '{"name":"Тренер"}');

    const { backupFile, parseBackup, BACKUP_VERSION } = await import('../data-backup');
    const file = await backupFile();

    expect(file.name).toMatch(/^health-engine-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = parseBackup(file.text);
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.localStorage.he_profile_v2).toContain('Тренер');
    expect(Object.keys(parsed.spaceStores || {})).toContain('home');
  });

  it('describeBackup считает пространства, записи и ключи — цифры для подтверждения', async () => {
    const { describeBackup } = await import('../data-backup');
    const b: AppBackup = {
      app: 'health-engine',
      version: '2.0',
      createdAt: '2026-11-01T10:20:00.000Z',
      stores: {},
      spaceStores: {
        home: { training_log: [{}, {}, {}], labs_log: [] },
        asp_a1: { labs_log: [{}, {}] },
      },
      localStorage: { he_profile_v2: '{}', he_weight_log: '[]' },
    };
    expect(describeBackup(b)).toEqual({
      spaces: 2,
      records: 5,
      keys: 2,
      photos: 0,
      photoBytes: 0,
      photosOmitted: false,
      createdAt: '2026-11-01T10:20:00.000Z',
    });
  });

  it('describeBackup понимает файл 1.0 (без spaceStores)', async () => {
    const { describeBackup } = await import('../data-backup');
    const b: AppBackup = {
      app: 'health-engine',
      version: '1.0',
      createdAt: '2026-05-01T00:00:00.000Z',
      stores: { diary: [{}, {}] },
      localStorage: {},
    };
    expect(describeBackup(b)).toMatchObject({ spaces: 1, records: 2, keys: 0 });
  });

  it('битый файл не считается копией', async () => {
    const { parseBackup } = await import('../data-backup');
    expect(() => parseBackup('{"hello":"world"}')).toThrow('Неизвестный файл бэкапа');
  });
});

describe('забыть всех атлетов', () => {
  beforeEach(() => {
    localStorage.clear();
    try { sessionStorage.clear(); } catch { /* ignore */ }
    readSpaceStores.mockClear();
    writeSpaceStores.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    setSpacePurgeHandler(null);
  });

  it('убирает данные и записи всех атлетов, но не трогает домашнее пространство', async () => {
    const a1 = athleteSpaceId('a1');
    const a2 = athleteSpaceId('a2');
    let reg = upsertSpace(emptyRegistry(), { id: a1, athleteId: 'a1', label: 'Иван' }).registry;
    reg = upsertSpace(reg, { id: a2, athleteId: 'a2', label: 'Пётр' }).registry;
    localStorage.setItem(DATA_SPACE_KEY, serializeRegistry(setActiveSpace(reg, a2)));

    localStorage.setItem('he_profile_v2', 'тренер');
    localStorage.setItem(toPhysicalKey(a1, 'he_profile_v2'), 'иван');
    localStorage.setItem(toPhysicalKey(a2, 'he_profile_v2'), 'пётр');
    sessionStorage.setItem(`he_ath_${a1}__he_draft_diary`, 'черновик');

    const { forgetAllAthletes } = await import('../data-backup');
    const { deleteSpaceDatabases } = await import('../db');
    const { installDataSpaceStorage } = await import('../data-space');
    // Черновики чистятся через шов над sessionStorage — он ставится при старте
    // приложения; в тесте ставим явно (окно настоящее, jsdom).
    expect(installDataSpaceStorage(window)).not.toBeNull();
    const purged: string[][] = [];
    setSpacePurgeHandler(ids => { purged.push([...ids]); });
    const res = await forgetAllAthletes();

    expect(res.spaces).toBe(2);
    // данные атлетов ушли вместе с их черновиками
    expect(localStorage.getItem(toPhysicalKey(a1, 'he_profile_v2'))).toBeNull();
    expect(localStorage.getItem(toPhysicalKey(a2, 'he_profile_v2'))).toBeNull();
    expect(sessionStorage.getItem(`he_ath_${a1}__he_draft_diary`)).toBeNull();
    // собственные данные и вход остаются: это не полный сброс приложения
    expect(localStorage.getItem('he_profile_v2')).toBe('тренер');
    // реестр: только домашнее пространство, и оно активно
    const after = JSON.parse(localStorage.getItem(DATA_SPACE_KEY) as string);
    expect(after.spaces.map((s: any) => s.id)).toEqual(['home']);
    expect(after.active).toBe('home');
    // базы атлетов удалены (обе — основная и фото, это делает deleteSpaceDatabases)
    expect(vi.mocked(deleteSpaceDatabases).mock.calls.flat(2)).toEqual(expect.arrayContaining([a1, a2]));
    // и облачные копии тоже: без этого «забыли» было бы правдой только на телефоне
    expect(purged.flat()).toEqual(expect.arrayContaining([a1, a2]));
  });

  it('когда атлетов нет — ничего не удаляет и возвращает 0', async () => {
    localStorage.setItem('he_profile_v2', 'тренер');
    const { forgetAllAthletes } = await import('../data-backup');
    const { deleteSpaceDatabases } = await import('../db');
    const res = await forgetAllAthletes();
    expect(res.spaces).toBe(0);
    expect(deleteSpaceDatabases).not.toHaveBeenCalled();
    expect(localStorage.getItem('he_profile_v2')).toBe('тренер');
  });
});

describe('копия уносит фотографии веса', () => {
  beforeEach(() => {
    localStorage.clear();
    photos.bySpace = {};
    photos.written = [];
  });

  const withAthlete = (athleteId: string) => {
    const sid = athleteSpaceId(athleteId);
    // реестр дополняем, а не перезаписываем: в файл должны попасть ВСЕ атлеты
    const base = parseRegistry(localStorage.getItem(DATA_SPACE_KEY));
    localStorage.setItem(
      DATA_SPACE_KEY,
      serializeRegistry(upsertSpace(base, { id: sid, athleteId, label: 'Атлет' }).registry),
    );
    return sid;
  };

  it('фото всех пространств попадают в файл, и сводка их считает', async () => {
    const a1 = withAthlete('a1');
    const a2 = withAthlete('a2');
    photos.bySpace[HOME_SPACE_ID] = [{ date: '2026-10-01', photos: ['data:1'] }];
    photos.bySpace[a1] = [{ date: '2026-10-02', photos: ['data:22', 'data:333'] }];
    photos.bySpace[a2] = [{ date: '2026-10-03', photos: ['data:4444'] }];

    const { collectBackup, describeBackup } = await import('../data-backup');
    const b = await collectBackup();

    expect(b.version).toBe('3.0');
    expect(b.photoStores?.[HOME_SPACE_ID]?.[0].photos).toEqual(['data:1']);
    expect(b.photoStores?.[a1]?.[0].photos).toEqual(['data:22', 'data:333']);
    expect(b.photoStores?.[a2]?.[0].photos).toEqual(['data:4444']);
    const info = describeBackup(b);
    expect(info.photos).toBe(4);
    expect(info.photoBytes).toBe('data:1'.length + 'data:22'.length + 'data:333'.length + 'data:4444'.length);
    expect(info.photosOmitted).toBe(false);
  });

  it('восстановление кладёт фото в базу своего пространства', async () => {
    const a1 = athleteSpaceId('a1');
    const { importBackup } = await import('../data-backup');
    await importBackup({
      app: 'health-engine',
      version: '3.0',
      createdAt: '2026-11-01T00:00:00.000Z',
      stores: {},
      spaceStores: { [a1]: { diary: [] } },
      photoStores: { [a1]: [{ date: '2026-10-02', photos: ['data:a'] }] },
      localStorage: {},
    });

    expect(photos.written).toEqual([{ spaceId: a1, date: '2026-10-02', photos: ['data:a'] }]);
  });

  it('слишком большой объём фото в файл не кладём и говорим об этом прямо', async () => {
    withAthlete('a1');
    photos.bySpace[HOME_SPACE_ID] = [{ date: '2026-10-01', photos: ['x'.repeat(50)] }];
    const { collectBackup, describeBackup } = await import('../data-backup');

    const b = await collectBackup({ maxPhotoBytes: 10 });

    expect(b.photoStores).toBeUndefined();
    expect(b.photosOmitted).toBe(true);
    const info = describeBackup(b);
    expect(info.photos).toBe(0);
    expect(info.photosOmitted).toBe(true);
  });

  it('когда фото нет — в файле нет ни фото, ни флага «не влезли»', async () => {
    const { collectBackup, describeBackup } = await import('../data-backup');
    const b = await collectBackup();
    expect(b.photoStores).toBeUndefined();
    expect(b.photosOmitted).toBeUndefined();
    expect(describeBackup(b).photos).toBe(0);
    expect(describeBackup(b).photosOmitted).toBe(false);
  });

  it('файл формата 2.0 (без фото) восстанавливается и фото не трогает', async () => {
    const { importBackup } = await import('../data-backup');
    await importBackup({
      app: 'health-engine',
      version: '2.0',
      createdAt: '2026-11-01T00:00:00.000Z',
      stores: {},
      spaceStores: { home: { diary: [] } },
      localStorage: {},
    });
    expect(photos.written).toEqual([]);
  });
});
