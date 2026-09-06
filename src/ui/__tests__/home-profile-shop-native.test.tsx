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
import { NativeIcon, NATIVE_ICON_NAMES } from '../native/NativeIcons';
import { alphaWith, makeAlpha, makeFill } from '../native/accent';
import { DiaryCard, DIARY_META } from '../screens/ProfileScreen_v2/diary-ui';
import { REPORT_SOURCES } from '../screens/ProfileScreen_v2/ProfileReportsTab';
import { SupportHomeView } from '../screens/SupportScreen_parts/SupportHomeView';

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

describe('NativeIcon (SVG-набор)', () => {
  it('все имена рендерят svg с viewBox', () => {
    expect(NATIVE_ICON_NAMES.length).toBeGreaterThan(20);
    for (const name of NATIVE_ICON_NAMES) {
      const { container, unmount } = render(<NativeIcon name={name} size={16} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.innerHTML.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('неизвестное имя — нейтральная точка, не пустота', () => {
    const { container } = render(<NativeIcon name="nope-unknown" />);
    expect(container.querySelector('svg circle')).not.toBeNull();
  });

  it('size/класс прокидываются', () => {
    const { container } = render(<NativeIcon name="heart" size={34} className="t" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('34');
    expect(svg?.getAttribute('class')).toBe('t');
  });
});

describe('DiaryCard и отчёты на SVG', () => {
  it('все типы дневников имеют иконку из набора', () => {
    for (const key of Object.keys(DIARY_META) as (keyof typeof DIARY_META)[]) {
      expect(NATIVE_ICON_NAMES, key).toContain(DIARY_META[key].icon);
    }
  });

  it('DiaryCard рендерит svg-иконку типа', () => {
    const { container } = render(
      <DiaryCard diaryKey="sleep" count={0} last="" daysSinceLast={null} loggedToday={false} onAdd={() => {}} onOpen={() => {}} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('path')).not.toBeNull();
  });

  it('все источники отчётов имеют иконку из набора', () => {
    for (const src of REPORT_SOURCES) {
      expect(NATIVE_ICON_NAMES, src.label).toContain(src.icon);
    }
  });
});

describe('SupportHomeView (волна 9)', () => {
  it('hero-карточки рендерят SVG, не эмодзи', () => {
    const { container } = render(<SupportHomeView s={{}} />);
    expect(container.querySelectorAll('.support-hero-card svg').length).toBe(3);
  });
});

describe('accent.ts (единый мост)', () => {
  it('alphaWith: hex — сквозной, var — rgba', () => {
    expect(alphaWith('var(--x)', 'var(--x-rgb)', '#aabbcc', '44')).toBe('#aabbcc44');
    expect(alphaWith('var(--x)', 'var(--x-rgb)', 'var(--x)', '44')).toBe('rgba(var(--x-rgb), 0.267)');
  });

  it('makeAlpha/makeFill — фабрики с тем же выхлопом', () => {
    const wa = makeAlpha('var(--x)', 'var(--x-rgb)');
    expect(wa('#112233', '22')).toBe('#11223322');
    expect(wa('var(--x)', '22')).toBe('rgba(var(--x-rgb), 0.133)');
    const fill = makeFill('var(--x-rgb)');
    expect(fill(0.14)).toBe('rgba(var(--x-rgb), 0.14)');
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

describe('CSS §67 + §70 (вторичный контент PRO)', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native.css'), 'utf-8');

  it('§67: все вторичные корни с акцентной плашкой h2', () => {
    for (const sel of [
      '.screen.gamification',
      '.screen.recovery-screen',
      '.screen.plan',
      '.screen.fertility-pct',
      '.screen.peptides',
      '.screen.assistant',
      '.screen.role-management',
      '.screen.substances',
      '.screen.predictive-analytics',
      '.screen.perf-screen',
      '.rep-screen',
      '.sup-clinic',
    ]) {
      expect(css, sel).toContain(sel);
    }
    expect(css).toContain('border-left: 3px solid var(--accent)');
  });

  it('§70: стекло-карточки + press/focus + tabular, всё под html.app-native', () => {
    const i = css.indexOf('70. SECONDARY CONTENT PRO');
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i, i + 6000);
    expect(block).toContain('.screen.gamification .card');
    expect(block).toContain('backdrop-filter: blur(20px)');
    expect(block).toContain('font-variant-numeric: tabular-nums');
    expect(block).toContain(':active');
    expect(block).toContain(':focus-visible');
    expect(block).toContain('prefers-reduced-motion');
    for (const line of block.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('/*') || t.startsWith('*')) continue;
      if (!t.endsWith('{')) continue;
      const sel = t.slice(0, -1).trim();
      if (!sel || sel.startsWith('@')) continue;
      for (const p of sel.split(',').map((s) => s.trim()).filter(Boolean)) {
        expect(p.startsWith('html.app-native'), p).toBe(true);
      }
    }
  });
});
