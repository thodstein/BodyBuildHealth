/**
 * native-biometry.test.ts — биометрия APK через нативный плагин `Biometry`.
 *
 * Регрессия: WebAuthn-путь в Android WebView не имеет платформенного
 * аутентификатора (origin https://localhost не связан с пакетом через
 * Digital Asset Links) — `isUserVerifyingPlatformAuthenticatorAvailable()`
 * всегда false, `credentials.create()` падает. Снаружи «биометрия не
 * работает». Тест фиксирует: в native спрашиваем плагин (BiometricPrompt),
 * а не WebAuthn.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const plugin = vi.hoisted(() => ({
  checkAvailability: vi.fn(),
  authenticate: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin }));
vi.mock('../app-platform', () => ({ isCapacitorNative: () => true, isNativeApp: () => true }));
vi.mock('../telegram', () => ({ hapticImpact: vi.fn() }));

import { authenticateWithBiometrics, disableBiometrics, isBiometricAvailable } from '../native-bridge';

beforeEach(() => {
  plugin.checkAvailability.mockReset();
  plugin.authenticate.mockReset();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('биометрия в APK (нативный BiometricPrompt)', () => {
  it('доступность — ответ плагина, а не WebAuthn', async () => {
    plugin.checkAvailability.mockResolvedValue({ available: true, status: 'ok' });
    expect(await isBiometricAvailable()).toBe(true);

    plugin.checkAvailability.mockResolvedValue({ available: false, status: 'none-enrolled' });
    expect(await isBiometricAvailable()).toBe(false);
    expect(plugin.checkAvailability).toHaveBeenCalledTimes(2);
  });

  it('зависший мост не вешает карточку настроек (таймаут = недоступна)', async () => {
    plugin.checkAvailability.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    const pending = isBiometricAvailable();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toBe(false);
  });

  it('подтверждение = ok от плагина; отмена = false, а не исключение', async () => {
    plugin.authenticate.mockResolvedValue({ ok: true });
    expect(await authenticateWithBiometrics('Разблокировка Health Engine')).toBe(true);
    expect(plugin.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Разблокировка Health Engine' }),
    );

    plugin.authenticate.mockResolvedValue({ ok: false, error: 'canceled' });
    expect(await authenticateWithBiometrics('Разблокировка Health Engine')).toBe(false);

    plugin.authenticate.mockRejectedValue(new Error('none-enrolled'));
    expect(await authenticateWithBiometrics('Разблокировка Health Engine')).toBe(false);
  });

  it('выключение биометрии убирает WebAuthn-ключ', async () => {
    localStorage.setItem('he_webauthn_cred_v1', 'abc');
    disableBiometrics();
    expect(localStorage.getItem('he_webauthn_cred_v1')).toBeNull();
  });

  it('нативная сторона подключена: плагин, регистрация, зависимость', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const root = process.cwd();
    const java = fs.readFileSync(
      path.join(
        root,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'healthengine',
        'app',
        'biometry',
        'BiometryPlugin.java',
      ),
      'utf-8',
    );
    expect(java).toContain('@CapacitorPlugin(name = "Biometry")');
    expect(java).toContain('BiometricPrompt');
    const main = fs.readFileSync(
      path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'healthengine', 'app', 'MainActivity.java'),
      'utf-8',
    );
    expect(main).toContain('registerPlugin(BiometryPlugin.class)');
    const gradle = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf-8');
    expect(gradle).toContain('androidx.biometric:biometric');
  });
});
