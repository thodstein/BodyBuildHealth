/**
 * arm-apk-loader.ts — точечная подгрузка APK-стилей арм-планировщика.
 *
 * styles-native-arm.css грузится ТОЛЬКО в native (Capacitor APK) через
 * динамический import за гейтом isNativeApp() — отдельным чанком, как
 * styles-native.css / styles-native-pro.css в main.tsx.
 * В TG Mini App и web — чистый no-op: ни байта CSS, ни изменения DOM,
 * рендер Байт-в-байт прежний (проверено apk-arm-pack тестом).
 */
import { isNativeApp } from '../../../core/app-platform';

let armApkCssLoaded = false;

/** Подключить APK-стили арм-планировщика. True — native (импорт запущен). */
export function ensureArmApkStyles(): boolean {
  if (!isNativeApp()) return false;
  if (armApkCssLoaded) return true;
  armApkCssLoaded = true;
  try {
    void import('../../../styles-native-arm.css').catch(() => {
      armApkCssLoaded = false;
    });
  } catch {
    armApkCssLoaded = false;
  }
  return true;
}

/** Только для тестов: сбросить флаг повторной загрузки. */
export function resetArmApkStylesForTest(): void {
  armApkCssLoaded = false;
}
