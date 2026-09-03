/**
 * swipe-tabs-native.test.tsx — свайпы вкладок APK.
 * Чистая классификация + хук с гардами. В Telegram/web хук не монтируется.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React, { useRef } from 'react';
import { classifySwipe, useSwipeTabs } from '../native/useSwipeTabs';
import { isNativeApp } from '../../core/app-platform';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

function touchEvent(type: string, touches: { clientX: number; clientY: number }[]): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const key = type === 'touchend' ? 'changedTouches' : 'touches';
  Object.defineProperty(ev, key, { value: touches });
  if (type === 'touchend') {
    Object.defineProperty(ev, 'touches', { value: [] });
  }
  return ev;
}

function Harness({
  onL,
  onR,
  extra,
}: {
  onL: () => void;
  onR: () => void;
  extra?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipeTabs(ref, isNativeApp(), { onSwipeLeft: onL, onSwipeRight: onR });
  return (
    <div ref={ref} data-testid="swipe-root">
      <span data-testid="plain">text</span>
      {extra}
    </div>
  );
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

describe('classifySwipe', () => {
  it('1. пороги дистанции и направления', () => {
    expect(classifySwipe(-150, 0, 200)).toBe('left');
    expect(classifySwipe(150, 0, 200)).toBe('right');
    expect(classifySwipe(-89, 0, 200)).toBeNull();
    expect(classifySwipe(89, 0, 200)).toBeNull();
    expect(classifySwipe(-90, 0, 200)).toBe('left');
  });

  it('2. вертикаль и долгие жесты отбрасываются', () => {
    expect(classifySwipe(-200, 71, 200)).toBeNull();
    expect(classifySwipe(200, -100, 200)).toBeNull();
    expect(classifySwipe(-200, 0, 701)).toBeNull();
    expect(classifySwipe(-200, 70, 700)).toBe('left');
  });
});

describe('useSwipeTabs (native)', () => {
  it('3. свайп влево/вправо вызывает хендлеры', async () => {
    setCapacitorNative();
    await resetPlatform();
    const onL = vi.fn();
    const onR = vi.fn();
    const { getByTestId } = render(<Harness onL={onL} onR={onR} />);
    const root = getByTestId('swipe-root');
    act(() => {
      root.dispatchEvent(touchEvent('touchstart', [{ clientX: 300, clientY: 200 }]));
      root.dispatchEvent(touchEvent('touchend', [{ clientX: 120, clientY: 205 }]));
    });
    expect(onL).toHaveBeenCalledTimes(1);
    expect(onR).not.toHaveBeenCalled();
    act(() => {
      root.dispatchEvent(touchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));
      root.dispatchEvent(touchEvent('touchend', [{ clientX: 280, clientY: 195 }]));
    });
    expect(onR).toHaveBeenCalledTimes(1);
  });

  it('4. короткий и вертикальный свайпы игнорируются', async () => {
    setCapacitorNative();
    await resetPlatform();
    const onL = vi.fn();
    const onR = vi.fn();
    const { getByTestId } = render(<Harness onL={onL} onR={onR} />);
    const root = getByTestId('swipe-root');
    act(() => {
      root.dispatchEvent(touchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
      root.dispatchEvent(touchEvent('touchend', [{ clientX: 150, clientY: 200 }]));
    });
    act(() => {
      root.dispatchEvent(touchEvent('touchstart', [{ clientX: 200, clientY: 100 }]));
      root.dispatchEvent(touchEvent('touchend', [{ clientX: 60, clientY: 300 }]));
    });
    expect(onL).not.toHaveBeenCalled();
    expect(onR).not.toHaveBeenCalled();
  });

  it('5. старт на форме и data-no-swipe игнорируется', async () => {
    setCapacitorNative();
    await resetPlatform();
    const onL = vi.fn();
    const onR = vi.fn();
    const { container } = render(
      <Harness
        onL={onL}
        onR={onR}
        extra={
          <>
            <input data-testid="fld" />
            <div data-no-swipe data-testid="locked">
              x
            </div>
          </>
        }
      />,
    );
    const fire = (el: Element) => {
      const s = touchEvent('touchstart', [{ clientX: 300, clientY: 200 }]);
      Object.defineProperty(s, 'target', { value: el });
      const e = touchEvent('touchend', [{ clientX: 100, clientY: 200 }]);
      Object.defineProperty(e, 'target', { value: el });
      act(() => {
        container.firstElementChild!.dispatchEvent(s);
        container.firstElementChild!.dispatchEvent(e);
      });
    };
    const fld = container.querySelector('[data-testid="fld"]')!;
    const locked = container.querySelector('[data-testid="locked"]')!;
    fire(fld);
    fire(locked);
    expect(onL).not.toHaveBeenCalled();
    expect(onR).not.toHaveBeenCalled();
  });

  it('6. старт внутри fixed-оверлея игнорируется', async () => {
    setCapacitorNative();
    await resetPlatform();
    const onL = vi.fn();
    const onR = vi.fn();
    const { container } = render(
      <Harness
        onL={onL}
        onR={onR}
        extra={
          <div data-testid="overlay" style={{ position: 'fixed', inset: 0 }}>
            <span data-testid="inner">x</span>
          </div>
        }
      />,
    );
    const inner = container.querySelector('[data-testid="inner"]')!;
    const s = touchEvent('touchstart', [{ clientX: 300, clientY: 200 }]);
    Object.defineProperty(s, 'target', { value: inner });
    const e = touchEvent('touchend', [{ clientX: 100, clientY: 200 }]);
    Object.defineProperty(e, 'target', { value: inner });
    act(() => {
      container.firstElementChild!.dispatchEvent(s);
      container.firstElementChild!.dispatchEvent(e);
    });
    expect(onL).not.toHaveBeenCalled();
    expect(onR).not.toHaveBeenCalled();
  });

  it('7. вне native хук молчит (Telegram/web без изменений)', async () => {
    await resetPlatform();
    expect(isNativeApp()).toBe(false);
    const onL = vi.fn();
    const onR = vi.fn();
    const { getByTestId } = render(<Harness onL={onL} onR={onR} />);
    const root = getByTestId('swipe-root');
    act(() => {
      root.dispatchEvent(touchEvent('touchstart', [{ clientX: 300, clientY: 200 }]));
      root.dispatchEvent(touchEvent('touchend', [{ clientX: 100, clientY: 200 }]));
    });
    expect(onL).not.toHaveBeenCalled();
    expect(onR).not.toHaveBeenCalled();
  });
});
