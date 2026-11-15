/**
 * live-update.test.ts — OTA-подтягивание web-бандла.
 * Чистые функции: выбор .zip из релиза + гейт совместимости с нативом,
 * решение «сбросить устаревший OTA-бандл или оставить свежий».
 */
import { describe, it, expect } from 'vitest';
import { pickBundleAssetUrl } from '../app-updater';
import { isBundleCompatible, shouldResetOtaBundle } from '../live-update';

describe('pickBundleAssetUrl', () => {
  it('1. берёт web-bundle .zip, остальное игнорирует', () => {
    const assets = [
      { name: 'app-release.apk', browser_download_url: 'https://x/r.apk' },
      { name: 'web-bundle-v3.1.0.zip', browser_download_url: 'https://x/b.zip' },
      { name: 'notes.txt', browser_download_url: 'https://x/n.txt' },
    ];
    expect(pickBundleAssetUrl(assets)).toBe('https://x/b.zip');
    expect(pickBundleAssetUrl([])).toBeNull();
    expect(pickBundleAssetUrl(null)).toBeNull();
    // .zip без bundle-маркера — не OTA (чужой архив)
    expect(
      pickBundleAssetUrl([
        { name: 'sources.zip', browser_download_url: 'https://x/s.zip' },
      ]),
    ).toBeNull();
  });
});

describe('isBundleCompatible', () => {
  it('2. мажор обязан совпасть (ломающий натив — только полным APK)', () => {
    expect(isBundleCompatible('3.1.0', '3.0.0')).toBe(true);
    expect(isBundleCompatible('v3.9.9', '3.0.0')).toBe(true);
    expect(isBundleCompatible('4.0.0', '3.9.9')).toBe(false);
    expect(isBundleCompatible('', '3.0.0')).toBe(false);
    expect(isBundleCompatible('3.1.0', '')).toBe(false);
  });
});

describe('shouldResetOtaBundle', () => {
  it('3. свежий OTA (новее APK) НЕ сбрасывается — иначе «быстрое обновление» откатывалось само', () => {
    expect(shouldResetOtaBundle('3.0.15', '3.0.14')).toBe(false);
    expect(shouldResetOtaBundle('v3.1.0', '3.0.14')).toBe(false);
  });

  it('4. устаревший OTA (равен APK или старше) сбрасывается на встроенный dist', () => {
    expect(shouldResetOtaBundle('3.0.14', '3.0.15')).toBe(true);
    expect(shouldResetOtaBundle('3.0.14', '3.0.14')).toBe(true);
    expect(shouldResetOtaBundle('3.0.9', '3.0.15')).toBe(true);
  });

  it('5. нечем сравнивать — не трогаем (пустые/нечисловые версии)', () => {
    expect(shouldResetOtaBundle('', '3.0.15')).toBe(false);
    expect(shouldResetOtaBundle('3.0.15', '')).toBe(false);
    expect(shouldResetOtaBundle('bundle-local', '3.0.15')).toBe(false);
  });
});
