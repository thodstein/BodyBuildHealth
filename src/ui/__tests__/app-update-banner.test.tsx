/**
 * app-update-banner.test.tsx — волна 20: баннер самообновления APK.
 * Кнопки без эмодзи-хрома, градиент за акцентом темы, вне native — null.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../core/app-platform', () => ({
  getAppPlatform: vi.fn(() => 'native'),
}));
vi.mock('../../core/app-updater', () => ({
  fetchLatestRelease: vi.fn(async () => ({ version: '9.9.9', apkUrl: 'https://x/app.apk' })),
  isNewerVersion: vi.fn(() => true),
  readUpdateState: vi.fn(() => ({})),
  shouldCheckNow: vi.fn(() => true),
  writeUpdateState: vi.fn(),
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
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'native', 'AppUpdateBanner.tsx'),
      'utf-8',
    );
    expect(src).toContain('var(--accent)');
    expect(src).toContain('var(--accent-contrast)');
    expect(src).not.toMatch(/#c9f73a/i);
  });

  it('3. вне native — null (TG/web без изменений)', async () => {
    (getAppPlatform as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('web');
    const { container } = render(<AppUpdateBanner />);
    expect(container.querySelector('[aria-label="app-update"]')).toBeNull();
  });
});
