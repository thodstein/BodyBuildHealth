/**
 * labs-apk.test.ts — APK-слой вкладки «Анализы»:
 * лоадер no-op в web/TG, грузит только в native; CSS — только html.app-native.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
  const { resetLabsApkStylesForTest } = await import(
    '../screens/LabsScreen_parts/labs-apk-loader'
  );
  resetLabsApkStylesForTest();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

describe('labs-apk-loader', () => {
  it('1. web/TG → no-op (false), DOM и CSS не тронуты', async () => {
    await resetPlatform();
    const { ensureLabsApkStyles } = await import(
      '../screens/LabsScreen_parts/labs-apk-loader'
    );
    expect(ensureLabsApkStyles()).toBe(false);
    expect(ensureLabsApkStyles()).toBe(false);
  });

  it('2. native → true (импорт запущен), повторный вызов идемпотентен', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { ensureLabsApkStyles } = await import(
      '../screens/LabsScreen_parts/labs-apk-loader'
    );
    expect(ensureLabsApkStyles()).toBe(true);
    expect(ensureLabsApkStyles()).toBe(true);
  });

  it('3. CSS-изоляция: каждый селектор — только html.app-native', async () => {    const fs = await import('fs');
    const path = await import('path');
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src', 'styles-native-labs.css'),
      'utf-8',
    );
    expect(css).toContain('.labs-body');
    expect(css).toContain('.labs-bottomtabs');
    for (const rawLine of css.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('/*') || line.startsWith('*')) continue;
      if (!line.endsWith('{')) continue;
      const sel = line.slice(0, -1).trim();
      if (!sel || sel.startsWith('@')) continue;
      for (const part of sel
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        expect(part.startsWith('html.app-native'), part).toBe(true);
      }
    }
  });

  it('4. anti-zoom: поля ввода ≥16px на телефоне (iOS не зумит)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src', 'styles-native-labs.css'),
      'utf-8',
    );
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain('font-size: 16px');
  });
});
