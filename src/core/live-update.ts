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

const BUILD_MARKER_KEY = 'he_app_build_marker_v1';

/**
 * OTA-бандл живёт в данных приложения и переживает установку нового APK:
 * скачанный однажды бандл молча перекрывает свежий встроенный dist, и правки
 * из новой сборки «не приезжают» — приложение выглядит так же, как до фикса.
 *
 * Здесь: при запуске сборки с новой меткой (__APP_BUILD__ меняется на каждом
 * `npm run build`) активный OTA-бандл сбрасывается на встроенный. Возвращает
 * true, если нужен reload (вызывающий делает reloadToLiveBundle()).
 * Идемпотентно: после сброса метка совпадает → повторных сбросов нет.
 */
export async function ensureBuiltInBundleForThisBuild(): Promise<boolean> {
  try {
    const buildMarker =
      typeof __APP_BUILD__ !== 'undefined' ? String(__APP_BUILD__) : '';
    if (!buildMarker) return false;
    let stored = '';
    try {
      stored = localStorage.getItem(BUILD_MARKER_KEY) || '';
    } catch {
      return false;
    }
    if (!stored) {
      // Первый запуск после появления метки — запоминаем и ничего не трогаем.
      try {
        localStorage.setItem(BUILD_MARKER_KEY, buildMarker);
      } catch {
        /* ignore */
      }
      return false;
    }
    if (stored === buildMarker) return false;
    // Новая встроенная сборка: старый OTA-бандл сбросить, иначе правки
    // в APK останутся невидимыми до ручного вмешательства.
    let hasBundle = false;
    try {
      const id = await getLiveBundleId();
      hasBundle = Boolean(id);
      if (hasBundle) await resetToBuiltInBundle();
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(BUILD_MARKER_KEY, buildMarker);
    } catch {
      /* ignore */
    }
    return hasBundle;
  } catch {
    return false;
  }
}

/** Версия активного OTA-бандла (для диагностики/баннера обновлений). */
export async function describeLiveBundle(): Promise<string> {
  const id = await getLiveBundleId();
  return id ? `OTA ${id}` : 'встроенный dist';
}
