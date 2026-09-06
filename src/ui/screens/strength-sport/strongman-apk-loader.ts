/**
 * strongman-apk-loader.ts — точечная подгрузка APK-стилей стронг-планировщика.
 *
 * styles-native-strongman.css грузится ТОЛЬКО в native (Capacitor APK) через
 * динамический import за гейтом isNativeApp() — отдельным чанком, как
 * styles-native.css / styles-native-pro.css в main.tsx.
 * В TG Mini App и web — чистый no-op: ни байта CSS, ни изменения DOM,
 * рендер Байт-в-байт прежний (проверено apk-strongman-pack тестом).
 */
import { isNativeApp } from '../../../core/app-platform';

let strongmanApkCssLoaded = false;

/** Подключить APK-стили стронг-планировщика. True — native (импорт запущен). */
export function ensureStrongmanApkStyles(): boolean {
  if (!isNativeApp()) return false;
  if (strongmanApkCssLoaded) return true;
  strongmanApkCssLoaded = true;
  try {
    void import('../../../styles-native-strongman.css').catch(() => {
      strongmanApkCssLoaded = false;
    });
  } catch {
    strongmanApkCssLoaded = false;
  }
  return true;
}

/** Только для тестов: сбросить флаг повторной загрузки. */
export function resetStrongmanApkStylesForTest(): void {
  strongmanApkCssLoaded = false;
}
