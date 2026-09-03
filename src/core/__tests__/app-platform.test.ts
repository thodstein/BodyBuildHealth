/**
 * app-platform.test.ts — детекция платформы и per-platform конфиг.
 * Гарантии:
 * - Telegram Mini App определяется СТРОГО (initData/user), а не по наличию скрипта;
 * - native (Capacitor) приоритетнее telegram;
 * - конфиг telegram сохраняет поведение 1-в-1 (authMode/syncMode), native — свой пресет;
 * - identity: telegram → tg_<id>, иначе стабильный device id.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function setTelegram(userId?: number, initData = '') {
  const w = window as unknown as {
    Telegram?: { WebApp?: Record<string, unknown> };
  };
  if (userId === undefined && !initData) {
    // «Голый» объект как в обычном браузере: скрипт подключён, initData пуст.
    w.Telegram = { WebApp: { initData: '', initDataUnsafe: {} } };
    return;
  }
  w.Telegram = {
    WebApp: {
      initData: initData || (userId !== undefined ? 'query_id=test' : ''),
      initDataUnsafe: userId !== undefined ? { user: { id: userId } } : {},
    },
  };
}

function setCapacitorNative(native: boolean) {
  const w = window as unknown as { Capacitor?: unknown };
  if (!native) {
    delete w.Capacitor;
    return;
  }
  w.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    platform: 'android',
  };
}

describe('app-platform detection', () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    delete (window as unknown as { Telegram?: unknown }).Telegram;
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    window.location.hash = '';
    const { resetAppPlatformCache } = await import('../app-platform');
    resetAppPlatformCache();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    const { resetAppPlatformCache } = await import('../app-platform');
    resetAppPlatformCache();
  });

  it('1. обычный браузер без TG и Capacitor → web', async () => {
    const { detectAppPlatform, isTelegramContext, isCapacitorNative } =
      await import('../app-platform');
    expect(isTelegramContext()).toBe(false);
    expect(isCapacitorNative()).toBe(false);
    expect(detectAppPlatform()).toBe('web');
  });

  it('2. голый window.Telegram с пустым initData — НЕ telegram', async () => {
    setTelegram();
    const { detectAppPlatform, isTelegramContext } = await import(
      '../app-platform'
    );
    expect(isTelegramContext()).toBe(false);
    expect(detectAppPlatform()).toBe('web');
  });

  it('3. Telegram с user → telegram', async () => {
    setTelegram(12345);
    const { detectAppPlatform, getAppPlatform, isTelegramApp } = await import(
      '../app-platform'
    );
    expect(detectAppPlatform()).toBe('telegram');
    expect(getAppPlatform()).toBe('telegram');
    expect(isTelegramApp()).toBe(true);
  });

  it('4. Telegram с непустым initData без user → telegram', async () => {
    setTelegram(undefined, 'query_id=abc&user=%7B%7D');
    const { detectAppPlatform } = await import('../app-platform');
    expect(detectAppPlatform()).toBe('telegram');
  });

  it('5. Capacitor native приоритетнее telegram', async () => {
    setTelegram(12345);
    setCapacitorNative(true);
    const { detectAppPlatform, isNativeApp } = await import('../app-platform');
    expect(detectAppPlatform()).toBe('native');
    expect(isNativeApp()).toBe(true);
  });

  it('6. только Capacitor → native', async () => {
    setCapacitorNative(true);
    const { detectAppPlatform } = await import('../app-platform');
    expect(detectAppPlatform()).toBe('native');
  });

  it('7. VITE_APP_PLATFORM override побеждает runtime', async () => {
    setTelegram(12345);
    vi.stubEnv('VITE_APP_PLATFORM', 'native');
    const { detectAppPlatform } = await import('../app-platform');
    expect(detectAppPlatform()).toBe('native');
  });

  it('8. applyPlatformAttributes выставляет data-platform и класс', async () => {
    setCapacitorNative(true);
    const { applyPlatformAttributes } = await import('../app-platform');
    expect(applyPlatformAttributes()).toBe('native');
    expect(document.documentElement.dataset.platform).toBe('native');
    expect(document.documentElement.classList.contains('app-native')).toBe(true);
  });

  it('9. getSyncIdentity: telegram → tg_<id>', async () => {
    setTelegram(777);
    const { getSyncIdentity } = await import('../app-platform');
    expect(getSyncIdentity()).toEqual({ kind: 'telegram', id: 'tg_777' });
  });

  it('10. getSyncIdentity: без TG — стабильный device id', async () => {
    const { getSyncIdentity, getOrCreateDeviceId } = await import(
      '../app-platform'
    );
    const a = getSyncIdentity();
    expect(a.kind).toBe('device');
    expect(getOrCreateDeviceId()).toBe(a.id);
    expect(getOrCreateDeviceId()).toBe(a.id);
  });
});

describe('app-config per-platform', () => {
  beforeEach(async () => {
    const { resetAppPlatformCache } = await import('../app-platform');
    resetAppPlatformCache();
  });

  it('11. telegram-конфиг сохраняет поведение Mini App', async () => {
    const { getAppConfig } = await import('../app-config');
    const cfg = getAppConfig('telegram');
    expect(cfg.platform).toBe('telegram');
    expect(cfg.authMode).toBe('telegram');
    expect(cfg.syncMode).toBe('telegram-cloud');
    expect(cfg.themePreset).toBe('telegram-adaptive');
    expect(cfg.telegram.useTelegramChrome).toBe(true);
    // В Mini App нет своих push поверх Telegram.
    expect(cfg.features.push).toBe(false);
  });

  it('12. native-конфиг — PRO-пресет с полным функционалом', async () => {
    const { getAppConfig } = await import('../app-config');
    const cfg = getAppConfig('native');
    expect(cfg.platform).toBe('native');
    expect(cfg.authMode).toBe('local');
    expect(cfg.themePreset).toBe('app-pro');
    expect(cfg.features.push).toBe(true);
    expect(cfg.features.biometry).toBe(true);
    expect(cfg.features.cameraUpload).toBe(true);
    expect(cfg.features.fileSharing).toBe(true);
    expect(cfg.features.offlinePack).toBe(true);
  });

  it('13. resolvePlatformModule выбирает реализацию по платформе', async () => {
    const { resolvePlatformModule } = await import('../app-config');
    const pick = (p: 'telegram' | 'native' | 'web') =>
      resolvePlatformModule({
        telegram: 'tg-mod',
        native: 'native-mod',
        web: 'web-mod',
        platform: p,
      });
    expect(pick('telegram')).toBe('tg-mod');
    expect(pick('native')).toBe('native-mod');
    expect(pick('web')).toBe('web-mod');
    expect(
      resolvePlatformModule({
        native: 'native-mod',
        default: 'fallback',
        platform: 'telegram',
      }),
    ).toBe('fallback');
  });

  it('14. getAppConfig() без аргументов следует текущей платформе', async () => {
    setTelegram(999);
    const { getAppConfig } = await import('../app-config');
    expect(getAppConfig().platform).toBe('telegram');
  });
});
