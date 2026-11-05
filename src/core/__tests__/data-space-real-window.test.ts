/**
 * data-space-real-window.test.ts — шов на НАСТОЯЩИХ объектах Storage (jsdom),
 * а не на подделках из data-space.test.ts.
 *
 * Зачем отдельный файл: установка шва подменяет методы `localStorage` и
 * `sessionStorage` на объекте окна, и после этого весь код в файле живёт
 * «внутри» пространства. Тест стоит особняком — как в приложении, где шов
 * ставится ровно один раз первым действием.
 *
 * Проверяем то, что нельзя проверить на подделке: `length` — аксессор на
 * прототипе Storage, `key()` — нативный, перечисление ключей настоящее.
 */
import { describe, it, expect } from 'vitest';
import {
  _resetDataSpaceCache,
  athleteSpaceId,
  DATA_SPACE_KEY,
  clearSpaceData,
  deviceSessionRaw,
  emptyRegistry,
  HOME_SPACE_ID,
  installDataSpaceStorage,
  rawKeys,
  setActiveSpace,
  toPhysicalKey,
  upsertSpace,
} from '../data-space';

// Как в main.tsx: шов — первое действие приложения.
const api = installDataSpaceStorage(window);

describe('шов на настоящем window', () => {
  it('устанавливается на jsdom и подменяет оба хранилища', () => {
    expect(api).not.toBeNull();
    expect(api!.raw).toBeTruthy();
  });

  it('home остаётся байт в байт прежним, атлет — под префиксом', () => {
    _resetDataSpaceCache();
    localStorage.setItem('he_profile_v2', 'home-profile');
    expect(localStorage.getItem('he_profile_v2')).toBe('home-profile');
    expect(rawKeys(api!.raw)).toContain('he_profile_v2');

    const sid = athleteSpaceId('a1');
    api!.writeRegistry(
      setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Иван' }).registry, sid),
    );
    expect(localStorage.getItem('he_profile_v2')).toBeNull();
    localStorage.setItem('he_profile_v2', 'athlete-profile');
    expect(api!.raw.getItem(toPhysicalKey(sid, 'he_profile_v2'))).toBe('athlete-profile');
    // домашний профиль цел — атлет его не затёр
    expect(api!.raw.getItem('he_profile_v2')).toBe('home-profile');

    api!.writeRegistry(setActiveSpace(api!.readRegistry(), HOME_SPACE_ID));
    expect(localStorage.getItem('he_profile_v2')).toBe('home-profile');
  });

  it('перечисление и длина — это ключи ОТКРЫТОГО пространства, а не сырые', () => {
    _resetDataSpaceCache();
    const sid = athleteSpaceId('a1');
    api!.writeRegistry(
      setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Иван' }).registry, sid),
    );
    localStorage.setItem('he_profile_v2', 'a');
    localStorage.setItem('he_theme', 'dark');

    // два ключа атлета + реестр пространств: он данные устройства и виден везде
    expect(localStorage.length).toBe(3);
    const names = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    expect(names.sort()).toEqual([DATA_SPACE_KEY, 'he_profile_v2', 'he_theme'].sort());

    // а сырое хранилище видит и домашние ключи, и реестр
    expect(rawKeys(api!.raw)).toContain('he_profile_v2');
    expect(rawKeys(api!.raw).length).toBeGreaterThan(localStorage.length);

    api!.writeRegistry(setActiveSpace(api!.readRegistry(), HOME_SPACE_ID));
  });

  it('черновик в настоящем sessionStorage разделён по атлетам', () => {
    _resetDataSpaceCache();
    expect(deviceSessionRaw()).not.toBeNull();
    sessionStorage.setItem('he_draft_weight', '{"kg":82}');
    const sid = athleteSpaceId('a1');
    api!.writeRegistry(
      setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Иван' }).registry, sid),
    );
    // чужого черновика не видно даже через настоящее хранилище
    expect(sessionStorage.getItem('he_draft_weight')).toBeNull();
    sessionStorage.setItem('he_draft_weight', '{"kg":75}');
    // физически у атлета свой ключ, домашний цел
    expect(deviceSessionRaw()!.getItem(toPhysicalKey(sid, 'he_draft_weight'))).toBe('{"kg":75}');
    expect(deviceSessionRaw()!.getItem('he_draft_weight')).toBe('{"kg":82}');

    api!.writeRegistry(setActiveSpace(api!.readRegistry(), HOME_SPACE_ID));
    expect(sessionStorage.getItem('he_draft_weight')).toBe('{"kg":82}');
  });

  it('после установки не остаётся мусорных ключей от неудачной подмены', () => {
    // В средах с именованными свойствами (WebIDL) присваивание метода может
    // записать элемент с именем «getItem». Шов обязан это убрать.
    const keys = rawKeys(deviceSessionRaw()!);
    for (const junk of ['getItem', 'setItem', 'removeItem', 'key', 'clear']) {
      expect(keys).not.toContain(junk);
    }
  });

  /**
   * Синхронизация ставит свой `removeItem` поверх хранилища и только так узнаёт
   * об удалении ключа (отправляет в облако надгробие). Если удалять через снимок
   * методов, она об этом не узнает, и данные «удалённого» атлета останутся на
   * сервере. Поэтому очистка обязана идти через живой метод хранилища.
   */
  it('очистка данных пространства идёт через живой метод хранилища, а не через снимок', () => {
    _resetDataSpaceCache();
    const sid = athleteSpaceId('a1');
    api!.writeRegistry(
      setActiveSpace(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Иван' }).registry, sid),
    );
    localStorage.setItem('he_profile_v2', 'иван');
    const physical = toPhysicalKey(sid, 'he_profile_v2');
    api!.writeRegistry(setActiveSpace(api!.readRegistry(), HOME_SPACE_ID));

    // «Синхронизация»: обёртка над живым методом
    const storage = api!.storage;
    const original = storage.removeItem.bind(storage);
    const seen: string[] = [];
    storage.removeItem = (k: string) => {
      seen.push(k);
      original(k);
    };
    try {
      const removed = clearSpaceData(api!.raw, sid);
      expect(removed).toBeGreaterThan(0);
      expect(seen).toContain(physical);
    } finally {
      storage.removeItem = original;
    }
    // и ключ действительно удалён, а не только «замечен»
    expect(api!.raw.getItem(physical)).toBeNull();
  });
});
