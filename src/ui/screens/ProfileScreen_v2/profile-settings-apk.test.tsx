/**
 * profile-settings-apk.test.tsx — §4.4 «Телефон · APK»: оформление + виджеты
 * + биометрия монтируются ТОЛЬКО в native. TG/web секцию не видят вообще.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

// native-bridge тянет TG/Web-цепочку с CSS — мокаем целиком.
vi.mock('../../../core/native-bridge', () => ({
  haptics: vi.fn(),
  isBiometricAvailable: vi.fn(async () => true),
  authenticateWithBiometrics: vi.fn(async () => true),
  disableBiometrics: vi.fn(),
  setupNativeBackButton: vi.fn(async () => () => {}),
  initNativeChrome: vi.fn(async () => {}),
  notifyLocal: vi.fn(async () => true),
  pickPhoto: vi.fn(async () => null),
  shareText: vi.fn(async () => true),
}));

import { resetAppPlatformCache } from '../../../core/app-platform';
import { ProfileSettingsTab } from './ProfileSettingsTab';

describe('ProfileSettingsTab §4.4 (APK)', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    try {
      (window as any).Capacitor = { isNativePlatform: () => true };
      resetAppPlatformCache();
    } catch {}
  });
  afterEach(() => {
    cleanup();
    try {
      delete (window as any).Capacitor;
      resetAppPlatformCache();
      localStorage.clear();
    } catch {}
  });

  it('web/TG: секции 4.4 нет', async () => {
    try {
      delete (window as any).Capacitor;
      resetAppPlatformCache();
    } catch {}
    const { queryByText } = render(<ProfileSettingsTab />);
    expect(queryByText(/Телефон · APK/)).toBeNull();
    expect(queryByText(/Оформление/)).toBeNull();
    cleanup();
    try {
      (window as any).Capacitor = { isNativePlatform: () => true };
      resetAppPlatformCache();
    } catch {}
  });

  /** Раскрыть свёрнутый по умолчанию аккордеон 4.4. */
  function openSection44(getByRole: (role: string, opts?: object) => HTMLElement) {
    fireEvent.click(getByRole('button', { name: /4\.4 Телефон/ } as never));
  }

  it('APK: секция 4.4 с карточкой оформления, тема персистится', () => {
    const { getByText, getByRole } = render(<ProfileSettingsTab />);
    expect(getByText(/Телефон · APK/)).not.toBeNull();
    openSection44(getByRole as never);
    expect(getByText('Оформление')).not.toBeNull();
    expect(getByRole('radiogroup', { name: 'Тема' })).not.toBeNull();
    expect(getByRole('radiogroup', { name: 'Акцент' })).not.toBeNull();
    fireEvent.click(getByRole('radio', { name: /AMOLED/ }));
    expect(localStorage.getItem('he_apk_theme_v1')).toBe('amoled');
    fireEvent.click(getByRole('radio', { name: /Светлая/ }));
    expect(localStorage.getItem('he_apk_theme_v1')).toBe('light');
    fireEvent.click(getByRole('radio', { name: /Тёмная/ }));
    expect(localStorage.getItem('he_apk_theme_v1')).toBeNull();
  });

  it('APK: выбор акцента персистится мгновенно', () => {
    const { getByRole } = render(<ProfileSettingsTab />);
    openSection44(getByRole as never);
    fireEvent.click(getByRole('radio', { name: /Небо/ }));
    expect(localStorage.getItem('he_apk_accent_v1')).toBe('sky');
    fireEvent.click(getByRole('radio', { name: /Лайм/ }));
    expect(localStorage.getItem('he_apk_accent_v1')).toBeNull();
  });
});
