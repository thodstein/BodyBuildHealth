/**
 * nutrition-native.test.tsx — Питание: native hero со «съедено сегодня»,
 * классика без изменений, навигация hero ↔ вкладки на обеих платформах.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NutritionScreen } from '../screens/NutritionScreen';

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

describe('NutritionScreen native hero', () => {
  it('1. native → тот же hero + «съедено сегодня» + 2 карточки', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    const img = container.querySelector(
      '.nutrition-hero img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toContain('nutrition-hero.jpg');
    expect(container.querySelector('.nutrition-hero-stats')).not.toBeNull();
    expect(screen.getByText(/ккал ·/)).not.toBeNull();
    expect(container.querySelectorAll('.nutrition-hero-card').length).toBe(2);
  });

  it('2. web/Telegram → hero без stats-блока (классика нетронута)', async () => {
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    expect(container.querySelector('.nutrition-hero-stats')).toBeNull();
    expect(screen.getByText('Питание')).not.toBeNull();
    expect(container.querySelectorAll('.nutrition-hero-card').length).toBe(2);
  });

  it('3. навигация hero → вкладки → назад работает на native', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    const diary = container.querySelector(
      '.nutrition-hero-card[data-section="diary"]',
    ) as HTMLElement;
    expect(diary).not.toBeNull();
    fireEvent.click(diary);
    expect(container.querySelector('.nutrition-chips')).not.toBeNull();
    const back = container.querySelector(
      '.nutrition-tabs-head button',
    ) as HTMLElement;
    fireEvent.click(back);
    expect(container.querySelector('.nutrition-hero')).not.toBeNull();
  });

  it('4. навигация hero → вкладки работает в web', async () => {
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    const planning = container.querySelector(
      '.nutrition-hero-card[data-section="planning"]',
    ) as HTMLElement;
    fireEvent.click(planning);
    expect(container.querySelector('.nutrition-chips')).not.toBeNull();
  });
});
