/**
 * data-space.test.ts — пространства данных.
 *
 * Тесты защищают не «фичу», а БЕЗОПАСНОСТЬ данных:
 *  • в home физические ключи не меняются (обновление ничего не переносит);
 *  • запись под атлетом не видна из другого атлета и из home;
 *  • ключ, пришедший из бэкапа/облака (`he_ath_…__…`), не префиксуется второй раз;
 *  • данные устройства (режим тренера, синк, тема) видны везде и не теряются;
 *  • перечисление показывает только активное пространство;
 *  • реестр терпим к мусору, лимит 20 соблюдается, удаление активного → home;
 *  • удаление данных атлета не трогает ни home, ни других атлетов.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  ATHLETE_SPACE_PREFIX,
  DATA_SPACE_KEY,
  HOME_SPACE_ID,
  MAX_DATA_SPACES,
  _resetDataSpaceCache,
  athleteSpaceId,
  athleteSpacesByRecent,
  clearAllDeviceStorage,
  clearAllSessionStorage,
  clearSessionSpaceData,
  clearSpaceData,
  createSpaceStorage,
  emptyRegistry,
  findSpace,
  installDataSpaceStorage,
  isDeviceLevelKey,
  isPhysicalSpaceKey,
  parseRegistry,
  rawKeys,
  removeSpace,
  serializeRegistry,
  setActiveSpace,
  spaceForAthlete,
  spaceIdOfKey,
  spaceKeyPrefix,
  spaceUsage,
  spaceUsageMap,
  toLogicalKey,
  toPhysicalKey,
  touchSpaceOpened,
  upsertSpace,
  type RawStorageLike,
} from '../data-space';

/** Мини-реализация Storage (как настоящая: только строки, порядок вставки). */
function makeRaw(init: Record<string, string> = {}): RawStorageLike & { dump: () => Record<string, string> } {
  const map = new Map<string, string>(Object.entries(init));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map),
  };
}

describe('классификация ключей', () => {
  it('данные устройства: режим тренера, синк, тема, сессия', () => {
    for (const k of [
      'he_coach_mode',
      'he_coach_notes',
      'he_coach_athlete_log',
      'he_sync_meta_v1',
      'he_sync_tg_token_v1',
      DATA_SPACE_KEY,
      'he_theme',
      'he_apk_theme_v1',
      'he_session_v2',
      'he_crypto_key',
      'he_manual_onboarding_done',
    ]) {
      expect(isDeviceLevelKey(k), k).toBe(true);
    }
  });

  it('данные атлета: профиль, дневники, планы, анализы', () => {
    for (const k of [
      'he_profile_v2',
      'he_weight_diary',
      'he_sleep_diary',
      'he_labs_v2',
      'he_nutrition_plan',
      'he_pl_plans_v1',
    ]) {
      expect(isDeviceLevelKey(k), k).toBe(false);
    }
  });
});

describe('преобразование ключей', () => {
  it('home: ключ не меняется ни в одну сторону', () => {
    expect(toPhysicalKey(HOME_SPACE_ID, 'he_profile_v2')).toBe('he_profile_v2');
    expect(toPhysicalKey('', 'he_profile_v2')).toBe('he_profile_v2');
    expect(toLogicalKey('he_profile_v2')).toBe('he_profile_v2');
    expect(spaceIdOfKey('he_profile_v2')).toBeNull();
  });

  it('атлет: логический → физический → логический', () => {
    const sid = athleteSpaceId('a1');
    const phys = toPhysicalKey(sid, 'he_profile_v2');
    expect(phys.startsWith(ATHLETE_SPACE_PREFIX)).toBe(true);
    expect(phys).toContain(sid);
    expect(phys.endsWith('__he_profile_v2')).toBe(true);
    expect(toLogicalKey(phys)).toBe('he_profile_v2');
    expect(spaceIdOfKey(phys)).toEqual({ spaceId: sid, logical: 'he_profile_v2' });
  });

  it('физический ключ не префиксуется повторно (бэкап/облако)', () => {
    const sid = athleteSpaceId('a1');
    const phys = toPhysicalKey(sid, 'he_profile_v2');
    expect(toPhysicalKey(sid, phys)).toBe(phys);
    expect(toPhysicalKey(athleteSpaceId('a2'), phys)).toBe(phys);
  });

  it('ключи устройства не префиксуются даже под атлетом', () => {
    const sid = athleteSpaceId('a1');
    expect(toPhysicalKey(sid, 'he_coach_mode')).toBe('he_coach_mode');
    expect(toPhysicalKey(sid, 'he_sync_meta_v1')).toBe('he_sync_meta_v1');
  });

  it('id пространства стабилен и разводит похожие id атлетов', () => {
    expect(athleteSpaceId('a1')).toBe(athleteSpaceId('a1'));
    expect(athleteSpaceId('a1')).not.toBe(athleteSpaceId('a1 '));
    const weird = athleteSpaceId('a/1:b');
    expect(weird).not.toContain('/');
    expect(weird).not.toContain(':');
    expect(weird).not.toContain(' ');
    // санитизация не должна «склеить» два разных атлета
    expect(athleteSpaceId('a/1:b')).not.toBe(athleteSpaceId('a_1_b'));
  });

  it('spaceKeyPrefix согласован с toPhysicalKey', () => {
    const sid = athleteSpaceId('zz');
    expect(toPhysicalKey(sid, 'he_x')).toBe(spaceKeyPrefix(sid) + 'he_x');
  });
});

describe('реестр пространств', () => {
  it('пустой реестр: только home и он активен', () => {
    const reg = emptyRegistry();
    expect(reg.active).toBe(HOME_SPACE_ID);
    expect(reg.spaces).toHaveLength(1);
    expect(reg.spaces[0]).toMatchObject({ id: HOME_SPACE_ID, athleteId: null });
  });

  it('мусор и чужая версия → home (не падаем, не теряем доступ)', () => {
    for (const raw of [null, '', '{oops', '[]', 'null', JSON.stringify({ version: 2, spaces: [] })]) {
      const reg = parseRegistry(raw);
      expect(reg.active).toBe(HOME_SPACE_ID);
      expect(reg.spaces).toHaveLength(1);
    }
  });

  it('битые записи отбрасываются, дубли схлопываются, активное чинится', () => {
    const raw = JSON.stringify({
      version: 1,
      active: 'asp_нет_такого',
      spaces: [
        { id: HOME_SPACE_ID },
        { id: 'asp_a_1', athleteId: 'a1', label: 'Иван' },
        { id: 'asp_a_1', athleteId: 'a1', label: 'дубль' },
        { id: 'asp__плохо', athleteId: 'x' },
        { id: '', athleteId: 'y' },
        { label: 'без id' },
        null,
        'мусор',
      ],
    });
    const reg = parseRegistry(raw);
    expect(reg.active).toBe(HOME_SPACE_ID); // активного нет в списке → home
    expect(reg.spaces.map(s => s.id)).toEqual([HOME_SPACE_ID, 'asp_a_1']);
  });

  it('реестр переживает roundtrip сериализации', () => {
    const reg = upsertSpace(emptyRegistry(), { id: athleteSpaceId('a1'), athleteId: 'a1', label: 'Иван' }).registry;
    const back = parseRegistry(serializeRegistry(reg));
    expect(back.spaces).toHaveLength(2);
    expect(spaceForAthlete(back, 'a1')?.label).toBe('Иван');
  });

  it('лимит 20 пространств атлетов: 21-е отклоняется, реестр не меняется', () => {
    let reg = emptyRegistry();
    for (let i = 0; i < MAX_DATA_SPACES; i++) {
      const r = upsertSpace(reg, { id: athleteSpaceId(`a${i}`), athleteId: `a${i}`, label: `A${i}` });
      expect(r.error).toBeNull();
      reg = r.registry;
    }
    const before = reg.spaces.length;
    const over = upsertSpace(reg, { id: athleteSpaceId('overflow'), athleteId: 'overflow' });
    expect(over.error).toBe('limit');
    expect(over.registry.spaces).toHaveLength(before);
  });

  it('upsert обновляет существующее пространство (переименование атлета)', () => {
    const id = athleteSpaceId('a1');
    let reg = upsertSpace(emptyRegistry(), { id, athleteId: 'a1', label: 'Иван' }).registry;
    reg = upsertSpace(reg, { id, athleteId: 'a1', label: 'Иван П.' }).registry;
    expect(reg.spaces.filter(s => s.id === id)).toHaveLength(1);
    expect(findSpace(reg, id)?.label).toBe('Иван П.');
  });

  it('нельзя создать пространство с id home или с разделителем', () => {
    expect(upsertSpace(emptyRegistry(), { id: HOME_SPACE_ID }).error).toBe('invalid');
    expect(upsertSpace(emptyRegistry(), { id: 'bad__id' }).error).toBe('invalid');
    expect(upsertSpace(emptyRegistry(), { id: '  ' }).error).toBe('invalid');
  });

  it('удаление активного пространства возвращает в home; home удалить нельзя', () => {
    const id = athleteSpaceId('a1');
    let reg = upsertSpace(emptyRegistry(), { id, athleteId: 'a1' }).registry;
    reg = setActiveSpace(reg, id);
    expect(reg.active).toBe(id);
    const after = removeSpace(reg, id);
    expect(after.active).toBe(HOME_SPACE_ID);
    expect(after.spaces).toHaveLength(1);
    expect(removeSpace(after, HOME_SPACE_ID)).toBe(after);
  });

  it('активация неизвестного пространства откатывается в home', () => {
    expect(setActiveSpace(emptyRegistry(), 'asp_нет').active).toBe(HOME_SPACE_ID);
  });
});

describe('хранилище с активным пространством', () => {
  let raw: ReturnType<typeof makeRaw>;
  let active: string;

  beforeEach(() => {
    raw = makeRaw();
    active = HOME_SPACE_ID;
  });

  const store = () => createSpaceStorage(raw, () => active);

  it('home: ключи пишутся как раньше (байт в байт)', () => {
    store().setItem('he_profile_v2', '{"name":"Я"}');
    expect(raw.dump()).toEqual({ he_profile_v2: '{"name":"Я"}' });
  });

  it('атлет: чтение/запись идут в его префикс, home-значение не задето', () => {
    store().setItem('he_profile_v2', 'home');
    active = athleteSpaceId('a1');
    expect(store().getItem('he_profile_v2')).toBeNull(); // чужих данных не видит
    store().setItem('he_profile_v2', 'a1');
    expect(store().getItem('he_profile_v2')).toBe('a1');
    expect(raw.getItem(toPhysicalKey(athleteSpaceId('a1'), 'he_profile_v2'))).toBe('a1');
    expect(raw.getItem('he_profile_v2')).toBe('home');

    active = athleteSpaceId('a2');
    expect(store().getItem('he_profile_v2')).toBeNull();
    active = HOME_SPACE_ID;
    expect(store().getItem('he_profile_v2')).toBe('home');
  });

  it('данные устройства видны из любого пространства и пишутся без префикса', () => {
    active = athleteSpaceId('a1');
    store().setItem('he_coach_mode', '{"athletes":[]}');
    expect(raw.dump()).toEqual({ he_coach_mode: '{"athletes":[]}' });
    active = athleteSpaceId('a2');
    expect(store().getItem('he_coach_mode')).toBe('{"athletes":[]}');
    active = HOME_SPACE_ID;
    expect(store().getItem('he_coach_mode')).toBe('{"athletes":[]}');
  });

  it('физический ключ из бэкапа пишется как есть (без двойного префикса)', () => {
    active = athleteSpaceId('a1');
    const phys = toPhysicalKey(athleteSpaceId('a1'), 'he_weight_diary');
    store().setItem(phys, '[1,2]');
    expect(raw.getItem(phys)).toBe('[1,2]');
    expect(rawKeys(raw).filter(k => k.includes('he_ath_'))).toHaveLength(1);
    expect(store().getItem('he_weight_diary')).toBe('[1,2]');
  });

  it('перечисление: только активное пространство + устройство', () => {
    store().setItem('he_profile_v2', 'home');
    store().setItem('he_coach_mode', 'x');
    active = athleteSpaceId('a1');
    store().setItem('he_profile_v2', 'a1');
    store().setItem('he_weight_diary', '[]');

    expect(store().length).toBe(3); // he_coach_mode + 2 ключа атлета
    const names = Array.from({ length: store().length }, (_, i) => store().key(i));
    expect(names.sort()).toEqual(['he_coach_mode', 'he_profile_v2', 'he_weight_diary']);

    active = HOME_SPACE_ID;
    const homeNames = Array.from({ length: store().length }, (_, i) => store().key(i));
    expect(homeNames.sort()).toEqual(['he_coach_mode', 'he_profile_v2']);
  });

  it('key(i) вне диапазона → null (не падаем)', () => {
    const s = store();
    expect(s.key(-1)).toBeNull();
    expect(s.key(0)).toBeNull();
    expect(s.key(1.5)).toBeNull();
  });

  it('clear() чистит только активное пространство', () => {
    store().setItem('he_profile_v2', 'home');
    store().setItem('he_coach_mode', 'x');
    active = athleteSpaceId('a1');
    store().setItem('he_profile_v2', 'a1');
    store().setItem('he_weight_diary', '[]');
    store().clear();
    expect(store().getItem('he_profile_v2')).toBeNull();
    expect(raw.getItem('he_profile_v2')).toBe('home');
    expect(raw.getItem('he_coach_mode')).toBe('x');
  });

  it('removeItem не удаляет чужое', () => {
    store().setItem('he_profile_v2', 'home');
    active = athleteSpaceId('a1');
    store().removeItem('he_profile_v2');
    expect(raw.getItem('he_profile_v2')).toBe('home');
  });
});

describe('сырой доступ и удаление данных атлета', () => {
  it('rawKeys отдаёт всё, включая все пространства', () => {
    const raw = makeRaw({
      he_profile_v2: 'home',
      [toPhysicalKey(athleteSpaceId('a1'), 'he_profile_v2')]: 'a1',
      [toPhysicalKey(athleteSpaceId('a2'), 'he_x')]: 'a2',
    });
    expect(rawKeys(raw).sort()).toEqual(
      [
        'he_profile_v2',
        toPhysicalKey(athleteSpaceId('a1'), 'he_profile_v2'),
        toPhysicalKey(athleteSpaceId('a2'), 'he_x'),
      ].sort(),
    );
  });

  it('spaceUsage считает ключи и объём только этого атлета', () => {
    const a1 = athleteSpaceId('a1');
    const raw = makeRaw({
      he_profile_v2: 'home',
      [toPhysicalKey(a1, 'he_profile_v2')]: '1234',
      [toPhysicalKey(a1, 'he_x')]: '12',
      [toPhysicalKey(athleteSpaceId('a2'), 'he_x')]: '1234567890',
    });
    expect(spaceUsage(raw, a1)).toEqual({ keys: 2, bytes: 6 });
  });

  it('clearSpaceData удаляет только пространство атлета', () => {    const a1 = athleteSpaceId('a1');
    const a2 = athleteSpaceId('a2');
    const raw = makeRaw({
      he_profile_v2: 'home',
      [toPhysicalKey(a1, 'he_profile_v2')]: 'a1',
      [toPhysicalKey(a1, 'he_x')]: 'a1',
      [toPhysicalKey(a2, 'he_x')]: 'a2',
    });
    expect(clearSpaceData(raw, a1)).toBe(2);
    expect(raw.dump()).toEqual({
      he_profile_v2: 'home',
      [toPhysicalKey(a2, 'he_x')]: 'a2',
    });
    // home удалять «пространством» нельзя — это защита от тотальной зачистки
    expect(clearSpaceData(raw, HOME_SPACE_ID)).toBe(0);
  });

  it('spaceUsageMap считает объём всех пространств за один проход', () => {
    const a1 = athleteSpaceId('a1');
    const a2 = athleteSpaceId('a2');
    const raw = makeRaw({
      he_profile_v2: 'home-key',
      he_coach_mode: 'coach',
      [toPhysicalKey(a1, 'he_profile_v2')]: '12345',
      [toPhysicalKey(a1, 'he_x')]: 'ab',
      [toPhysicalKey(a2, 'he_x')]: 'abcd',
    });
    const map = spaceUsageMap(raw);
    expect(map.get(a1)).toEqual({ keys: 2, bytes: 7 });
    expect(map.get(a2)).toEqual({ keys: 1, bytes: 4 });
    // ключи домашнего пространства и данные устройства не приписываются атлетам
    expect(map.has(HOME_SPACE_ID)).toBe(false);
    expect(map.size).toBe(2);
  });

  it('touchSpaceOpened отмечает время, но не выдумывает записи и не трогает home', () => {
    const a1 = athleteSpaceId('a1');
    const reg = upsertSpace(emptyRegistry(), { id: a1, athleteId: 'a1', label: 'Иван' }).registry;
    const touched = touchSpaceOpened(reg, a1, '2026-11-04T10:00:00.000Z');
    expect(touched.spaces.find(s => s.id === a1)?.lastOpenedAt).toBe('2026-11-04T10:00:00.000Z');
    // неизвестное пространство и home — без изменений (не создаём записей на ходу)
    expect(touchSpaceOpened(reg, athleteSpaceId('zzz'), '2026-11-04T10:00:00.000Z')).toBe(reg);
    expect(touchSpaceOpened(reg, HOME_SPACE_ID, '2026-11-04T10:00:00.000Z')).toBe(reg);
  });

  it('athleteSpacesByRecent ставит последние открытые первыми, без даты — в конце', () => {
    const a1 = athleteSpaceId('a1');
    const a2 = athleteSpaceId('a2');
    const a3 = athleteSpaceId('a3');
    let reg = emptyRegistry();
    reg = upsertSpace(reg, { id: a1, athleteId: 'a1' }).registry;
    reg = upsertSpace(reg, { id: a2, athleteId: 'a2' }).registry;
    reg = upsertSpace(reg, { id: a3, athleteId: 'a3' }).registry;
    reg = touchSpaceOpened(reg, a1, '2026-11-01T10:00:00.000Z');
    reg = touchSpaceOpened(reg, a2, '2026-11-04T10:00:00.000Z');
    expect(athleteSpacesByRecent(reg).map(s => s.id)).toEqual([a2, a1, a3]);
    // home в списке атлетов не появляется
    expect(athleteSpacesByRecent(reg).some(s => s.id === HOME_SPACE_ID)).toBe(false);
  });

  it('clearAllDeviceStorage чистит ВСЕ пространства (аварийный сброс)', () => {    const a1 = athleteSpaceId('a1');
    const raw = makeRaw({
      he_profile_v2: 'home',
      he_coach_mode: 'x',
      [toPhysicalKey(a1, 'he_profile_v2')]: 'a1',
    });
    expect(clearAllDeviceStorage(raw as unknown as Storage)).toBe(3);
    expect(raw.dump()).toEqual({});
  });
});

describe('установка шва (как в приложении)', () => {
  const makeStorage = (raw: ReturnType<typeof makeRaw>) => ({
    get length() {
      return raw.length;
    },
    key: (i: number) => raw.key(i),
    getItem: (k: string) => raw.getItem(k),
    setItem: (k: string, v: string) => raw.setItem(k, v),
    removeItem: (k: string) => raw.removeItem(k),
    clear: () => {
      for (const k of rawKeys(raw)) raw.removeItem(k);
    },
  });

  const makeWin = () => {
    const raw = makeRaw();
    const sraw = makeRaw();
    return {
      window: { localStorage: makeStorage(raw), sessionStorage: makeStorage(sraw) } as unknown as Window,
      raw,
      sraw,
    };
  };

  beforeEach(() => {
    _resetDataSpaceCache();
  });

  it('после установки localStorage сам переключает пространство', () => {
    const { window: win, raw } = makeWin();
    const api = installDataSpaceStorage(win);
    expect(api).not.toBeNull();

    // home — как было
    win.localStorage.setItem('he_profile_v2', 'home');
    expect(raw.getItem('he_profile_v2')).toBe('home');

    // переключились на атлета
    const sid = athleteSpaceId('a1');
    api!.writeRegistry(setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1' }).registry, sid));
    expect(api!.activeSpaceId()).toBe(sid);

    expect(win.localStorage.getItem('he_profile_v2')).toBeNull();
    win.localStorage.setItem('he_profile_v2', 'a1');
    expect(raw.getItem(toPhysicalKey(sid, 'he_profile_v2'))).toBe('a1');
    expect(raw.getItem('he_profile_v2')).toBe('home');

    // вернулись — снова свои данные
    api!.writeRegistry(setActiveSpace(api!.readRegistry(), HOME_SPACE_ID));
    expect(win.localStorage.getItem('he_profile_v2')).toBe('home');
  });

  it('если среда не даёт подменить хранилище — изоляция выключается, а активное возвращается в home', () => {
    const { window: win, raw } = makeWin();
    // готовим реестр с «активным» атлетом
    const sid = athleteSpaceId('a1');
    raw.setItem(
      DATA_SPACE_KEY,
      serializeRegistry(setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1' }).registry, sid)),
    );
    Object.freeze(win.localStorage);

    const api = installDataSpaceStorage(win);
    expect(api).toBeNull(); // шва нет
    // и приложение не должно остаться «в атлете» без шва: это смешало бы данные
    expect(parseRegistry(raw.getItem(DATA_SPACE_KEY)).active).toBe(HOME_SPACE_ID);
  });

  it('реестр лежит в сыром хранилище и переживает переустановку шва', () => {
    const { window: win, raw } = makeWin();
    const api = installDataSpaceStorage(win)!;
    const sid = athleteSpaceId('a1');
    api.writeRegistry(setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Иван' }).registry, sid));

    const saved = raw.getItem(DATA_SPACE_KEY);
    expect(saved).toBeTruthy();
    const reg = parseRegistry(saved);
    expect(reg.active).toBe(sid);
    expect(reg.spaces.map(s => s.label)).toContain('Иван');
  });

  it('повторная установка не создаёт второй шов (иначе двойной префикс)', () => {
    const { window: win } = makeWin();
    const a = installDataSpaceStorage(win);
    const b = installDataSpaceStorage(win);
    expect(b).toBe(a);
  });

  it('длина/перечисление после установки отражают активное пространство', () => {
    const { window: win } = makeWin();
    const api = installDataSpaceStorage(win)!;
    win.localStorage.setItem('he_profile_v2', 'home');
    win.localStorage.setItem('he_theme', 'dark');
    expect(win.localStorage.length).toBe(2);
    const names = Array.from({ length: win.localStorage.length }, (_, i) => win.localStorage.key(i));
    expect(names.sort()).toEqual(['he_profile_v2', 'he_theme']);

    const sid = athleteSpaceId('a1');
    api.writeRegistry(setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1' }).registry, sid));
    win.localStorage.setItem('he_profile_v2', 'a1');
    // тема — устройство, профиль — атлет, реестр пространств — тоже устройство:
    // три видимых ключа, но профиль уже другой.
    expect(win.localStorage.length).toBe(3);
    const namesAfter = Array.from({ length: win.localStorage.length }, (_, i) => win.localStorage.key(i));
    expect(namesAfter.sort()).toEqual([DATA_SPACE_KEY, 'he_profile_v2', 'he_theme']);
    expect(win.localStorage.getItem('he_profile_v2')).toBe('a1');
  });

  it('черновики в sessionStorage не переходят к другому атлету', () => {
    const { window: win, sraw } = makeWin();
    const api = installDataSpaceStorage(win)!;
    // Тренер начал вводить вес у себя (home).
    win.sessionStorage.setItem('he_draft_weight', '{"kg":82}');

    const sid = athleteSpaceId('a1');
    api.writeRegistry(
      setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1' }).registry, sid),
    );

    // У атлета чужого черновика не видно — иначе его цифры попали бы в его дневник.
    expect(win.sessionStorage.getItem('he_draft_weight')).toBeNull();
    expect(win.sessionStorage.length).toBe(0);

    win.sessionStorage.setItem('he_draft_weight', '{"kg":75}');
    expect(sraw.getItem(toPhysicalKey(sid, 'he_draft_weight'))).toBe('{"kg":75}');
    expect(sraw.getItem('he_draft_weight')).toBe('{"kg":82}');

    // Вернулись к своим данным — свой черновик на месте, а не потерян.
    api.writeRegistry(setActiveSpace(api.readRegistry(), HOME_SPACE_ID));
    expect(win.sessionStorage.getItem('he_draft_weight')).toBe('{"kg":82}');
  });

  it('удаление данных атлета снимает и его черновики в sessionStorage', () => {
    const { window: win, sraw } = makeWin();
    const api = installDataSpaceStorage(win)!;
    const sid = athleteSpaceId('a1');
    const other = athleteSpaceId('a2');
    api.writeRegistry(
      setActiveSpace(
        upsertSpace(
          upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1' }).registry,
          { id: other, athleteId: 'a2' },
        ).registry,
        sid,
      ),
    );
    win.sessionStorage.setItem('he_draft_weight', '{"kg":75}');
    sraw.setItem(toPhysicalKey(other, 'he_draft_weight'), '{"kg":90}');

    expect(clearSessionSpaceData(sid)).toBe(1);
    expect(sraw.getItem(toPhysicalKey(sid, 'he_draft_weight'))).toBeNull();
    // чужой атлет не задет
    expect(sraw.getItem(toPhysicalKey(other, 'he_draft_weight'))).toBe('{"kg":90}');
    // home-черновики удалять «пространством» нельзя
    expect(clearSessionSpaceData(HOME_SPACE_ID)).toBe(0);

    expect(clearAllSessionStorage()).toBe(1);
    expect(rawKeys(sraw)).toEqual([]);
  });
});
