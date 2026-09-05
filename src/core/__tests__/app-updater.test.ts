/**
 * app-updater.test.ts — движок самообновления APK.
 * Только чистые функции + stub-сеть: без DOM, без плагинов, быстрые.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  UPDATE_STATE_KEY,
  compareVersions,
  fetchLatestRelease,
  isNewerVersion,
  parseVersionTag,
  pickApkAssetUrl,
  pickBundleAssetUrl,
  readUpdateState,
  shouldCheckNow,
  writeUpdateState,
} from '../app-updater';

beforeEach(() => {
  try {
    localStorage.removeItem(UPDATE_STATE_KEY);
  } catch {
    /* ignore */
  }
});

describe('parseVersionTag', () => {
  it('1. срезает v/V и пробелы', () => {
    expect(parseVersionTag('v3.0.1')).toBe('3.0.1');
    expect(parseVersionTag('V3.0.1 ')).toBe('3.0.1');
    expect(parseVersionTag('3.0.1')).toBe('3.0.1');
    expect(parseVersionTag('')).toBe('');
  });
});

describe('compareVersions', () => {
  it('2. числовое, а не строковое (3.0.10 > 3.0.9)', () => {
    expect(compareVersions('3.0.10', '3.0.9')).toBe(1);
    expect(compareVersions('3.0.9', '3.0.10')).toBe(-1);
    expect(compareVersions('3.0.0', '3.0.0')).toBe(0);
    expect(compareVersions('v3.1', '3.0.9')).toBe(1);
    expect(compareVersions('3.0', '3.0.0')).toBe(0);
  });
});

describe('isNewerVersion', () => {
  it('3. только строго новее; пустые входы = false', () => {
    expect(isNewerVersion('3.0.1', '3.0.0')).toBe(true);
    expect(isNewerVersion('3.0.0', '3.0.0')).toBe(false);
    expect(isNewerVersion('3.0.0', '3.0.1')).toBe(false);
    expect(isNewerVersion('', '3.0.0')).toBe(false);
    expect(isNewerVersion('3.0.1', '')).toBe(false);
  });
});

describe('pickApkAssetUrl', () => {
  it('4. приоритет подписанному release, мусор отбрасывается', () => {
    const assets = [
      { name: 'app-debug.apk', browser_download_url: 'https://x/debug.apk' },
      { name: 'app-release.apk', browser_download_url: 'https://x/release.apk' },
      { name: 'notes.txt', browser_download_url: 'https://x/notes.txt' },
      { name: 'broken.apk' },
    ];
    expect(pickApkAssetUrl(assets)).toBe('https://x/release.apk');
    expect(
      pickApkAssetUrl([{ name: 'app-debug.apk', browser_download_url: 'https://x/d.apk' }]),
    ).toBe('https://x/d.apk');
    expect(pickApkAssetUrl([])).toBeNull();
    expect(pickApkAssetUrl(null)).toBeNull();
    expect(
      pickApkAssetUrl([{ name: 'readme.md', browser_download_url: 'https://x/r' }]),
    ).toBeNull();
  });
});

describe('fetchLatestRelease', () => {  it('5. GitHub-формат: tag + assets + body', async () => {
    const stub = async () => ({
      ok: true,
      json: async () => ({
        tag_name: 'v3.1.0',
        body: 'Фиксы',
        assets: [
          { name: 'app-release.apk', browser_download_url: 'https://x/r.apk' },
        ],
      }),
    });
    expect(await fetchLatestRelease(stub)).toEqual({
      version: '3.1.0',
      apkUrl: 'https://x/r.apk',
      bundleUrl: null,
      notes: 'Фиксы',
    });
  });

  it('6. любой сбой = null, не throw', async () => {
    expect(await fetchLatestRelease(async () => ({ ok: false, json: async () => ({}) }))).toBeNull();
    expect(
      await fetchLatestRelease(async () => {
        throw new Error('offline');
      }),
    ).toBeNull();
    expect(
      await fetchLatestRelease(async () => ({
        ok: true,
        json: async () => ({ tag_name: 'v3.1.0', assets: [] }),
      })),
    ).toBeNull();
  });
});

describe('update state', () => {
  it('7. shouldCheckNow: первый раз да, потом сутки, skip пишется', () => {
    expect(shouldCheckNow()).toBe(true);
    writeUpdateState({ lastCheck: Date.now(), skippedVersion: '3.1.0' });
    expect(shouldCheckNow()).toBe(false);
    expect(readUpdateState().skippedVersion).toBe('3.1.0');
    expect(shouldCheckNow(Date.now() + 25 * 3600 * 1000)).toBe(true);
  });

  it('8. битый storage = дефолт, не throw', () => {
    try {
      localStorage.setItem(UPDATE_STATE_KEY, '{oops');
    } catch {
      /* ignore */
    }
    expect(readUpdateState()).toEqual({ lastCheck: 0, skippedVersion: '' });
  });
});
