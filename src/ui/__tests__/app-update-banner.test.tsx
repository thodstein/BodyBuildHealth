/**
 * app-update-banner.test.tsx — волна 20: баннер самообновления APK.
 * Кнопки без эмодзи-хрома, градиент за акцентом темы, вне native — null.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

vi.mock('../../core/app-platform', () => ({
  getAppPlatform: vi.fn(() => 'native'),
}));
vi.mock('../../core/app-updater', () => ({
  fetchLatestRelease: vi.fn(async () => ({ version: '9.9.9', apkUrl: 'https://x/app.apk' })),
  isNewerVersion: vi.fn(() => true),
  readUpdateState: vi.fn(() => ({})),
  shouldCheckNow: vi.fn(() => true),
  writeUpdateState: vi.fn(),
  UPDATE_CHECK_EVENT: 'he:check-updates',
}));
vi.mock('../../core/native-bridge', () => ({
  getDeviceInfo: vi.fn(async () => ({ appVersion: '1.0.0' })),
  installDownloadedApk: vi.fn(),
  openUnknownSourcesSettings: vi.fn(),
  pollApkDownload: vi.fn(),
  startApkDownload: vi.fn(),
}));
vi.mock('../../core/live-update', () => ({
  getLiveBundleId: vi.fn(async () => null),
  isBundleCompatible: vi.fn(() => false),
  reloadToLiveBundle: vi.fn(),
  stageLiveBundle: vi.fn(),
}));

import { getAppPlatform } from '../../core/app-platform';
import { AppUpdateBanner } from '../native/AppUpdateBanner';

beforeEach(() => {
  vi.unstubAllEnvs();
  try {
    localStorage.clear();
  } catch {}
});

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {}
});

describe('AppUpdateBanner (волна 20)', () => {
  it('1. native → баннер с версией и кнопками без эмодзи', async () => {
    (getAppPlatform as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('native');
    const { container } = render(<AppUpdateBanner />);
    expect(await screen.findByText(/9\.9\.9/)).not.toBeNull();
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b.textContent ?? '', b.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('2. градиент и кромка — за акцентом темы, не захардкожены', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'ui', 'native', 'AppUpdateBanner.tsx'), 'utf-8');
    expect(src).toContain('var(--accent)');
    expect(src).toContain('var(--accent-contrast)');
    expect(src).not.toMatch(/#c9f73a/i);
  });

  it('3. вне native — null (TG/web без изменений)', async () => {
    (getAppPlatform as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('web');
    const { container } = render(<AppUpdateBanner />);
    expect(container.querySelector('[aria-label="app-update"]')).toBeNull();
  });

  it('5. ручная проверка из настроек не ждёт суточного окна', async () => {
    (getAppPlatform as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('native');
    const upd = await import('../../core/app-updater');
    // фоновая проверка при монтировании — «рано», ручная обязана пройти
    (upd.shouldCheckNow as unknown as { mockReturnValueOnce: (v: boolean) => void }).mockReturnValueOnce(false);
    render(<AppUpdateBanner />);
    expect(screen.queryByText(/9\.9\.9/)).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('he:check-updates'));
    });

    expect(await screen.findByText(/9\.9\.9/)).not.toBeNull();
  });

  it('7. зависший ответ LiveUpdate не прячет баннер (таймаут, а не вечный висяк)', async () => {
    (getAppPlatform as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('native');
    const lu = await import('../../core/live-update');
    // Мост Capacitor не ответил вовсе: без таймаута проверка не дошла бы
    // ни до фида, ни до баннера — снаружи «автообновление не работает».
    (lu.getLiveBundleId as unknown as { mockReturnValueOnce: (v: Promise<null>) => void }).mockReturnValueOnce(
      new Promise<null>(() => {}),
    );
    vi.useFakeTimers();
    try {
      render(<AppUpdateBanner />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(screen.queryByText(/9\.9\.9/)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('8. ручная проверка всегда отвечает тостом, даже если версия не пришла', async () => {
    (getAppPlatform as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('native');
    const nb = await import('../../core/native-bridge');
    const hang = () => new Promise<null>(() => {});
    const deviceInfo = nb.getDeviceInfo as unknown as {
      mockImplementationOnce: (f: () => Promise<null>) => unknown;
    };
    // авто-проверка на монтировании и ручная — обе без ответа плагина
    deviceInfo.mockImplementationOnce(hang);
    deviceInfo.mockImplementationOnce(hang);
    const { toastStore } = await import('../../core/toast');
    const errorSpy = vi.spyOn(toastStore, 'error');
    vi.useFakeTimers();
    try {
      render(<AppUpdateBanner />);
      await act(async () => {
        window.dispatchEvent(new Event('he:check-updates'));
        await vi.advanceTimersByTimeAsync(7000);
      });
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('6. неудачная авто-проверка не съедает суточное окно', async () => {
    (getAppPlatform as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('native');
    const upd = await import('../../core/app-updater');
    const writeState = upd.writeUpdateState as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[][] };
    };
    writeState.mockClear();
    // фид недоступен (нет сети/лимит GitHub) — lastCheck писать нельзя,
    // иначе авто-обновление отложится на сутки вперёд.
    (upd.fetchLatestRelease as unknown as { mockResolvedValueOnce: (v: null) => void }).mockResolvedValueOnce(null);
    const { container } = render(<AppUpdateBanner />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(container.querySelector('[aria-label="app-update"]')).toBeNull();
    // Суточное окно не съедено: ни в одной записи нет lastCheck. Итог проверки
    // при этом фиксируется — настройки должны показать «нет связи».
    const withLastCheck = writeState.mock.calls.filter(
      (call) => call[0] && typeof call[0] === 'object' && 'lastCheck' in (call[0] as object),
    );
    expect(withLastCheck).toHaveLength(0);
    const results = writeState.mock.calls.map((call) => (call[0] as { lastResult?: string }).lastResult ?? '');
    expect(results.join(' ')).toContain('Нет связи');
  });
});

describe('волна 32: PWA-баннер не лезет поверх hero в APK', () => {
  it('4. native-сборка без авто-регистрации SW + гейт + чистка', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cfg = fs.readFileSync(path.join(process.cwd(), 'vite.config.ts'), 'utf-8');
    expect(cfg).toContain('injectRegister');
    expect(cfg).toContain('injectRegister: false');
    const pwa = fs.readFileSync(path.join(process.cwd(), 'src', 'core', 'pwa-manager.ts'), 'utf-8');
    expect(pwa).toContain('isNativePlatform');
    const main = fs.readFileSync(path.join(process.cwd(), 'src', 'main.tsx'), 'utf-8');
    expect(main).toContain('getRegistrations');
    expect(main).toContain('unregister');
  });
});
