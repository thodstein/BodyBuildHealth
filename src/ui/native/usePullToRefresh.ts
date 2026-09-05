/**
 * usePullToRefresh.ts — потяни-вниз-чтобы-обновить. ТОЛЬКО APK.
 * Telegram/web хук не монтируют — поведение Mini App 1-в-1.
 *
 * Работает только из верхней позиции скролла (scrollTop <= 8), вертикальный
 * жест вниз; горизонтальные свайпы, формы и fixed-оверлеи игнорируются.
 * Высоту индикатора пишем напрямую в DOM (без ререндера на каждый move),
 * в state — только переходы pulling/refreshing.
 */

import { useEffect, useRef, useState } from 'react';
import { haptics } from '../../core/native-bridge';

export interface PullToRefreshOptions {
  /** Дистанция срабатывания, px. По умолчанию 72. */
  threshold?: number;
  /** Что обновить (ошибки глотаются — индикатор всё равно прячется). */
  onRefresh: () => Promise<unknown> | unknown;
}

export interface PullToRefresh {
  containerRef: React.RefObject<HTMLElement>;
  indicatorRef: React.RefObject<HTMLElement>;
  pulling: boolean;
  refreshing: boolean;
}

function isFormTarget(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
  if (el.isContentEditable) return true;
  if (el.closest('[data-no-ptr]')) return true;
  return false;
}

export function usePullToRefresh(opts: PullToRefreshOptions): PullToRefresh {
  const threshold = opts.threshold ?? 72;
  const saved = useRef(opts.onRefresh);
  saved.current = opts.onRefresh;
  const containerRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLElement>(null);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Зеркало для слушателей (эффект монтируется один раз — замыкание стареет).
  const refreshingRef = useRef(false);

  const setRefreshingSync = (v: boolean) => {
    refreshingRef.current = v;
    setRefreshing(v);
  };

  useEffect(() => {
    const root = containerRef.current;
    const bar = indicatorRef.current;
    if (!root) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pulled = false;

    const setBar = (h: number) => {
      try {
        if (bar) bar.style.height = `${Math.max(0, Math.round(h))}px`;
      } catch {
        /* ignore */
      }
    };

    const reset = () => {
      tracking = false;
      if (pulled) {
        pulled = false;
        setPulling(false);
      }
      setBar(0);
    };

    const onStart = (e: TouchEvent) => {
      try {
        if (refreshingRef.current) return;
        if (e.touches.length !== 1) return;
        const target = e.target instanceof Element ? e.target : null;
        if (isFormTarget(target)) return;
        if (root.scrollTop > 8) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        tracking = true;
      } catch {
        tracking = false;
      }
    };

    const onMove = (e: TouchEvent) => {
      try {
        if (!tracking || refreshingRef.current) return;
        if (e.touches.length !== 1) {
          reset();
          return;
        }
        if (root.scrollTop > 8) {
          reset();
          return;
        }
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) > Math.abs(dy) * 1.2) {
          reset();
          return;
        }
        if (dy <= 0) {
          if (pulled) {
            pulled = false;
            setPulling(false);
          }
          setBar(0);
          return;
        }
        if (dy > 12 && !pulled) {
          pulled = true;
          setPulling(true);
        }
        if (pulled) setBar(Math.min(dy * 0.55, 96));
      } catch {
        /* ignore */
      }
    };

    const onEnd = () => {
      try {
        if (!tracking) return;
        const shouldFire = pulled && bar && parseFloat(bar.style.height || '0') >= threshold * 0.55;
        tracking = false;
        if (pulled) {
          pulled = false;
          setPulling(false);
        }
        if (!shouldFire || refreshingRef.current) {
          setBar(0);
          return;
        }
        setRefreshingSync(true);
        setBar(56);
        try {
          void haptics('medium');
        } catch {
          /* ignore */
        }
        void (async () => {
          try {
            await saved.current();
          } catch {
            /* ошибка обновления — индикатор всё равно прячем */
          } finally {
            setBar(0);
            setRefreshingSync(false);
          }
        })();
      } catch {
        setBar(0);
      }
    };

    const onCancel = () => {
      setBar(0);
      if (!refreshingRef.current) {
        tracking = false;
        if (pulled) {
          pulled = false;
          setPulling(false);
        }
      }
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  return { containerRef, indicatorRef, pulling, refreshing };
}
