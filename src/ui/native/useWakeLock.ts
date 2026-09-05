/**
 * useWakeLock.ts — экран не гаснет во время активной сессии. ТОЛЬКО APK
 * (внутри — гейт на Capacitor native; в TG/web хук — мгновенный no-op).
 *
 * Держит Screen Wake Lock пока active === true (разминка/работа/заминка),
 * отпускает при сворачивании/размонтировании. Отсутствие API, отказ ОС
 * или скрытая вкладка — тихий no-op, тренировка продолжается как раньше.
 */

import { useEffect, useRef } from 'react';
import { isCapacitorNative } from '../../core/app-platform';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface WakeLockApi {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

function lockApi(): WakeLockApi | null {
  try {
    if (!isCapacitorNative()) return null;
    // lib.dom уже знает navigator.wakeLock — читаем структурно, без наследования.
    const nav = navigator as unknown as { wakeLock?: unknown };
    const api = nav.wakeLock as Partial<WakeLockApi> | undefined;
    if (!api || typeof api.request !== 'function') return null;
    return api as WakeLockApi;
  } catch {
    return null;
  }
}

export function useNativeWakeLock(active: boolean): void {
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const release = () => {
      const held = lock;
      lock = null;
      if (!held) return;
      try {
        const r = held.release();
        if (r && typeof (r as Promise<void>).catch === 'function') {
          (r as Promise<void>).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };

    const acquire = async () => {
      try {
        if (!activeRef.current || lock) return;
        const api = lockApi();
        if (!api) return;
        const next = await api.request('screen');
        if (cancelled || !activeRef.current) {
          try {
            await next.release();
          } catch {
            /* ignore */
          }
          return;
        }
        lock = next;
      } catch {
        /* отказ ОС (батарея/политика) — работаем без лока */
      }
    };

    const onVisibility = () => {
      try {
        if (document.visibilityState === 'visible') void acquire();
        else release();
      } catch {
        /* ignore */
      }
    };

    if (active) void acquire();
    else release();
    try {
      document.addEventListener('visibilitychange', onVisibility);
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true;
      try {
        document.removeEventListener('visibilitychange', onVisibility);
      } catch {
        /* ignore */
      }
      release();
    };
  }, [active]);
}
