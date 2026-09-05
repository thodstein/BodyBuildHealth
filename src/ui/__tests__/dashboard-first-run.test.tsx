/**
 * dashboard-first-run.test.tsx — first-run empty state Главной (только APK).
 * Нулевая история → карточка NativeEmpty с CTA; после первой сессии её нет.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { DashboardNative } from '../screens/DashboardScreen.native';
import { resetAppPlatformCache } from '../../core/app-platform';
import { setLocale } from '../../data/interactions-labels';
import {
  startSession,
  finishSession,
} from '../../engines/workout-logger.engine';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

beforeEach(async () => {
  try {
    localStorage.clear();
  } catch {}
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  resetAppPlatformCache();
  try {
    setLocale('ru');
  } catch {}
});

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {}
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  resetAppPlatformCache();
  try {
    setLocale('ru');
    vi.useRealTimers();
  } catch {}
});

describe('DashboardNative first-run', () => {
  it('пустая история → CTA первой тренировки ведёт в тренинг', () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const calls: string[] = [];
    const { container } = render(<DashboardNative onNavigate={(s) => calls.push(s)} />);
    expect(screen.getByText('Первая тренировка ждёт')).not.toBeNull();
    fireEvent.click(screen.getByText(/К тренингу/));
    expect(calls).toEqual(['training']);
    // Guard от молчаливого отката: hero идёт через HeroImg (WebP + фолбэк).
    const source = container.querySelector('.native-home-bg source[type="image/webp"]');
    expect(source?.getAttribute('srcset')).toContain('hero-main.webp');
  });

  it('EN-локаль: приветствие, дата и разделы по-английски', () => {
    // Суббота, 10:00 — детерминированное утро.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5, 10, 0, 0));
    setLocale('en');
    setCapacitorNative();
    resetAppPlatformCache();
    render(<DashboardNative />);
    expect(screen.getByText(/Good morning/)).not.toBeNull();
    expect(screen.getByText(/September/)).not.toBeNull();
    expect(screen.getByText('Training')).not.toBeNull();
    expect(screen.getByText('Sections')).not.toBeNull();
    expect(screen.getByText('First workout awaits')).not.toBeNull();
    vi.useRealTimers();
    setLocale('ru');
  });

  it('плитки каскадом: animationDelay по индексу', () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const { container } = render(<DashboardNative />);
    const tiles = container.querySelectorAll('.native-home-tile');
    expect(tiles.length).toBeGreaterThan(3);
    expect((tiles[0] as HTMLElement).style.animationDelay).toBe('0ms');
    expect((tiles[1] as HTMLElement).style.animationDelay).toBe('45ms');
  });

  it('после первой сессии карточки нет', () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const s = startSession('Тест', 1);
    finishSession({ ...s, date: '2026-09-05' }, '');
    render(<DashboardNative />);
    expect(screen.queryByText('Первая тренировка ждёт')).toBeNull();
  });
});
