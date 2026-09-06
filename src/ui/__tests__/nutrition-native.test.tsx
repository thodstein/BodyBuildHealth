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

  it('5. графики показывают скелетон загрузки', async () => {
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    fireEvent.click(
      container.querySelector(
        '.nutrition-hero-card[data-section="diary"]',
      ) as HTMLElement,
    );
    const chips = Array.from(container.querySelectorAll('.nutrition-chip'));
    const charts = chips.find((c) => c.textContent?.includes('Графики')) as HTMLElement;
    expect(charts).not.toBeNull();
    fireEvent.click(charts);
    expect(container.querySelector('.native-skeleton-row')).not.toBeNull();
    expect(container.querySelectorAll('.native-skeleton').length).toBeGreaterThan(0);
  });

  it('6. native → hero-карточки с SVG, в шапке сканер', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    const cards = container.querySelectorAll('.nutrition-hero-card svg');
    expect(cards.length).toBe(2);
    fireEvent.click(
      container.querySelector('.nutrition-hero-card[data-section="diary"]') as HTMLElement,
    );
    expect(container.querySelector('.nutrition-scan-btn')).not.toBeNull();
    expect(container.querySelector('.nutrition-scan-btn svg')).not.toBeNull();
  });

  it('7. web → сканера в шапке нет (классика 1-в-1)', async () => {
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    fireEvent.click(
      container.querySelector('.nutrition-hero-card[data-section="diary"]') as HTMLElement,
    );
    expect(container.querySelector('.nutrition-scan-btn')).toBeNull();
  });

  it('8. ModernHero маппит эмодзи в SVG, неизвестное — как было', async () => {
    await resetPlatform();
    const { ModernHero } = await import('../screens/NutritionScreen_parts/nutrition-modern-kit');
    const { container, rerender } = render(
      <ModernHero icon="🛒" title="T" subtitle="S" />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(<ModernHero icon="??" title="T" subtitle="S" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toContain('??');
  });

  it('9. волна 22: переключатель разделов меняет набор чипов', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    fireEvent.click(
      container.querySelector('.nutrition-hero-card[data-section="diary"]') as HTMLElement,
    );
    const sections = container.querySelectorAll('.nutrition-section');
    expect(sections.length).toBe(5);
    const plan = Array.from(sections).find((s) => s.textContent === 'План') as HTMLElement;
    fireEvent.click(plan);
    expect(plan.dataset.active).toBe('true');
    const chips = Array.from(container.querySelectorAll('.nutrition-chip'));
    expect(chips.length).toBe(9);
    expect(chips.some((c) => c.textContent?.includes('План'))).toBe(true);
  });

  it('10. волна 22: переключатель есть и в web (общая навигация)', async () => {
    await resetPlatform();
    const { container } = render(<NutritionScreen />);
    fireEvent.click(
      container.querySelector('.nutrition-hero-card[data-section="planning"]') as HTMLElement,
    );
    expect(container.querySelectorAll('.nutrition-section').length).toBe(5);
  });
});
