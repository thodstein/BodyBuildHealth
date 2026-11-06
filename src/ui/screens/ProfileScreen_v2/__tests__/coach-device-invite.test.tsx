/**
 * coach-device-invite.test.tsx — «телефон атлета».
 *
 * Обещания экрана:
 *  • без пространств код не выдаётся, а экран объясняет, что нужно сначала;
 *  • «Создать код» переносит данные в облако и показывает код, событие в журнале;
 *  • код можно вставить и подключиться — этот телефон переключается на пространство;
 *  • подключённое пространство можно отключить (локальная копия уходит).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

const kv = vi.hoisted(() => ({
  migrate: vi.fn(async (_sid: string) => true),
  rotate: vi.fn(async (_sid: string) => 'tk_' + '9'.repeat(48)),
  purge: vi.fn(async (_ids: readonly string[]) => 1),
}));

/**
 * Мок облака: кроме счётчика вызовов он делает то, что делает настоящий движок
 * в части реестра (перенос → `migratedAt`, смена кода → новый токен, отзыв →
 * запись удалена). Иначе карточка рисовала бы состояние «до» и тест проверял бы
 * не UI, а мок.
 */
vi.mock('../../../../core/cloud-kv', async () => {
  const tokens = await import('../../../../core/space-tokens');
  return {
    isKvCloudConfigured: () => true,
    getKvSyncState: () => ({ status: 'idle' }),
    migrateSpaceToToken: async (sid: string) => {
      const ok = await kv.migrate(sid);
      if (ok) tokens.markSpaceTokenMigrated(sid, '2026-11-06T10:00:00.000Z');
      return ok;
    },
    rotateSpaceToken: async (sid: string) => {
      const next = await kv.rotate(sid);
      const cur = tokens.spaceTokenRecord(sid);
      if (!cur || !next) return null;
      tokens.writeSpaceTokenRecord({ ...cur, token: next, migratedAt: new Date().toISOString() });
      return next;
    },
    purgeSpacesFromCloud: async (ids: readonly string[]) => {
      const n = await kv.purge(ids);
      for (const id of ids) tokens.removeSpaceToken(id);
      return n;
    },
  };
});

vi.mock('../../../../core/apk-share', () => ({
  copyOrShareText: vi.fn(async () => 'copied'),
}));

/** Удаление базы пространства: «отключиться» обязано унести и её, а не только ключи. */
const dbCalls = vi.hoisted(() => ({ deleted: [] as string[][] }));
vi.mock('../../../../core/db', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../core/db')>();
  return {
    ...actual,
    deleteSpaceDatabases: vi.fn(async (ids: readonly string[]) => {
      dbCalls.deleted.push([...ids]);
    }),
  };
});

import { CoachDeviceInviteCard } from '../CoachDeviceInviteCard';
import {
  DATA_SPACE_KEY,
  _resetDataSpaceCache,
  athleteSpaceId,
  emptyRegistry,
  readRegistryFromStorage,
  setActiveSpace,
  upsertSpace,
  writeRegistryToStorage,
  type DataSpaceRecord,
} from '../../../../core/data-space';
import {
  _resetSpaceTokensCache,
  encodeSpaceInvite,
  ensureSpaceToken,
  markSpaceTokenMigrated,
  spaceTokenFor,
  spaceTokenRecord,
} from '../../../../core/space-tokens';

const SID = athleteSpaceId('ivanov');

const stubReload = () => {
  const reload = vi.fn();
  const original = window.location.reload;
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
  return {
    reload,
    restore: () =>
      Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: original } }),
  };
};

function seededRegistry(): DataSpaceRecord[] {
  const reg = upsertSpace(emptyRegistry(), { id: SID, athleteId: 'ivanov', label: 'Иван' }).registry;
  writeRegistryToStorage(setActiveSpace(reg, 'home'));
  _resetDataSpaceCache();
  return readRegistryFromStorage().spaces;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  _resetDataSpaceCache();
  _resetSpaceTokensCache();
  dbCalls.deleted = [];
  kv.migrate.mockClear();
  kv.rotate.mockClear();
  kv.purge.mockClear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  _resetDataSpaceCache();
  _resetSpaceTokensCache();
});

describe('тренер: код для телефона атлета', () => {
  it('без пространств объясняет, что делать, и не даёт создать код', () => {
    const { container } = render(
      <CoachDeviceInviteCard spaces={[{ id: 'home', athleteId: null, label: 'Мои данные', createdAt: '' }]} onAudit={() => {}} />,
    );
    expect(container.querySelector('[data-coach="device-invite-create"]')).toBeNull();
    expect(container.querySelector('[data-coach="device-invite-empty"]')?.textContent).toContain('нет ни одного пространства');
  });

  it('создаёт код, переносит данные и пишет событие', async () => {
    const spaces = seededRegistry();
    const audit = vi.fn();
    const { container } = render(<CoachDeviceInviteCard spaces={spaces} onAudit={audit} />);

    fireEvent.click(container.querySelector('[data-coach="device-invite-create"]') as HTMLElement);

    await waitFor(() => expect(spaceTokenRecord(SID)).not.toBeNull());
    expect(kv.migrate).toHaveBeenCalledWith(SID);
    expect(audit).toHaveBeenCalledWith('invite-created', 'ivanov');
    const code = (container.querySelector('[data-coach="device-invite-code"]') as HTMLTextAreaElement).value;
    expect(code.startsWith('BBA1.' + SID + '.tk_')).toBe(true);
    expect(container.querySelector('[data-coach="device-invite-migrated"]')?.textContent).toContain('перенесены');
  });

  it('ошибка переноса честно показывается и код не выдаётся', async () => {
    const spaces = seededRegistry();
    kv.migrate.mockResolvedValueOnce(false);
    const { container } = render(<CoachDeviceInviteCard spaces={spaces} onAudit={() => {}} />);
    fireEvent.click(container.querySelector('[data-coach="device-invite-create"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-coach="device-invite-error"]')?.textContent).toContain('Не удалось перенести'),
    );
    // токен мог появиться, но migratedAt нет → код не показан
    expect(container.querySelector('[data-coach="device-invite-code"]')).toBeNull();
  });

  it('«Новый код» требует подтверждения и меняет токен', async () => {
    const spaces = seededRegistry();
    ensureSpaceToken(SID, { token: 'tk_' + '3'.repeat(48), label: 'Иван' });
    markSpaceTokenMigrated(SID, '2026-11-06T10:00:00.000Z');
    const { container } = render(<CoachDeviceInviteCard spaces={spaces} onAudit={() => {}} />);

    const rotate = () => container.querySelector('[data-coach="device-invite-rotate"]') as HTMLElement;
    fireEvent.click(rotate());
    expect(rotate().textContent).toContain('Точно сменить');
    expect(kv.rotate).not.toHaveBeenCalled();
    fireEvent.click(rotate());
    await waitFor(() => expect(kv.rotate).toHaveBeenCalledWith(SID));
    await waitFor(() => expect(spaceTokenRecord(SID)?.token).toBe('tk_' + '9'.repeat(48)));
  });

  it('«Отключить телефон» чистит облако и маркер', async () => {
    const spaces = seededRegistry();
    ensureSpaceToken(SID, { token: 'tk_' + '3'.repeat(48), label: 'Иван' });
    markSpaceTokenMigrated(SID, '2026-11-06T10:00:00.000Z');
    const { container } = render(<CoachDeviceInviteCard spaces={spaces} onAudit={() => {}} />);

    const revoke = () => container.querySelector('[data-coach="device-invite-revoke"]') as HTMLElement;
    fireEvent.click(revoke());
    fireEvent.click(revoke());
    await waitFor(() => expect(kv.purge).toHaveBeenCalledWith([SID]));
    await waitFor(() => expect(container.querySelector('[data-coach="device-invite-code"]')).toBeNull());
  });
});

describe('атлет: подключение по коду', () => {
  it('валидный код подключает пространство и переключает на него', async () => {
    writeRegistryToStorage(emptyRegistry());
    _resetDataSpaceCache();
    const { restore } = stubReload();
    const audit = vi.fn();
    const token = 'tk_' + '4'.repeat(48);
    const code = encodeSpaceInvite({
      spaceId: SID,
      token,
      role: 'athlete',
      label: 'Иван',
      createdAt: '2026-11-06T10:00:00.000Z',
    });

    const { container } = render(
      <CoachDeviceInviteCard
        spaces={[{ id: 'home', athleteId: null, label: 'Мои данные', createdAt: '' }]}
        onAudit={audit}
      />,
    );
    fireEvent.change(container.querySelector('[data-coach="device-join-code"]') as HTMLElement, {
      target: { value: code },
    });
    fireEvent.click(container.querySelector('[data-coach="device-join"]') as HTMLElement);

    await waitFor(() => expect(readRegistryFromStorage().active).toBe(SID));
    expect(spaceTokenRecord(SID)?.token).toBe(token);
    expect(audit).toHaveBeenCalledWith('space-joined');
    expect(container.querySelector('[data-coach="device-joined"]')?.textContent).toContain('Иван');
    restore();
  });

  it('кривой код — ошибка без переключения', async () => {
    writeRegistryToStorage(emptyRegistry());
    _resetDataSpaceCache();
    const { container } = render(
      <CoachDeviceInviteCard
        spaces={[{ id: 'home', athleteId: null, label: 'Мои данные', createdAt: '' }]}
        onAudit={() => {}}
      />,
    );
    fireEvent.change(container.querySelector('[data-coach="device-join-code"]') as HTMLElement, {
      target: { value: 'не код' },
    });
    fireEvent.click(container.querySelector('[data-coach="device-join"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-coach="device-join-error"]')?.textContent).toContain('BBA1'),
    );
    expect(readRegistryFromStorage().active).toBe('home');
  });

  it('на телефоне атлета не предлагает выдать или сменить код чужого пространства', async () => {
    const token = 'tk_' + '6'.repeat(48);
    const code = encodeSpaceInvite({
      spaceId: SID,
      token,
      role: 'athlete',
      label: 'Тренер',
      createdAt: '2026-11-06T10:00:00.000Z',
    });
    const { joinSpaceByInvite } = await import('../../../../core/space-invite');
    joinSpaceByInvite(code);
    _resetDataSpaceCache();
    const spaces = readRegistryFromStorage().spaces;

    const { container } = render(<CoachDeviceInviteCard spaces={spaces} onAudit={() => {}} />);
    // Выдавать и менять код вправе только тренер: на телефоне атлета этих
    // действий нет вовсе — иначе атлет «ротировал» бы чужой ключ доступа.
    expect(container.querySelector('[data-coach="device-invite-create"]')).toBeNull();
    expect(container.querySelector('[data-coach="device-invite-rotate"]')).toBeNull();
    expect(container.querySelector('[data-coach="device-invite-revoke"]')).toBeNull();
    expect(container.querySelector('[data-coach="device-invite-code"]')).toBeNull();
    expect(container.querySelector('[data-coach="device-invite-group"]')).toBeNull();
    // Пустое состояние объясняет, а не зовёт «добавить атлета».
    expect(container.querySelector('[data-coach="device-invite-empty"]')?.textContent).toContain(
      'подключён к данным тренера',
    );
    expect(container.querySelector('[data-coach="device-joined"]')?.textContent).toContain('Тренер');
  });

  it('подключённое пространство можно отключить', async () => {
    const token = 'tk_' + '5'.repeat(48);
    const code = encodeSpaceInvite({
      spaceId: SID,
      token,
      role: 'athlete',
      label: 'Иван',
      createdAt: '2026-11-06T10:00:00.000Z',
    });
    // готовое состояние: пространство уже подключено
    const { joinSpaceByInvite } = await import('../../../../core/space-invite');
    joinSpaceByInvite(code);
    _resetDataSpaceCache();
    localStorage.setItem(`he_ath_${SID}__he_note`, 'заметка');
    const spaces = readRegistryFromStorage().spaces;
    const { restore } = stubReload();

    const { container } = render(<CoachDeviceInviteCard spaces={spaces} onAudit={() => {}} />);
    fireEvent.click(container.querySelector('[data-coach="device-leave"]') as HTMLElement);

    await waitFor(() => expect(spaceTokenRecord(SID)?.revokedAt).toBeTruthy());
    expect(spaceTokenFor(SID)).toBeNull();
    expect(localStorage.getItem(`he_ath_${SID}__he_note`)).toBeNull();
    // База пространства — тоже копия данных тренера: уходит вместе с ключами.
    await waitFor(() => expect(dbCalls.deleted.flat()).toContain(SID));
    restore();
  });
});

describe('честные границы', () => {
  it('в подписи экрана сказано, что фото веса не синхронизируются', () => {
    const spaces = seededRegistry();
    const { container } = render(<CoachDeviceInviteCard spaces={spaces} onAudit={() => {}} />);
    expect(container.textContent).toContain('Фото веса');
    expect(container.textContent).toContain('ключ доступа');
  });

  it('ключ реестра не зависит от активного пространства', () => {
    seededRegistry();
    expect(localStorage.getItem(DATA_SPACE_KEY)).toBeTruthy();
  });
});
