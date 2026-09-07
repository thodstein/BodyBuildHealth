/**
 * support-apk-loader.ts — точечная подгрузка APK-стилей вкладки «БАДы».
 *
 * styles-native-support.css грузится ТОЛЬКО в native (Capacitor APK) через
 * динамический import за гейтом isNativeApp() — отдельным чанком, как
 * styles-native.css / styles-native-pro.css в main.tsx и arm/strongman-лоадеры.
 * В TG Mini App и web — чистый no-op: ни байта CSS, ни изменения DOM,
 * рендер байт-в-байт прежний (проверено apk-support-pack тестом).
 */
import { isNativeApp } from '../../../core/app-platform';

let supportApkCssLoaded = false;

/** Подключить APK-стили вкладки «БАДы». True — native (импорт запущен). */
export function ensureSupportApkStyles(): boolean {
  if (!isNativeApp()) return false;
  if (supportApkCssLoaded) return true;
  supportApkCssLoaded = true;
  try {
    void import('../../../styles-native-support.css').catch(() => {
      supportApkCssLoaded = false;
    });
  } catch {
    supportApkCssLoaded = false;
  }
  return true;
}

/** Только для тестов: сбросить флаг повторной загрузки. */
export function resetSupportApkStylesForTest(): void {
  supportApkCssLoaded = false;
}
