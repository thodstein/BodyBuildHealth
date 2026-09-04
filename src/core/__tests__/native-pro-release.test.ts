/**
 * native-pro-release.test.ts — PRO-готовность APK-оболочки.
 * Гарантии:
 * - native-пресет app-config: local/device-local/app-pro + все фичи включены;
 * - telegram-пресет не задет (поведение 1-в-1: push/fileSharing/offlinePack выкл);
 * - native-bridge безопасен вне APK (no-op, без throw);
 * - resolvePlatformModule: точное совпадение → default → первый.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('native PRO release readiness', () => {
  beforeEach(async () => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    delete (window as unknown as { Telegram?: unknown }).Telegram;
    const { resetAppPlatformCache } = await import('../app-platform');
    resetAppPlatformCache();
  });

  afterEach(async () => {
    const { resetAppPlatformCache } = await import('../app-platform');
    resetAppPlatformCache();
  });

  it('1. native-пресет: app-pro + local + все фичи', async () => {
    const { getAppConfig } = await import('../app-config');
    const cfg = getAppConfig('native');
    expect(cfg.platform).toBe('native');
    expect(cfg.packageId).toBe('com.healthengine.app');
    expect(cfg.authMode).toBe('local');
    expect(cfg.syncMode).toBe('device-local');
    expect(cfg.themePreset).toBe('app-pro');
    expect(cfg.features.push).toBe(true);
    expect(cfg.features.biometry).toBe(true);
    expect(cfg.features.cameraUpload).toBe(true);
    expect(cfg.features.fileSharing).toBe(true);
    expect(cfg.features.offlinePack).toBe(true);
  });

  it('2. telegram-пресет не задет (1-в-1)', async () => {
    const { getAppConfig } = await import('../app-config');
    const cfg = getAppConfig('telegram');
    expect(cfg.authMode).toBe('telegram');
    expect(cfg.syncMode).toBe('telegram-cloud');
    expect(cfg.themePreset).toBe('telegram-adaptive');
    expect(cfg.features.push).toBe(false);
    expect(cfg.features.fileSharing).toBe(false);
    expect(cfg.features.offlinePack).toBe(false);
    expect(cfg.telegram.useTelegramChrome).toBe(true);
  });

  it('3. bridge вне APK: no-op без throw', async () => {
    const { haptics, isOnline, getDeviceInfo, initNativePush } =
      await import('../native-bridge');
    await expect(haptics('light')).resolves.toBeUndefined();
    expect(isOnline()).toBe(true);
    const info = await getDeviceInfo();
    expect(info.platform).toBe('web');
    await expect(initNativePush()).resolves.toBe(false);
  });

  it('4. resolvePlatformModule: exact → default → первый', async () => {
    const { resolvePlatformModule } = await import('../app-config');
    expect(
      resolvePlatformModule({ native: 'N', default: 'D', platform: 'native' }),
    ).toBe('N');
    expect(
      resolvePlatformModule({ default: 'D', platform: 'native' }),
    ).toBe('D');
    expect(
      resolvePlatformModule({ telegram: 'T', platform: 'web' }),
    ).toBe('T');
  });
});
