/**
 * apk-top-pack.test.tsx — TOP-оформление APK: темы, акцент, FAB, HeroImg,
 * бейджи, TG-изоляция CSS. Hero-файлы не меняются — только подача поверх.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';

// native-bridge тянет TG/Web-цепочку с CSS — мокаем целиком.
vi.mock('../../core/native-bridge', () => ({
  haptics: vi.fn(),
  isOnline: vi.fn(() => true),
  watchOnline: vi.fn(() => () => {}),
  initNativeChrome: vi.fn(async () => {}),
}));
import { NativeFab } from '../native/NativeFab';
import { NativeOfflinePill } from '../native/NativeOfflinePill';
import { isOnline, watchOnline } from '../../core/native-bridge';
import { HeroImg } from '../HeroImg';
import { getNavBadges } from '../native/nav-badges';
// ВНИМАНИЕ: CSS читаем через process.cwd(), а НЕ через new URL(*.css,
// import.meta.url) — Vite считает такую конструкцию ассетом и падает
// на CSS-модулях (?url is not supported with CSS modules).
import {
  getApkTheme,
  setApkTheme,
  applyApkTheme,
  initApkAppearance,
  getApkAccent,
  setApkAccent,
  applySystemAccentFromDevice,
  hexToRgbTriplet,
  contrastForHex,
  writeSystemVars,
  clearSystemVars,
  themeMetaColor,
} from '../native/appearance';
import { NativeEmpty } from '../native/NativeEmpty';
import { AppearanceSetupCard } from '../native/AppearanceSetupCard';

function readCss(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', name), 'utf-8');
}

describe('APK TOP pack', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    try {
      document.documentElement.removeAttribute('data-apk-theme');
      document.documentElement.removeAttribute('data-apk-accent');
    } catch {}
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
    try {
      document.documentElement.removeAttribute('data-apk-theme');
      document.documentElement.removeAttribute('data-apk-accent');
    } catch {}
  });

  it('appearance: дефолт пустой, set/apply персистят, вне native DOM не трогается', () => {
    expect(getApkTheme()).toBe('');
    // В jsdom нет Capacitor → applyApkTheme обязан быть no-op для DOM…
    applyApkTheme('amoled');
    // …включая theme-color (Mini App и тесты не меняют chrome).
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
    // …но персист через setApkTheme работает везде (для будущего native-запуска).
    setApkTheme('light');
    expect(getApkTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-apk-theme')).toBeNull();
    setApkTheme('');
    expect(getApkTheme()).toBe('');
    expect(initApkAppearance()).toBe('');
  });

  it('themeMetaColor: recent-apps 1-в-1 с фоном темы', () => {
    expect(themeMetaColor('')).toBe('#050b16');
    expect(themeMetaColor('amoled')).toBe('#000000');
    expect(themeMetaColor('light')).toBe('#eef2f6');
  });

  it('NativeFab speed-dial: тап раскрывает, тренинг ведёт в дневник', () => {
    let called = 0;
    const { container, rerender } = render(<NativeFab onQuickLog={() => { called += 1; }} />);
    const btn = container.querySelector('.native-fab');
    expect(btn, 'fab').not.toBeNull();
    expect(btn?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.native-fab-mini'), 'collapsed').toBeNull();
    fireEvent.click(btn!);
    expect(btn?.getAttribute('aria-expanded')).toBe('true');
    const minis = container.querySelectorAll('.native-fab-mini');
    expect(minis.length).toBe(2);
    fireEvent.click(minis[1]);
    expect(called).toBe(1);
    expect(container.querySelector('.native-fab-mini'), 'collapsed after').toBeNull();
    rerender(<NativeFab hidden onQuickLog={() => { called += 1; }} />);
    expect(container.querySelector('.native-fab-wrap'), 'hidden').toBeNull();
  });

  it('NativeFab: вода +250 уходит в очередь виджета', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { container } = render(<NativeFab />);
    fireEvent.click(container.querySelector('.native-fab')!);
    const minis = container.querySelectorAll('.native-fab-mini');
    fireEvent.click(minis[0]);
    await waitFor(() => {
      const raw = localStorage.getItem('he_widget_fallback_queue') || '[]';
      const q = JSON.parse(raw) as { type?: string; ml?: number }[];
      expect(q.some((e) => e.type === 'water' && e.ml === 250), 'water queued').toBe(true);
    });
  });

  it('CSS-изоляция: каждый селектор native-слоёв — только html.app-native', () => {
    for (const name of ['styles-native.css', 'styles-native-pro.css']) {
      const css = readCss(name);
      const bad: string[] = [];
      for (const rawLine of css.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) continue;
        if (!line.endsWith('{')) continue;
        const sel = line.slice(0, -1).trim();
        if (!sel) continue;
        if (sel.startsWith('@')) continue; // @media/@keyframes/@supports
        if (sel.startsWith('from') || sel.startsWith('to')) continue;
        // Групповые селекторы через запятую могут переноситься — проверяем каждую часть.
        const parts = sel.split(',').map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          if (p.startsWith('html.app-native')) continue;
          if (p.startsWith('@')) continue;
          bad.push(`${name}: ${p}`);
        }
      }
      expect(bad, `${name} без префикса`).toEqual([]);
    }
  });

  it('TOP-хуки на месте: FAB, бейджи, темы, bg-cover, hero intact', () => {
    const css = readCss('styles-native.css');
    expect(css).toContain('.native-fab');
    expect(css).toContain('[data-badge]');
    expect(css).toContain("data-apk-theme='light'");
    expect(css).toContain("data-apk-theme='amoled'");
    expect(css).toContain("img[src*='bg-profile']");
    // Hero-подача существует, но ни одно правило не прячет hero (остаются).
    expect(css).toContain('.hero-fullscreen-img');
    expect(css).toContain('.native-home-bg img');
    const heroHides = css
      .split('\n')
      .filter(
        (l) =>
          (l.includes('hero-fullscreen-img') || l.includes('native-home-bg img')) &&
          l.replace(/\s/g, '').includes('display:none'),
      );
    expect(heroHides, 'hero hidden').toEqual([]);
  });

  it('accent: дефолт лайм, персист, DOM вне native не трогается', () => {
    expect(getApkAccent()).toBe('');
    setApkAccent('sky');
    expect(getApkAccent()).toBe('sky');
    expect(document.documentElement.getAttribute('data-apk-accent')).toBeNull();
    setApkAccent('nope' as never);
    expect(getApkAccent()).toBe('');
    setApkAccent('');
    expect(getApkAccent()).toBe('');
  });

  it('dynamic color: слой var-изирован (hex только в определениях)', () => {
    const css = readCss('styles-native.css');
    const hexLeft = css.split('\n').filter((l) => /#c9f73a|#00e68a/i.test(l));
    // Только определения переменных (база + палитра mint), остальное на var().
    expect(hexLeft.length).toBeGreaterThan(0);
    for (const l of hexLeft) expect(l.trimStart().startsWith('--accent'), l).toBe(true);
    expect(css).toContain("data-apk-accent='sky'");
    expect(css).toContain("data-apk-accent='violet'");
    expect(css).toContain("data-apk-accent='amber'");
    expect(css).toContain("data-apk-accent='mint'");
    expect(css).toContain('--accent-rgb');
  });

  it('HeroImg: picture + webp-source, img-атрибуты 1-в-1 (тесты экранов целы)', () => {
    const { container } = render(
      <div className="training-hero">
        <HeroImg
          webp="/training-hero.webp"
          src="/training-hero.jpg"
          alt=""
          className="hero-fullscreen-img"
        />
      </div>,
    );
    const pic = container.querySelector('picture');
    expect(pic, 'picture').not.toBeNull();
    const source = container.querySelector('source[type="image/webp"]');
    expect(source?.getAttribute('srcset')).toBe('/training-hero.webp');
    const img = container.querySelector('.training-hero img');
    expect(img?.getAttribute('src')).toBe('/training-hero.jpg');
    expect(img?.getAttribute('class')).toContain('hero-fullscreen-img');
  });

  it('HeroImg: webp-дериваты лежат рядом с исходниками и меньше их', () => {
    const pairs: [string, string][] = [
      ['hero-main.png', 'hero-main.webp'],
      ['training-hero.jpg', 'training-hero.webp'],
      ['bg-profile.png', 'bg-profile.webp'],
      ['risk-hero.png', 'risk-hero.webp'],
    ];
    for (const [orig, webp] of pairs) {
      const o = path.join(process.cwd(), 'public', orig);
      const w = path.join(process.cwd(), 'public', webp);
      expect(fs.existsSync(w), webp).toBe(true);
      expect(fs.statSync(w).size).toBeLessThan(fs.statSync(o).size);
    }
  });

  it('inline-TSX: NativeEmpty красится переменными, не hex', () => {
    const { container } = render(<NativeEmpty title="Пусто" />);
    const html = container.innerHTML;
    expect(html).not.toContain('#c9f73a');
    expect(html).toContain('var(--accent)');
    expect(container.querySelector('.native-empty-title')?.textContent).toBe('Пусто');
  });

  it('system accent: hex/contrast/write/clear + персист выбора', () => {
    expect(hexToRgbTriplet('#c9f73a')).toBe('201, 247, 58');
    expect(hexToRgbTriplet('#00e68a')).toBe('0, 230, 138');
    expect(hexToRgbTriplet('мусор')).toBeNull();
    expect(hexToRgbTriplet('#fff')).toBeNull();
    expect(contrastForHex('#c9f73a')).toBe('#0b1526');
    expect(contrastForHex('#0b1526')).toBe('#f4f7ff');
    expect(writeSystemVars('#8b5cf6', '#22d3ee')).toBe(true);
    const st = document.documentElement.style;
    expect(st.getPropertyValue('--accent')).toBe('#8b5cf6');
    expect(st.getPropertyValue('--accent-rgb')).toBe('139, 92, 246');
    expect(writeSystemVars('nope', '#fff')).toBe(false);
    clearSystemVars();
    expect(st.getPropertyValue('--accent')).toBe('');
    setApkAccent('system');
    expect(getApkAccent()).toBe('system');
    setApkAccent('');
  });

  it('system accent: вне native устройство недоступно (false, без краша)', async () => {
    await expect(applySystemAccentFromDevice()).resolves.toBe(false);
  });

  it('AppearanceSetupCard: темы + 6 акцентов, системный честно сообщает о недоступности', async () => {
    const { getByRole, findByText } = render(<AppearanceSetupCard />);
    expect(getByRole('radiogroup', { name: 'Тема' })).not.toBeNull();
    const accents = getByRole('radiogroup', { name: 'Акцент' });
    expect(accents.querySelectorAll('[role="radio"]').length).toBe(6);
    fireEvent.click(getByRole('radio', { name: /Системный/ }));
    await findByText(/Android 12\+/);
  });

  it('NativeOfflinePill: в сети пусто, офлайн — пилюля', async () => {
    const { act } = await import('@testing-library/react');
    let cb: ((online: boolean) => void) | null = null;
    (watchOnline as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      (c: (online: boolean) => void) => {
        cb = c;
        return () => {};
      },
    );
    const { container, unmount } = render(<NativeOfflinePill />);
    expect(container.querySelector('.native-offline'), 'online').toBeNull();
    await act(async () => {
      cb?.(false);
    });
    expect(container.querySelector('.native-offline')?.textContent).toContain('Офлайн');
    await act(async () => {
      cb?.(true);
    });
    expect(container.querySelector('.native-offline'), 'back online').toBeNull();
    unmount();
    expect(isOnline).toBeDefined();
  });

  it('QS Tile воды: манифест + строки + иконка + Java-логика связаны', () => {
    const and = (p: string) =>
      fs.readFileSync(path.join(process.cwd(), p), 'utf-8');
    const manifest = and('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('.WaterTileService');
    expect(manifest).toContain('android.service.quicksettings.action.QS_TILE');
    expect(manifest).toContain('BIND_QUICK_SETTINGS_TILE');
    const strings = and('android/app/src/main/res/values/strings.xml');
    expect(strings).toContain('tile_water_label');
    const java = and('android/app/src/main/java/com/healthengine/app/WaterTileService.java');
    expect(java).toContain('WidgetStore.enqueue');
    expect(java).toContain('NutritionWidgetProvider.updateAll');
    expect(java).toContain('"water"');
    expect(
      fs.existsSync(path.join(process.cwd(), 'android/app/src/main/res/drawable/ic_stat_icon_default.xml')),
      'qs icon',
    ).toBe(true);
  });

  it('nav-badges: пусто без данных, highCount → бейдж, кап 99+', () => {
    expect(getNavBadges()).toEqual({ support: '' });
    try {
      localStorage.setItem('he_drug_warnings', JSON.stringify({ count: 2, highCount: 3, warnings: [] }));
    } catch {}
    expect(getNavBadges()).toEqual({ support: '3' });
    try {
      localStorage.setItem('he_drug_warnings', JSON.stringify({ count: 1, highCount: 150, warnings: [] }));
    } catch {}
    expect(getNavBadges()).toEqual({ support: '99+' });
    try {
      localStorage.setItem('he_drug_warnings', 'not-json{{{');
    } catch {}
    expect(getNavBadges()).toEqual({ support: '' });
  });
});
