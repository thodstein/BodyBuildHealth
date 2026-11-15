/**
 * live-update.ts — OTA-подтягивание web-файлов внутрь установленного APK.
 *
 * Принцип как в TG Mini App (свежий dist без переустановки), но офлайн
 * не умирает: новый бандл применяется поверх, а встроенный dist остаётся
 * фолбэком (авто-откат по readyTimeout, если бандл не стартовал).
 *
 * Контракт:
 * - вне native каждый метод = null/false, исключений наружу нет;
 * - сеть/натив изолированы, чистые решения (какой бандл ставить) — в вызывателе;
 * - ready() вызывать один раз после успешного старта (main.tsx, native).
 */

import { isNewerVersion } from './app-updater';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LiveUpdatePlugin = any;

async function liveUpdate(): Promise<LiveUpdatePlugin | null> {
  try {
    const { isCapacitorNative } = await import('./app-platform');
    if (!isCapacitorNative()) return null;
    const mod = await import('@capawesome/capacitor-live-update');
    return mod.LiveUpdate ?? null;
  } catch {
    return null;
  }
}

/** Id текущего бандла (null = встроенный dist или не-native). */
export async function getLiveBundleId(): Promise<string | null> {
  try {
    const plugin = await liveUpdate();
    if (!plugin) return null;
    const ret = await plugin.getCurrentBundle();
    const id = String(ret?.bundleId ?? '');
    return id ? id : null;
  } catch {
    return null;
  }
}

/**
 * Совместимость бандла с нативной оболочкой: совпадение мажора.
 * Натив меняется редко и только добавлением; мажор = ломающие изменения
 * натива → тогда только полное обновление APK, не OTA.
 */
export function isBundleCompatible(
  bundleVersion: string,
  nativeVersion: string,
): boolean {
  try {
    const norm = (v: string) => (v || '').trim().replace(/^[vV]/, '');
    const b = norm(bundleVersion).split('.')[0];
    const n = norm(nativeVersion).split('.')[0];
    if (!b || !n) return false;
    return b === n;
  } catch {
    return false;
  }
}

/**
 * Скачать self-hosted бандл и назначить следующим.
 * @returns true — staged, перезапустите приложение (или reload).
 */
export async function stageLiveBundle(
  bundleId: string,
  url: string,
  onProgress?: (progress: number) => void,
): Promise<boolean> {
  try {
    const plugin = await liveUpdate();
    if (!plugin || !bundleId || !url) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let handle: any = null;
    try {
      handle = await plugin.addListener(
        'downloadBundleProgress',
        (ev: { percent?: number }) => {
          try {
            const p = Number(ev?.percent ?? 0);
            onProgress?.(Math.min(1, Math.max(0, p > 1 ? p / 100 : p)));
          } catch {
            /* ignore */
          }
        },
      );
    } catch {
      /* прогресс опционален */
    }
    try {
      await plugin.downloadBundle({ url, bundleId });
      await plugin.setNextBundle({ bundleId });
      return true;
    } finally {
      try {
        await handle?.remove();
      } catch {
        /* ignore */
      }
    }
  } catch {
    return false;
  }
}

/** Перезагрузить WebView на staged-бандл (состояние вкладки потеряется). */
export async function reloadToLiveBundle(): Promise<boolean> {
  try {
    const plugin = await liveUpdate();
    if (!plugin) return false;
    await plugin.reload();
    return true;
  } catch {
    return false;
  }
}

/** «Приложение живо» — сбрасывает readyTimeout, отменяет авто-откат. */
export async function markAppReady(): Promise<void> {
  try {
    const plugin = await liveUpdate();
    if (!plugin) return;
    await plugin.ready();
  } catch {
    /* ignore */
  }
}

/** Откат на встроенный dist (например, кнопка «починить» в настройках). */
export async function resetToBuiltInBundle(): Promise<boolean> {
  try {
    const plugin = await liveUpdate();
    if (!plugin) return false;
    await plugin.reset();
    return true;
  } catch {
    return false;
  }
}

const RESET_GUARD_KEY = 'he_ota_reset_guard_v1';

/** Версия установленного APK (versionName) или '' вне native/при сбое. */
async function installedApkVersion(): Promise<string> {
  try {
    const { isCapacitorNative } = await import('./app-platform');
    if (!isCapacitorNative()) return '';
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return String(info?.version ?? '').trim();
  } catch {
    return '';
  }
}

/** Похоже на версию (иначе сравнивать нечего). */
function isVersionLike(v: string): boolean {
  return /^\d+(\.\d+)+$/.test((v || '').trim().replace(/^[vV]/, ''));
}

/**
 * Нужно ли сбросить активный OTA-бандл на встроенный dist.
 *
 * - бандл НОВЕЕ установленного APK → это и есть обновление, не трогаем;
 * - бандл не новее APK (равен или старше) → устарел: APK уже содержит эти файлы.
 *
 * Пустые/нечисловые версии = не трогаем (сравнивать нечего, риск откатить
 * живое обновление выше пользы).
 */
export function shouldResetOtaBundle(bundleId: string, apkVersion: string): boolean {
  const b = (bundleId || '').trim();
  const a = (apkVersion || '').trim();
  if (!b || !a) return false;
  if (!isVersionLike(b) || !isVersionLike(a)) return false;
  return !isNewerVersion(b, a);
}

function readResetGuard(): string {
  try {
    return localStorage.getItem(RESET_GUARD_KEY) || '';
  } catch {
    return '';
  }
}

function writeResetGuard(apkVersion: string): void {
  try {
    localStorage.setItem(RESET_GUARD_KEY, apkVersion);
  } catch {
    /* ignore */
  }
}

/**
 * OTA-бандл живёт в данных приложения и переживает установку нового APK:
 * скачанный однажды бандл молча перекрывает свежий встроенный dist, и правки
 * из новой сборки «не приезжают» — приложение выглядит так же, как до фикса.
 *
 * Решение — по версиям (см. shouldResetOtaBundle), а НЕ по метке сборки
 * `__APP_BUILD__`: метка меняется на каждой сборке, включая сам OTA-бандл,
 * поэтому по ней каждый только что применённый бандл сбрасывался при первом
 * же перезапуске — «быстрое обновление» откатывалось само, и перезапуск
 * возвращал старую версию.
 *
 * Возвращает true, если нужен reload (вызывающий делает reloadToLiveBundle()).
 */
export async function resetStaleOtaBundle(): Promise<boolean> {
  try {
    const bundleId = (await getLiveBundleId()) || '';
    if (!bundleId) return false; // встроенный dist — сбрасывать нечего
    const apkVersion = await installedApkVersion();
    if (!shouldResetOtaBundle(bundleId, apkVersion)) return false;
    // Один сброс на версию APK: если reset() почему-то не сработал, цикла
    // «сброс → reload → сброс» не будет.
    if (readResetGuard() === apkVersion) return false;
    writeResetGuard(apkVersion);
    return await resetToBuiltInBundle();
  } catch {
    return false;
  }
}

/** Версия активного OTA-бандла (для диагностики/баннера обновлений). */
export async function describeLiveBundle(): Promise<string> {
  const id = await getLiveBundleId();
  return id ? `OTA ${id}` : 'встроенный dist';
}
