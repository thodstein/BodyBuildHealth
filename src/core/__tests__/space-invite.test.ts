import { describe, it, expect, beforeEach } from 'vitest';
import {
  DATA_SPACE_KEY,
  HOME_SPACE_ID,
  athleteSpaceId,
  emptyRegistry,
  findSpace,
  parseRegistry,
  setActiveSpace,
  upsertSpace,
} from '../data-space';
import { encodeSpaceInvite, ensureSpaceToken, _resetSpaceTokensCache, spaceTokenFor, spaceTokenRecord } from '../space-tokens';
import {
  isJoinedSpace,
  joinErrorText,
  joinSpaceByInvite,
  joinedSpaceIds,
  leaveJoinedSpace,
} from '../space-invite';

const SID = athleteSpaceId('ivanov');
const TOKEN = 'tk_' + 'e'.repeat(48);

function code(spaceId = SID, label = 'Иван', token = TOKEN): string {
  return encodeSpaceInvite({ spaceId, token, role: 'athlete', label, createdAt: '2026-11-06T10:00:00.000Z' });
}

function registryRaw(active = HOME_SPACE_ID): string {
  return JSON.stringify(setActiveSpace(emptyRegistry(), active));
}

beforeEach(() => {
  localStorage.clear();
  _resetSpaceTokensCache();
  localStorage.setItem(DATA_SPACE_KEY, registryRaw());
});

describe('подключение по коду тренера', () => {
  it('добавляет пространство, токен и помечает перенос завершённым', () => {
    const res = joinSpaceByInvite(code(), { now: '2026-11-06T12:00:00.000Z' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.spaceId).toBe(SID);
    expect(res.label).toBe('Иван');

    const reg = parseRegistry(localStorage.getItem(DATA_SPACE_KEY));
    expect(findSpace(reg, SID)?.label).toBe('Иван');
    const rec = spaceTokenRecord(SID);
    expect(rec?.token).toBe(TOKEN);
    expect(rec?.role).toBe('athlete');
    expect(rec?.migratedAt).toBe('2026-11-06T12:00:00.000Z');
    expect(isJoinedSpace(SID)).toBe(true);
    expect(joinedSpaceIds()).toEqual([SID]);
    // активность ставит вызывающий: код не переключает экран сам
    expect(reg.active).toBe(HOME_SPACE_ID);
  });

  it('повторное подключение обновляет подпись, а не плодит записи', () => {
    joinSpaceByInvite(code(SID, 'Иван'));
    joinSpaceByInvite(code(SID, 'Иван П.'));
    expect(joinedSpaceIds()).toEqual([SID]);
    expect(parseRegistry(localStorage.getItem(DATA_SPACE_KEY)).spaces.filter(s => s.id === SID)).toHaveLength(1);
  });

  it('кривой код — понятная ошибка и никаких следов', () => {
    const cases: Array<[string, string]> = [
      ['', 'empty'],
      ['hello', 'format'],
      [code('home'), 'space'],
      [code(SID, 'Иван', 'tk_bad'), 'token'],
    ];
    for (const [input, expected] of cases) {
      const res = joinSpaceByInvite(input);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(expected);
    }
    expect(spaceTokenRecord(SID)).toBeNull();
    expect(parseRegistry(localStorage.getItem(DATA_SPACE_KEY)).spaces).toHaveLength(1);
    expect(joinErrorText('storage')).toContain('места');
  });

  it('не перезаписывает токен уже подключённого устройства', () => {
    joinSpaceByInvite(code());
    const other = 'tk_' + 'f'.repeat(48);
    joinSpaceByInvite(code(SID, 'Иван', other));
    expect(spaceTokenRecord(SID)?.token).toBe(TOKEN);
  });
});

describe('отключение от тренера', () => {
  it('убирает пространство, ключи и токен, но не трогает home', () => {
    localStorage.setItem('he_profile_v2', 'свои данные');
    joinSpaceByInvite(code());
    localStorage.setItem(`he_ath_${SID}__he_note`, 'заметка');
    localStorage.setItem(DATA_SPACE_KEY, JSON.stringify(setActiveSpace(upsertSpace(emptyRegistry(), { id: SID, label: 'Иван' }).registry, SID)));

    const wasActive = leaveJoinedSpace(SID);
    expect(wasActive).toBe(true);
    expect(localStorage.getItem(`he_ath_${SID}__he_note`)).toBeNull();
    // Отключение оставляет могилу токена (иначе объединение реестра с другим
    // устройством вернуло бы доступ), но пользоваться им уже нельзя.
    expect(spaceTokenRecord(SID)?.revokedAt).toBeTruthy();
    expect(spaceTokenFor(SID)).toBeNull();
    expect(isJoinedSpace(SID)).toBe(false);
    expect(findSpace(parseRegistry(localStorage.getItem(DATA_SPACE_KEY)), SID)).toBeNull();
    expect(parseRegistry(localStorage.getItem(DATA_SPACE_KEY)).active).toBe(HOME_SPACE_ID);
    expect(localStorage.getItem('he_profile_v2')).toBe('свои данные');
  });

  it('home отключить нельзя', () => {
    expect(leaveJoinedSpace(HOME_SPACE_ID)).toBe(false);
    expect(leaveJoinedSpace('')).toBe(false);
  });
});

describe('токен из кода важнее локальной заготовки', () => {
  it('ensure с токеном из кода заменяет незрелый локальный токен', () => {
    const local = ensureSpaceToken(SID, { label: 'Иван' });
    expect(local.record?.token).not.toBe(TOKEN);
    joinSpaceByInvite(code());
    expect(spaceTokenRecord(SID)?.token).toBe(TOKEN);
  });
});
