/**
 * auth-module-sync.test.ts — облако обязано включаться при КАЖДОМ входе.
 *
 * Регрессия на «в АПК нет синхронизации»: раньше initKvSync вызывался только
 * при наличии привязанного Telegram-токена, поэтому АПК без привязки молча
 * жил локально (и кнопка синка в шапке не появлялась).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  initKvSync: vi.fn(async () => ({ status: 'idle' })),
  getLinkedTgToken: vi.fn((): string | null => null),
}));

vi.mock('../../core/cloud-kv', () => ({
  initKvSync: mocks.initKvSync,
  getLinkedTgToken: mocks.getLinkedTgToken,
}));

vi.mock('../../core/app-platform', () => ({
  getSyncIdentity: () => ({ kind: 'device', id: 'dev_test_identity' }),
}));

vi.mock('../../core/db', () => ({
  db: {
    getAll: async () => [],
    put: async () => undefined,
  },
}));

vi.mock('../../core/auth-manager', () => ({
  ensureAdmin: async () => undefined,
}));

async function login() {
  const { renderAuthModule } = await import('../auth-module');
  const container = document.createElement('div');
  const onLogin = vi.fn();
  await renderAuthModule(container, onLogin);
  return { onLogin };
}

describe('auth-module: синхронизация с облаком при входе', () => {
  beforeEach(() => {
    mocks.initKvSync.mockClear();
    mocks.getLinkedTgToken.mockReturnValue(null);
    localStorage.clear();
  });

  afterEach(() => {
    delete (window as unknown as { Telegram?: unknown }).Telegram;
  });

  it('АПК без привязки к Telegram: синк всё равно включается (своё пространство устройства)', async () => {
    await login();
    expect(mocks.initKvSync).toHaveBeenCalledTimes(1);
    expect(mocks.initKvSync).toHaveBeenCalledWith('dev_test_identity', undefined);
  });

  it('АПК с привязанным токеном: синк идёт в пространство Telegram-аккаунта', async () => {
    mocks.getLinkedTgToken.mockReturnValue('tk_linked');
    await login();
    expect(mocks.initKvSync).toHaveBeenCalledWith('dev_test_identity', { token: 'tk_linked' });
  });

  it('вход не падает, если облако недоступно', async () => {
    mocks.initKvSync.mockRejectedValueOnce(new Error('offline'));
    const { onLogin } = await login();
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
