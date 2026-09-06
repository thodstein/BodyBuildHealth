/**
 * dashboard-native.test.tsx — Главная: ветвление PRO-home (APK) / классика (Telegram/web).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DashboardScreen } from '../screens/DashboardScreen';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  try {
    window.location.hash = '';
  } catch {
    /* ignore */
  }
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

describe('DashboardScreen platform branching', () => {
  it('1. native → PRO-home: тот же hero + только Профиль/Магазин/Статьи', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<DashboardScreen />);
    // Тот же hero на весь экран
    const img = document.querySelector('.native-home-bg img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('hero-main.png');
    // Только 3 кнопки — без приветствий, статистики и плиток
    expect(screen.getByText('Профиль')).not.toBeNull();
    expect(screen.getByText('Магазин')).not.toBeNull();
    expect(screen.getByText('Статьи')).not.toBeNull();
    expect(screen.queryByText(/Доброе утро|Добрый день|Добрый вечер|Доброй ночи/)).toBeNull();
    expect(screen.queryByText('Тренинг')).toBeNull();
    expect(screen.queryByText('тренировок на неделе')).toBeNull();
    // Герой чистый: настроек телефона тут нет — они в Профиле → Настройки
    expect(document.querySelector('.native-feature-card')).toBeNull();
    expect(screen.queryByText('Виджеты на рабочий стол')).toBeNull();
    expect(screen.queryByText('Возможности APK')).toBeNull();
  });

  it('2. native → клик по кнопке ведёт в раздел', async () => {
    setCapacitorNative();
    await resetPlatform();
    const calls: string[] = [];
    render(<DashboardScreen onNavigate={(s) => calls.push(s)} />);
    fireEvent.click(screen.getByText('Профиль'));
    expect(calls).toEqual(['profile']);
  });

  it('2b. native → иконки трио — штриховые SVG (не эмодзи)', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<DashboardScreen />);
    const icons = document.querySelectorAll('.native-home-tile-icon svg');
    expect(icons.length).toBe(3);
    expect(document.querySelector('.native-home-tile-icon')?.textContent).not.toMatch(/👤|🛍|📚/);
  });

  it('3. web/Telegram → классический hero без изменений (3 кнопки)', async () => {
    await resetPlatform();
    render(<DashboardScreen />);
    expect(document.querySelector('.native-home')).toBeNull();
    expect(screen.getByText('Профиль')).not.toBeNull();
    expect(screen.getByText('Магазин')).not.toBeNull();
    expect(screen.getByText('Статьи')).not.toBeNull();
  });
});
