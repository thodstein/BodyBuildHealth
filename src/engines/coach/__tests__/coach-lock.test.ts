import { describe, expect, it } from 'vitest';
import {
  clampAutoLock,
  createCoachLock,
  disableCoachLock,
  emptyCoachLock,
  isCoachUnlocked,
  parseCoachLock,
  pinPolicyError,
  readCoachLock,
  verifyCoachPin,
  writeCoachLock,
  writeUnlockedAt,
} from '../coach-lock.engine';

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    dump: () => map,
  };
};

describe('правила PIN', () => {
  it('4–8 цифр; короче/длиннее/буквы — понятная причина', () => {
    expect(pinPolicyError('1234')).toBeNull();
    expect(pinPolicyError('12345678')).toBeNull();
    expect(pinPolicyError('123')).toBe('short');
    expect(pinPolicyError('123456789')).toBe('long');
    expect(pinPolicyError('12a4')).toBe('nondigit');
  });

  it('автовыход ограничен 1..240 минутами, 0 — выключен', () => {
    expect(clampAutoLock(0)).toBe(0);
    expect(clampAutoLock(-5)).toBe(0);
    expect(clampAutoLock(7)).toBe(7);
    expect(clampAutoLock(9999)).toBe(240);
    expect(clampAutoLock(Number.NaN)).toBe(15);
  });
});

describe('хранение и проверка', () => {
  it('PIN не хранится в открытом виде; правильный проходит, чужой — нет', async () => {
    const { settings, error } = await createCoachLock('2468', { salt: 'fixed', now: '2026-11-05T10:00:00.000Z' });
    expect(error).toBeNull();
    expect(settings?.enabled).toBe(true);
    expect(settings?.hash).not.toContain('2468');
    expect(await verifyCoachPin(settings!, '2468')).toBe(true);
    expect(await verifyCoachPin(settings!, '2469')).toBe(false);
    expect(await verifyCoachPin(settings!, '24680')).toBe(false);
  });

  it('создание с негодным PIN ничего не включает', async () => {
    const { settings, error } = await createCoachLock('12');
    expect(settings).toBeNull();
    expect(error).toBe('short');
  });

  it('выключение стирает хэш и соль', async () => {
    const { settings } = await createCoachLock('1234', { salt: 's' });
    const off = disableCoachLock(settings!, { now: '2026-11-05T11:00:00.000Z' });
    expect(off.enabled).toBe(false);
    expect(off.hash).toBe('');
    expect(off.salt).toBe('');
    expect(await verifyCoachPin(off, '1234')).toBe(false);
  });

  it('запись/чтение настройки, битый JSON и чужая версия — выключено', async () => {
    const storage = memory();
    const { settings } = await createCoachLock('4321', { salt: 's' });
    writeCoachLock(storage, settings!);
    expect(readCoachLock(storage).enabled).toBe(true);
    expect(readCoachLock({ getItem: () => '{oops' }).enabled).toBe(false);
    expect(parseCoachLock(JSON.stringify({ version: 2, enabled: true, hash: 'x' })).enabled).toBe(false);
    // enabled без хэша — не защита, считаем выключенным.
    expect(parseCoachLock(JSON.stringify({ version: 1, enabled: true })).enabled).toBe(false);
  });
});

describe('сессия: автовыход', () => {
  const settings = {
    ...emptyCoachLock(),
    enabled: true,
    hash: 'x',
    salt: 's',
    autoLockMin: 15,
  };

  it('без PIN профиль всегда разблокирован', () => {
    expect(isCoachUnlocked(emptyCoachLock(), null, Date.now())).toBe(true);
  });

  it('с PIN и без отметки — закрыт', () => {
    expect(isCoachUnlocked(settings, null, Date.parse('2026-11-05T10:00:00.000Z'))).toBe(false);
  });

  it('после входа — открыт, через 15 минут бездействия — нет', () => {
    const at = '2026-11-05T10:00:00.000Z';
    expect(isCoachUnlocked(settings, at, Date.parse('2026-11-05T10:14:59.000Z'))).toBe(true);
    expect(isCoachUnlocked(settings, at, Date.parse('2026-11-05T10:15:01.000Z'))).toBe(false);
  });

  it('автовыход «выкл» (0) держит сессию, пока её не закроют вручную', () => {
    const forever = { ...settings, autoLockMin: 0 };
    expect(isCoachUnlocked(forever, '2020-01-01T00:00:00.000Z', Date.now())).toBe(true);
  });

  it('сброс отметки закрывает профиль', () => {
    const storage = memory();
    writeUnlockedAt(storage, '2026-11-05T10:00:00.000Z');
    expect(storage.dump().size).toBe(1);
    writeUnlockedAt(storage, null);
    expect(storage.dump().size).toBe(0);
  });
});
