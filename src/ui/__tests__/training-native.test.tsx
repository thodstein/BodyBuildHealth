/**
 * training-native.test.tsx — Тренинг: native hero со статистикой, классика без изменений,
 * навигация зон цела на обеих платформах.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TrainingScreen } from '../screens/TrainingScreen';

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

describe('TrainingScreen native hero', () => {
  it('1. native → тот же hero + полоска статистики + 5 зон', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<TrainingScreen />);
    const img = container.querySelector(
      '.training-hero img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toContain('training-hero.jpg');
    expect(container.querySelector('.training-hero-stats')).not.toBeNull();
    expect(screen.getByText('на неделе')).not.toBeNull();
    expect(container.querySelectorAll('.training-hero-zone').length).toBe(5);
  });

  it('2. web/Telegram → hero без stats-блока (классика нетронута)', async () => {
    await resetPlatform();
    const { container } = render(<TrainingScreen />);
    expect(container.querySelector('.training-hero-stats')).toBeNull();
    expect(screen.getByText('Тренировки')).not.toBeNull();
    expect(container.querySelectorAll('.training-hero-zone').length).toBe(5);
  });

  it('3. навигация зон работает на native (Библиотека → вкладки)', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<TrainingScreen />);
    const lib = container.querySelector(
      '.training-hero-zone[data-zone="library"]',
    ) as HTMLElement;
    expect(lib).not.toBeNull();
    fireEvent.click(lib);
    expect(screen.getAllByText('📖 Библиотека').length).toBeGreaterThan(0);
  });

  it('4. навигация зон работает в web (Планировщик → выбор конструктора)', async () => {
    await resetPlatform();
    const { container } = render(<TrainingScreen />);
    const planner = container.querySelector(
      '.training-hero-zone[data-zone="planner"]',
    ) as HTMLElement;
    fireEvent.click(planner);
    expect(screen.getAllByText(/конструкторов/).length).toBeGreaterThan(0);
  });
});
