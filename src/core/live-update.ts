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
