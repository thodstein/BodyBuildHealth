/**
 * dashboard-first-run.test.tsx — лендинг Главной APK: hero + сводка дня +
 * CTA + карусель разделов + 3 кнопки (Профиль/Магазин/Статьи),
 * без приветствий.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { DashboardNative } from '../screens/DashboardScreen.native';
import { resetAppPlatformCache } from '../../core/app-platform';
import { setLocale } from '../../data/interactions-labels';

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

describe('DashboardNative landing', () => {
  it('hero + сводка + CTA + карусель + 3 кнопки, без приветствий', () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const { container } = render(<DashboardNative />);
    const img = container.querySelector('.native-home-bg img');
    expect(img?.getAttribute('src')).toContain('hero-main.png');
    expect(screen.getByText('Профиль')).not.toBeNull();
    expect(screen.getByText('Магазин')).not.toBeNull();
    expect(screen.getByText('Статьи')).not.toBeNull();
    expect(screen.queryByText(/Доброе утро|Добрый день|Добрый вечер|Доброй ночи/)).toBeNull();
    // Карусель разделов (волна A): 6 рабочих табов с SVG.
    expect(container.querySelectorAll('.native-home-rail-item').length).toBe(6);
    expect(container.querySelectorAll('.native-home-today .native-home-stat').length).toBe(3);
    expect(container.querySelector('.native-home-cta')).not.toBeNull();
    expect(screen.queryByText('Разделы')).toBeNull();
  });

  it('клик по кнопке ведёт в раздел', () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const calls: string[] = [];
    render(<DashboardNative onNavigate={(s) => calls.push(s)} />);
    fireEvent.click(screen.getByText('Магазин'));
    expect(calls).toEqual(['marketplace']);
  });

  it('плитки трио каскадом: animationDelay по индексу', () => {
    setCapacitorNative();
    resetAppPlatformCache();
    const { container } = render(<DashboardNative />);
    const tiles = container.querySelectorAll('.native-home-trio .native-home-tile');
    expect(tiles.length).toBe(3);
    expect((tiles[0] as HTMLElement).style.animationDelay).toBe('0ms');
    expect((tiles[2] as HTMLElement).style.animationDelay).toBe('120ms');
  });

  it('EN-локаль: кнопки по-английски', () => {
    setLocale('en');
    try {
      setCapacitorNative();
      resetAppPlatformCache();
      render(<DashboardNative />);
      expect(screen.getByText('Profile')).not.toBeNull();
      expect(screen.getByText('Store')).not.toBeNull();
      expect(screen.getByText('Articles')).not.toBeNull();
    } finally {
      setLocale('ru');
    }
  });
});
