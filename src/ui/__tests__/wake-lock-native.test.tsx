/**
 * wake-lock-native.test.tsx — экран не гаснет только в активной фазе APK.
 * В TG/web хук обязан быть полным no-op (без navigator.wakeLock не трогаем).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { resetAppPlatformCache } from '../../core/app-platform';
import { useNativeWakeLock } from '../native/useWakeLock';

const Probe: React.FC<{ active: boolean }> = ({ active }) => {
  useNativeWakeLock(active);
  return null;
};

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

function setWakeLockMock() {
  const release = vi.fn(async () => {});
  const request = vi.fn(async () => ({ release }));
  (navigator as unknown as { wakeLock?: unknown }).wakeLock = { request };
  return { request, release };
}

beforeEach(() => {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
  resetAppPlatformCache();
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
  resetAppPlatformCache();
});

describe('useNativeWakeLock', () => {
  it('web/TG: no-op даже при active (запроса нет)', async () => {
    const { request } = setWakeLockMock();
    render(<Probe active />);
    await new Promise((r) => setTimeout(r, 0));
    expect(request).not.toHaveBeenCalled();
  });

  it('APK active: запрос есть, unmount отпускает', async () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const { request, release } = setWakeLockMock();
    const { unmount } = render(<Probe active />);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(request).toHaveBeenCalledWith('screen');
    unmount();
    expect(release).toHaveBeenCalled();
  });

  it('APK inactive: запроса нет', async () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const { request } = setWakeLockMock();
    render(<Probe active={false} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(request).not.toHaveBeenCalled();
  });
});
