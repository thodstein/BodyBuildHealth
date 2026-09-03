/**
 * profile-articles-native.test.tsx — Профиль и Статьи: hero цел на обеих
 * платформах, native-классы на месте, навигация работает.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfileHero } from '../screens/ProfileScreen_v2/ProfileHero';
import { ArticlesScreen } from '../screens/ArticlesScreen';

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
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

describe('ProfileHero', () => {
  it('1. native → hero + имя + прогресс + 4 раздела', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<ProfileHero onSelectTab={() => {}} />);
    const img = container.querySelector(
      '.profile-hero img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toContain('profile-hero.png');
    expect(container.querySelector('.profile-hero-name')).not.toBeNull();
    expect(
      container.querySelector('.profile-hero-progress [role="progressbar"]'),
    ).not.toBeNull();
    expect(container.querySelectorAll('.profile-hero-card').length).toBe(4);
  });

  it('2. web → та же классика (hero, 4 раздела)', async () => {
    await resetPlatform();
    const { container } = render(<ProfileHero onSelectTab={() => {}} />);
    expect(container.querySelector('.profile-hero')).not.toBeNull();
    expect(container.querySelectorAll('.profile-hero-card').length).toBe(4);
  });

  it('3. клик по разделу открывает вкладку', async () => {
    await resetPlatform();
    const calls: string[] = [];
    const { container } = render(
      <ProfileHero onSelectTab={(id) => calls.push(id)} />,
    );
    const diaries = container.querySelector(
      '.profile-hero-card[data-id="diaries"]',
    ) as HTMLElement;
    fireEvent.click(diaries);
    expect(calls).toEqual(['diaries']);
  });
});

describe('ArticlesScreen', () => {
  it('4. native → hero + категории', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<ArticlesScreen />);
    const img = container.querySelector(
      '.articles-hero img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toContain('articles-hero.png');
    expect(container.querySelectorAll('.articles-hero-card').length).toBeGreaterThan(0);
  });

  it('5. навигация hero → список → назад работает', async () => {
    await resetPlatform();
    const { container } = render(<ArticlesScreen />);
    const first = container.querySelector('.articles-hero-card') as HTMLElement;
    expect(first).not.toBeNull();
    fireEvent.click(first);
    expect(container.querySelector('.articles-toolbar')).not.toBeNull();
    const back = container.querySelector(
      '.articles-toolbar button',
    ) as HTMLElement;
    fireEvent.click(back);
    expect(container.querySelector('.articles-hero')).not.toBeNull();
  });
});
