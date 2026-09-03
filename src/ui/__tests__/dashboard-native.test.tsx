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
  it('1. native → PRO-home: приветствие, статистика, 9 разделов, тот же hero', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<DashboardScreen />);
    // Тот же hero на весь экран
    const img = document.querySelector('.native-home-bg img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('hero-main.png');
    // Приветствие
    expect(
      screen.getByText(/Доброе утро|Добрый день|Добрый вечер|Доброй ночи/),
    ).not.toBeNull();
    // Статистика
    expect(screen.getByText('тренировок на неделе')).not.toBeNull();
    expect(screen.getByText('вес, кг')).not.toBeNull();
    expect(screen.getByText('сон, ч')).not.toBeNull();
    // Все 9 разделов
    for (const label of [
      'Тренинг',
      'Питание',
      'Анализы',
      'Риски',
      'Фарма',
      'БАДы',
      'Профиль',
      'Статьи',
      'Магазин',
    ]) {
      expect(screen.getByText(label)).not.toBeNull();
    }
    // Герой чистый: настроек телефона тут нет — они в Профиле → Настройки
    expect(document.querySelector('.native-feature-card')).toBeNull();
    expect(screen.queryByText('Виджеты на рабочий стол')).toBeNull();
    expect(screen.queryByText('Возможности APK')).toBeNull();
  });

  it('2. native → клик по плитке ведёт в раздел', async () => {
    setCapacitorNative();
    await resetPlatform();
    const calls: string[] = [];
    render(<DashboardScreen onNavigate={(s) => calls.push(s)} />);
    fireEvent.click(screen.getByText('Тренинг'));
    expect(calls).toEqual(['training']);
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
