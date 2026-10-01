/**
 * nutrition-periodization-tab.test.tsx — E17: таб «🍽 Периодизация» в секции
 * «Анализ» (топ-таб со скоупом плана) рендерит карточку периодизации питания.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { NutritionScreen } from '../screens/NutritionScreen';

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  try { window.location.hash = ''; } catch { /* ignore */ }
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  await resetPlatform();
});

const openNav = (container: HTMLElement): void => {
  const burger = container.querySelector('[aria-label="Меню питания"]') as HTMLElement | null;
  if (burger) fireEvent.click(burger);
};

describe('Питание: таб Периодизация (Анализ)', () => {
  it('чип «Периодизация» есть в Анализе и открывает карточку', async () => {
    const { container } = render(<NutritionScreen />);
    fireEvent.click(container.querySelector('.nutrition-hero-card[data-section="analysis"]') as HTMLElement);
    openNav(container);
    const chips = Array.from(container.querySelectorAll('.nutrition-chip'));
    const chip = chips.find(c => c.textContent?.includes('Периодизация')) as HTMLElement | undefined;
    expect(chip).toBeTruthy();
    fireEvent.click(chip!);
    expect(document.body.textContent).toMatch(/Периодизация питания/);
  });
});
