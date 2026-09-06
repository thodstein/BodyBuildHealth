/**
 * home-profile-shop-native.test.tsx — волны A–D: Главная/Профиль/Магазин/Статьи.
 * Native-ветки за isNativeApp()-гейтом, TG/web-классика не тронута.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { ProfileHero } from '../screens/ProfileScreen_v2/ProfileHero';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { ArticlesScreen } from '../screens/ArticlesScreen';
import { loadSavedArticles, toggleSavedArticle } from '../screens/ArticlesScreen';

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
    localStorage.clear();
  } catch {}
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

describe('ProfileHero CTA (волна B)', () => {
  it('native → кнопка «Дозаполнить» ведёт в Пользователя', async () => {
    setCapacitorNative();
    await resetPlatform();
    try {
      localStorage.setItem(
        'he_profile_v2',
        JSON.stringify({
          name: '',
          id: '',
          role: 'user',
          settings: { personal: {}, training: {}, lifestyle: {}, health: {}, nutrition: {}, goals: {}, pharma: {} },
        }),
      );
    } catch {}
    const calls: string[] = [];
    render(<ProfileHero onSelectTab={(id) => calls.push(id)} />);
    const cta = document.querySelector('.profile-hero-cta') as HTMLElement | null;
    expect(cta).not.toBeNull();
    fireEvent.click(cta!);
    expect(calls).toEqual(['user']);
  });

  it('web → CTA нет (классика 1-в-1)', async () => {
    await resetPlatform();
    render(<ProfileHero onSelectTab={() => {}} />);
    expect(document.querySelector('.profile-hero-cta')).toBeNull();
  });
});

describe('Marketplace search (волна C)', () => {
  it('native → поиск есть и фильтрует каталог', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<MarketplaceScreen />);
    const input = screen.getByLabelText('Поиск по каталогу') as HTMLInputElement;
    expect(input).not.toBeNull();
    const before = document.querySelectorAll('.market-card').length;
    expect(before).toBeGreaterThan(0);
    fireEvent.change(input, { target: { value: 'zzz-несуществует' } });
    expect(document.querySelectorAll('.market-card').length).toBe(0);
    fireEvent.change(input, { target: { value: '' } });
    expect(document.querySelectorAll('.market-card').length).toBe(before);
  });

  it('web → поиска нет (классика 1-в-1)', async () => {
    await resetPlatform();
    render(<MarketplaceScreen />);
    expect(screen.queryByLabelText('Поиск по каталогу')).toBeNull();
    expect(document.querySelectorAll('.market-card').length).toBeGreaterThan(0);
  });
});

describe('Articles saved/offline (волна D)', () => {
  it('load/toggle сохранённых: roundtrip в localStorage', async () => {
    await resetPlatform();
    expect(loadSavedArticles()).toEqual([]);
    expect(toggleSavedArticle('a1')).toEqual(['a1']);
    expect(loadSavedArticles()).toEqual(['a1']);
    expect(toggleSavedArticle('a1')).toEqual([]);
  });

  it('native → чип «Сохранённые» и закладка в читалке', async () => {
    setCapacitorNative();
    await resetPlatform();
    render(<ArticlesScreen />);
    // Уходим с hero в список.
    const firstCard = document.querySelector('.articles-hero-card') as HTMLElement | null;
    expect(firstCard).not.toBeNull();
    fireEvent.click(firstCard!);
    expect(screen.getByText('Сохранённые')).not.toBeNull();
    // Открываем первую статью → в читалке есть закладка.
    const clickables = Array.from(document.querySelectorAll('.articles-list div')).filter(
      (el) => (el as HTMLElement).style?.cursor === 'pointer',
    ) as HTMLElement[];
    expect(clickables.length).toBeGreaterThan(0);
    fireEvent.click(clickables[0]);
    expect(document.querySelector('.article-bookmark')).not.toBeNull();
  });

  it('web → чипа сохранённых нет', async () => {
    await resetPlatform();
    render(<ArticlesScreen />);
    const firstCard = document.querySelector('.articles-hero-card') as HTMLElement | null;
    fireEvent.click(firstCard!);
    expect(screen.queryByText(/Сохранённые/)).toBeNull();
  });
});

describe('CSS §63–64 (волны A–D)', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native.css'), 'utf-8');

  it('home: сводка/CTA/карусель под html.app-native', () => {
    expect(css).toContain('.native-home-today');
    expect(css).toContain('.native-home-cta');
    expect(css).toContain('.native-home-rail');
  });

  it('shop/articles: акцентные хуки без hex в блоке', () => {
    expect(css).toContain('.market-buy');
    expect(css).toContain('.article-chip');
    const block = css.slice(css.indexOf('64. SHOP + ARTICLES'), css.indexOf('59. APK DYNAMIC COLOR'));
    expect(block).not.toMatch(/#c9f73a|#00e68a/i);
  });
});
