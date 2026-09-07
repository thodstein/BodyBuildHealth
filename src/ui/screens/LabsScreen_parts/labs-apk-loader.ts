/**
 * labs-apk-loader.ts — точечная подгрузка APK-стилей вкладки «Анализы».
 *
 * styles-native-labs.css грузится ТОЛЬКО в native (Capacitor APK) через
 * динамический import за гейтом isNativeApp() — отдельным чанком, как
 * styles-native.css / styles-native-pro.css в main.tsx.
 * В TG Mini App и web — чистый no-op: ни байта CSS, ни изменения DOM,
 * рендер байт-в-байт прежний (проверено labs-apk тестом).
 */
import { isNativeApp } from '../../../core/app-platform';

let labsApkCssLoaded = false;

/** Подключить APK-стили анализов. True — native (импорт запущен). */
export function ensureLabsApkStyles(): boolean {
  if (!isNativeApp()) return false;
  if (labsApkCssLoaded) return true;
  labsApkCssLoaded = true;
  try {
    void import('../../../styles-native-labs.css').catch(() => {
      labsApkCssLoaded = false;
    });
  } catch {
    labsApkCssLoaded = false;
  }
  return true;
}

/** Только для тестов: сбросить флаг повторной загрузки. */
export function resetLabsApkStylesForTest(): void {
  labsApkCssLoaded = false;
}
