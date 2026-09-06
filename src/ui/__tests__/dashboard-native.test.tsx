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
  it('1. native → PRO-home: hero + сводка дня + CTA + карусель + трио', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<DashboardScreen />);
    // Тот же hero на весь экран
    const img = document.querySelector('.native-home-bg img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('hero-main.png');
    // Только 3 кнопки трио — без приветствий и статистики
    expect(screen.getByText('Профиль')).not.toBeNull();
    expect(screen.getByText('Магазин')).not.toBeNull();
    expect(screen.getByText('Статьи')).not.toBeNull();
    expect(screen.queryByText(/Доброе утро|Добрый день|Добрый вечер|Доброй ночи/)).toBeNull();
    expect(screen.queryByText('тренировок на неделе')).toBeNull();
    // Сводка дня: 3 живые метрики с навигацией
    expect(document.querySelectorAll('.native-home-stat').length).toBe(3);
    // Умная CTA ведёт первым незакрытым (пусто → тренировка)
    expect(document.querySelector('.native-home-cta')).not.toBeNull();
    // Карусель разделов: 6 рабочих табов
    expect(document.querySelectorAll('.native-home-rail-item').length).toBe(6);
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

  it('2c. native → CTA ведёт первым незакрытым; nextHomeAction — чистая логика', async () => {
    const { nextHomeAction } = await import('../screens/DashboardScreen.native');
    expect(nextHomeAction({ trained: false, sessionsToday: 0, kcalToday: 0, queue: 0 }).id).toBe('training');
    expect(nextHomeAction({ trained: true, sessionsToday: 1, kcalToday: 500, queue: 3 }).id).toBeNull();
    expect(nextHomeAction({ trained: true, sessionsToday: 1, kcalToday: 0, queue: 0 }).id).toBe('nutrition');
    setCapacitorNative();
    await resetPlatform();
    const calls: string[] = [];
    render(<DashboardScreen onNavigate={(s) => calls.push(s)} />);
    const cta = document.querySelector('.native-home-cta') as HTMLElement | null;
    expect(cta).not.toBeNull();
    cta!.click();
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
