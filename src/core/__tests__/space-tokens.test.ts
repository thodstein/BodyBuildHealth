import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_SPACE_TOKENS,
  SPACE_TOKENS_KEY,
  _resetSpaceTokensCache,
  decodeSpaceInvite,
  emptySpaceTokens,
  encodeSpaceInvite,
  ensureSpaceToken,
  inviteErrorText,
  isValidSpaceId,
  isValidSyncToken,
  listLiveSpaceTokens,
  listSpaceTokens,
  markSpaceTokenMigrated,
  mergeSpaceTokens,
  parseSpaceTokens,
  randomSyncToken,
  readSpaceTokens,
  removeSpaceToken,
  removeSpaceTokens,
  serializeSpaceTokens,
  spaceTokenFor,
  spaceTokenRecord,
  writeSpaceTokenRecord,
  writeSpaceTokens,
  type SpaceTokenRecord,
} from '../space-tokens';

const SID = 'asp_ivanov_a1b2c3';
const SID2 = 'asp_petrov_d4e5f6';

const rec = (patch: Partial<SpaceTokenRecord> = {}): SpaceTokenRecord => ({
  spaceId: SID,
  token: 'tk_' + 'a'.repeat(48),
  role: 'coach',
  label: 'Иван',
  createdAt: '2026-11-06T10:00:00.000Z',
  ...patch,
});

beforeEach(() => {
  localStorage.clear();
  _resetSpaceTokensCache();
});

describe('разбор реестра токенов', () => {
  it('пустой/битый/чужая версия → пустой реестр', () => {
    expect(parseSpaceTokens(null)).toEqual(emptySpaceTokens());
    expect(parseSpaceTokens('{')).toEqual(emptySpaceTokens());
    expect(parseSpaceTokens(JSON.stringify({ version: 2, items: [] }))).toEqual(emptySpaceTokens());
    expect(parseSpaceTokens(JSON.stringify({ version: 1, items: 'x' }))).toEqual(emptySpaceTokens());
  });

  it('отбрасывает мусорные записи и дубли (побеждает последняя)', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        rec({ token: 'nope' }),
        rec(),
        rec({ token: 'tk_' + 'b'.repeat(48) }),
        { spaceId: 'home', token: 'tk_' + 'c'.repeat(48) },
      ],
    });
    const store = parseSpaceTokens(raw);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].token).toBe('tk_' + 'b'.repeat(48));
  });

  it('держит технический потолок разбора', () => {
    const items = Array.from({ length: MAX_SPACE_TOKENS + 5 }, (_, i) =>
      rec({ spaceId: `asp_x_${i}`, token: 'tk_' + i.toString(16).padStart(48, '0') }),
    );
    expect(parseSpaceTokens(JSON.stringify({ version: 1, items })).items).toHaveLength(MAX_SPACE_TOKENS);
  });

  it('serialize/parse — обратимые', () => {
    const store = { version: 1 as const, items: [rec(), rec({ spaceId: SID2, label: undefined })] };
    expect(parseSpaceTokens(serializeSpaceTokens(store))).toEqual(store);
  });
});

describe('валидация', () => {
  it('id пространства: asp_*, без __ и пробелов', () => {
    expect(isValidSpaceId(SID)).toBe(true);
    expect(isValidSpaceId('home')).toBe(false);
    expect(isValidSpaceId('asp_a__b')).toBe(false);
    expect(isValidSpaceId('asp_')).toBe(false);
    expect(isValidSpaceId('asp_иван')).toBe(false);
  });

  it('токен: tk_ + 32…64 hex', () => {
    expect(isValidSyncToken('tk_' + 'a'.repeat(32))).toBe(true);
    expect(isValidSyncToken('tk_' + 'a'.repeat(64))).toBe(true);
    expect(isValidSyncToken('tk_' + 'a'.repeat(31))).toBe(false);
    expect(isValidSyncToken('tk_' + 'z'.repeat(32))).toBe(false);
    expect(isValidSyncToken('tk_' + 'a'.repeat(65))).toBe(false);
  });

  it('randomSyncToken — валидный и разный', () => {
    const a = randomSyncToken();
    const b = randomSyncToken();
    expect(isValidSyncToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('хранилище и операции', () => {
  it('read/write, ensure не создаёт дубль', () => {
    const first = ensureSpaceToken(SID, { label: 'Иван' });
    expect(first.created).toBe(true);
    expect(first.record?.token).toMatch(/^tk_[0-9a-f]{48}$/);
    const second = ensureSpaceToken(SID, { label: 'Иван' });
    expect(second.created).toBe(false);
    expect(second.record?.token).toBe(first.record?.token);
    expect(listSpaceTokens()).toHaveLength(1);
    expect(readSpaceTokens().items[0].spaceId).toBe(SID);
  });

  it('ensure отклоняет плохой id', () => {
    expect(ensureSpaceToken('home').record).toBeNull();
    expect(ensureSpaceToken('nope').record).toBeNull();
  });

  it('перенос отмечается явно: до него spaceTokenFor молчит', () => {
    ensureSpaceToken(SID);
    expect(spaceTokenRecord(SID)?.token).toBeTruthy();
    expect(spaceTokenFor(SID)).toBeNull();
    markSpaceTokenMigrated(SID, '2026-11-06T11:00:00.000Z');
    expect(spaceTokenRecord(SID)?.migratedAt).toBe('2026-11-06T11:00:00.000Z');
    expect(spaceTokenFor(SID)).toBe(spaceTokenRecord(SID)?.token);
  });

  it('подключение по коду: чужой токен и migratedAt', () => {
    const token = 'tk_' + 'd'.repeat(48);
    const { record } = ensureSpaceToken(SID, {
      token,
      role: 'athlete',
      label: 'Тренер',
      migratedAt: '2026-11-06T12:00:00.000Z',
    });
    expect(record?.token).toBe(token);
    expect(record?.role).toBe('athlete');
    expect(spaceTokenFor(SID)).toBe(token);
  });

  it('remove оставляет могилу, а не теряет запись', () => {
    ensureSpaceToken(SID);
    ensureSpaceToken(SID2);
    const token = spaceTokenRecord(SID)?.token;
    removeSpaceToken(SID);
    // Могила: запись осталась, но токен больше не используется. Иначе второе
    // устройство тренера вернуло бы отозванный токен объединением реестра.
    expect(spaceTokenRecord(SID)?.revokedAt).toBeTruthy();
    expect(spaceTokenRecord(SID)?.token).toBe(token);
    expect(spaceTokenFor(SID)).toBeNull();
    expect(listLiveSpaceTokens().map(r => r.spaceId)).toEqual([SID2]);
    removeSpaceTokens([SID2, 'asp_unknown_x']);
    expect(listLiveSpaceTokens()).toEqual([]);
    // запись пустого реестра не «чинит» уже пустой — просто безопасно
    writeSpaceTokens(emptySpaceTokens());
    expect(readSpaceTokens().items).toEqual([]);
  });

  it('после отзыва ensure выдаёт новый токен', () => {
    const first = ensureSpaceToken(SID, { migratedAt: '2026-11-06T11:00:00.000Z' });
    removeSpaceToken(SID);
    const again = ensureSpaceToken(SID);
    expect(again.created).toBe(true);
    expect(again.record?.revokedAt).toBeUndefined();
    expect(again.record?.token).not.toBe(first.record?.token);
    expect(spaceTokenFor(SID)).toBeNull();
  });

  it('объединение реестра сохраняет токены обоих устройств', () => {
    const a: SpaceTokenRecord = {
      spaceId: SID,
      token: 'tk_' + 'a'.repeat(48),
      role: 'coach',
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-06T10:00:00.000Z',
    };
    const b: SpaceTokenRecord = {
      spaceId: SID2,
      token: 'tk_' + 'b'.repeat(48),
      role: 'coach',
      createdAt: '2026-11-06T10:05:00.000Z',
      updatedAt: '2026-11-06T10:05:00.000Z',
    };
    const local = serializeSpaceTokens({ version: 1, items: [a] });
    const remote = serializeSpaceTokens({ version: 1, items: [b] });
    const merged = mergeSpaceTokens(local, remote);
    expect(merged.changed).toBe(true);
    expect(merged.store.items.map(r => r.spaceId).sort()).toEqual([SID, SID2].sort());
    // Могила новее живого токена — объединение её сохраняет.
    const tomb: SpaceTokenRecord = { ...a, revokedAt: '2026-11-06T11:00:00.000Z', updatedAt: '2026-11-06T11:00:00.000Z' };
    const withTomb = mergeSpaceTokens(serializeSpaceTokens({ version: 1, items: [tomb] }), serializeSpaceTokens({ version: 1, items: [a] }));
    expect(withTomb.store.items[0].revokedAt).toBeTruthy();
  });

  it('испорченный ключ не бросает, а читается как пустой', () => {
    localStorage.setItem(SPACE_TOKENS_KEY, '{{');
    _resetSpaceTokensCache();
    expect(readSpaceTokens().items).toEqual([]);
    expect(spaceTokenFor(SID)).toBeNull();
  });

  it('writeSpaceTokenRecord нормализует', () => {
    expect(writeSpaceTokenRecord(rec({ spaceId: 'home' }))).toBeNull();
    expect(writeSpaceTokenRecord(rec({ token: 'bad' }))).toBeNull();
    expect(writeSpaceTokenRecord(rec({ label: '  Иван  ' }))?.label).toBe('Иван');
  });
});

describe('код приглашения', () => {
  it('обратимый, с подписью и без', () => {
    const withLabel = encodeSpaceInvite(rec());
    const a = decodeSpaceInvite(withLabel);
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.invite).toEqual({ spaceId: SID, token: rec().token, role: 'coach', label: 'Иван' });
    }
    const raw = encodeSpaceInvite(rec({ role: 'athlete', label: undefined }));
    const b = decodeSpaceInvite(raw);
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.invite).toEqual({ spaceId: SID, token: rec().token, role: 'athlete' });
  });

  it('кириллица и точки в подписи не ломают разбор', () => {
    const code = encodeSpaceInvite(rec({ label: 'Иван П. (зал №1)' }));
    expect(code.split('.').length).toBeGreaterThan(4);
    const d = decodeSpaceInvite(`  ${code}  `);
    expect(d.ok && d.invite.label).toBe('Иван П. (зал №1)');
  });

  it('ошибки разбора', () => {
    expect(decodeSpaceInvite('')).toEqual({ ok: false, error: 'empty' });
    expect(decodeSpaceInvite('hello')).toEqual({ ok: false, error: 'format' });
    expect(decodeSpaceInvite('BBA1.home.tk_' + 'a'.repeat(48) + '.a')).toEqual({ ok: false, error: 'space' });
    expect(decodeSpaceInvite('BBA1.asp_x_a1.tk_zzz.a')).toEqual({ ok: false, error: 'token' });
    expect(decodeSpaceInvite('BBA1.asp_x_a1.' + rec().token + '.a.%E0%A4%A')).toEqual({
      ok: false,
      error: 'label',
    });
    expect(inviteErrorText('token')).toContain('ключ');
  });
});
