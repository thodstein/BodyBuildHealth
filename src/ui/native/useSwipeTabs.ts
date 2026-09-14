/**
 * useSwipeTabs.ts — свайпы переключения вкладок. ТОЛЬКО APK (включается пропсом).
 * Telegram/web хук не монтируют — поведение Mini App 1-в-1.
 *
 * Свайп влево → следующая вкладка, вправо → предыдущая.
 * Гарды (свайп игнорируется):
 * - жесты < 90px, вертикальные (> 70px по Y) или дольше 700мс;
 * - диагональ без доминирования горизонтали (|dx| < |dy| × 1.5);
 * - вертикаль победила по ходу жеста (direction-lock в touchmove);
 * - мультитач;
 * - старт на input/textarea/select/contenteditable/range или [data-no-swipe];
 * - старт внутри горизонтально скроллящегося контейнера (ряды чипов и т.п.);
 * - старт внутри fixed-оверлея (hero-окна, конструкторы, модалки, попапы) —
 *   там своя навигация, нижний таб-бар под ними недоступен.
 *
 * Слушатели пассивные: вертикальный скролл не затрагивается вообще.
 */

import { useEffect, useRef } from 'react';

export interface SwipeTabsHandlers {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

const MIN_DX = 90;
const MAX_DY = 70;
const MAX_DT = 700;

function isFormTarget(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (el.closest('[data-no-swipe]')) return true;
  return false;
}

function insideHorizontalScroller(el: Element | null, root: Element): boolean {
  let node: Element | null = el;
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      try {
        const style = window.getComputedStyle(node);
        const ox = style.overflowX;
        if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth + 8) {
          return true;
        }
      } catch {
        /* ignore */
      }
    }
    node = node.parentElement;
  }
  return false;
}

function insideFixedOverlay(el: Element | null, root: Element): boolean {
  let node: Element | null = el;
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      try {
        if (window.getComputedStyle(node).position === 'fixed') return true;
      } catch {
        /* ignore */
      }
    }
    node = node.parentElement;
  }
  return false;
}

/** Чистая функция для тестов и переиспользования. */
export function classifySwipe(
  dx: number,
  dy: number,
  dtMs: number,
): 'left' | 'right' | null {
  if (Math.abs(dy) > MAX_DY) return null;
  if (dtMs > MAX_DT) return null;
  // Диагональный скролл (вертикаль сопоставима с горизонталью) — не свайп вкладки.
  // Иначе обычный скролл ленты с дрейфом ~90px по X периодически «выкидывал»
  // пользователя на соседнюю вкладку — та самая жалоба «вылетает назад».
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  if (dx <= -MIN_DX) return 'left';
  if (dx >= MIN_DX) return 'right';
  return null;
}

export function useSwipeTabs(
  ref: React.RefObject<HTMLElement>,
  enabled: boolean,
  handlers: SwipeTabsHandlers,
): void {
  const saved = useRef(handlers);
  saved.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      try {
        if (e.touches.length !== 1) {
          tracking = false;
          return;
        }
        const t = e.touches[0];
        const target = (e.target instanceof Element ? e.target : null) as Element | null;
        if (isFormTarget(target)) {
          tracking = false;
          return;
        }
        if (insideHorizontalScroller(target, root) || insideFixedOverlay(target, root)) {
          tracking = false;
          return;
        }
        startX = t.clientX;
        startY = t.clientY;
        startT = Date.now();
        tracking = true;
      } catch {
        tracking = false;
      }
    };

    // Direction-lock: как только вертикаль побеждает — это скролл, не свайп вкладки.
    // Без этого любой диагональный скролл с дрейфом ≥90px по X долетал до touchend
    // и переключал вкладку (жалобы «вылетает назад при просмотре вкладок»).
    const onMove = (e: TouchEvent) => {
      try {
        if (!tracking) return;
        if (e.touches.length !== 1) {
          tracking = false;
          return;
        }
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dy) > MAX_DY) {
          tracking = false;
          return;
        }
        if (Math.abs(dy) > 12 && Math.abs(dx) < Math.abs(dy) * 1.5) {
          tracking = false;
        }
      } catch {
        tracking = false;
      }
    };

    const onEnd = (e: TouchEvent) => {
      try {
        if (!tracking) return;
        tracking = false;
        if (e.changedTouches.length !== 1) return;
        const t = e.changedTouches[0];
        const dir = classifySwipe(t.clientX - startX, t.clientY - startY, Date.now() - startT);
        if (dir === 'left') saved.current.onSwipeLeft();
        else if (dir === 'right') saved.current.onSwipeRight();
      } catch {
        /* ignore */
      }
    };

    const onCancel = () => {
      tracking = false;
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
  }, [ref, enabled]);
}
