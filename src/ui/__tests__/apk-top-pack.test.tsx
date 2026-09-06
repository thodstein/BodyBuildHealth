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
import { getNavBadges, profileCompleteness } from '../native/nav-badges';
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

  it('initApkAppearance: снимает boot-override после гидрации', () => {
    document.documentElement.setAttribute('data-boot-theme', 'light');
    document.documentElement.style.setProperty('--boot-spin', '#38bdf8');
    initApkAppearance();
    expect(document.documentElement.getAttribute('data-boot-theme')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--boot-spin')).toBe('');
  });

  it('themeMetaColor: recent-apps 1-в-1 с фоном темы', () => {
    expect(themeMetaColor('')).toBe('#050b16');
    expect(themeMetaColor('amoled')).toBe('#000000');
    expect(themeMetaColor('light')).toBe('#eef2f6');
  });

  it('boot anti-flash: index.html красит static-заглушку только по APK-ключам', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
    // Ключи, без которых скрипт — no-op (в TG их нет).
    expect(html).toContain('he_apk_theme_v1');
    expect(html).toContain('he_apk_accent_v1');
    expect(html).toContain('he_apk_system_hex_v1');
    // Переопределения заге́йчены boot-атрибутом (в TG не матчится никогда).
    expect(html).toContain("html[data-boot-theme='light']");
    expect(html).toContain('--boot-spin');
    // Валидация hex перед применением (без saнитизации — без инъекций).
    expect(html).toContain('/^#[0-9a-fA-F]{6}$/');
  });

  it('accent-color: нативные контролы следуют за акцентом', () => {
    const css = readCss('styles-native.css');
    expect(css).toContain('accent-color: var(--accent)');
  });

  it('NativeFab speed-dial: тап раскрывает, тренинг ведёт в дневник', () => {
    let called = 0;
    const { container, rerender } = render(<NativeFab onQuickLog={() => { called += 1; }} />);
    const btn = container.querySelector('.native-fab');
    expect(btn, 'fab').not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('Быстрые действия');
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

  it('волна 19: FAB-мини — штриховые SVG без эмодзи', async () => {
    const { container } = render(<NativeFab />);
    fireEvent.click(container.querySelector('.native-fab')!);
    const minis = container.querySelectorAll('.native-fab-mini');
    expect(minis.length).toBe(2);
    for (const m of Array.from(minis)) {
      const svg = m.querySelector('svg');
      expect(svg, m.getAttribute('aria-label')).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(m.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('волна 23: мобильная посадка — safe-area сверху, скролл hero', () => {
    const css = readCss('styles-native.css');
    const i = css.indexOf('73. MOBILE FIT');
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i, i + 4000);
    for (const sel of [
      '.training-hero',
      '.labs-hero',
      '.risk-hero',
      '.nutrition-hero',
      '.native-home-landing',
      '.labs-topnav',
      '.risk-topnav',
      '.nutrition-tabs-head',
      '.support-topbar',
    ]) {
      expect(block, sel).toContain(sel);
    }
    expect(block).toContain('safe-area-inset-top');
    expect(block).toContain('overflow-y: auto');
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

  it('волна 24: низы не под пилюлей — safe-area снизу', () => {
    const css = readCss('styles-native.css');
    const i = css.indexOf('74. BOTTOM FIT');
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i, i + 3000);
    for (const sel of [
      '.screen.gamification',
      '.screen.fertility-pct',
      '.rep-screen',
      '.sup-clinic',
      '.toast-container',
    ]) {
      expect(block, sel).toContain(sel);
    }
    expect(block).toContain('safe-area-inset-bottom');
    expect(block).toContain('var(--nav-height)');
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

  it('WCAG: контрасты тем и акцентов держат AA (замер по токенам)', () => {
    const css = readCss('styles-native.css');
    // Достаём блок `selector { ... }` без вложенностей (токены — плоские).
    const block = (sel: string): string => {
      const i = css.indexOf(sel);
      if (i < 0) throw new Error(`no block ${sel}`);
      const open = css.indexOf('{', i);
      const close = css.indexOf('}', open);
      return css.slice(open + 1, close);
    };
    const vars = (body: string): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
      return out;
    };
    const hex = (h: string): [number, number, number] => {
      const n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const chan = (c: number) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const lum = (c: [number, number, number]) =>
      0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
    const ratio = (a: [number, number, number], b: [number, number, number]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // Цвет токена: #hex | rgba(r,g,b,a) | rgba(var(--x-rgb), a) поверх фона.
    const paint = (
      v: Record<string, string>,
      name: string,
      bg: [number, number, number],
    ): [number, number, number] => {
      const raw = v[name];
      const mHex = /^#([0-9a-fA-F]{6})$/.exec(raw);
      if (mHex) return hex(raw);
      const mRgba = /^rgba\(\s*(.+?)\s*,\s*([0-9.]+)\s*\)$/.exec(raw);
      if (!mRgba) throw new Error(`unparsed ${name} = ${raw}`);
      let trip: [number, number, number];
      const vm = /^var\(--([\w-]+)\)$/.exec(mRgba[1]);
      if (vm) {
        trip = (v[vm[1]] || vars(block('html.app-native'))[vm[1]])
          .split(',')
          .map((s) => Number(s.trim())) as [number, number, number];
      } else {
        trip = mRgba[1].split(',').map((s) => Number(s.trim())) as [number, number, number];
      }
      const a = Number(mRgba[2]);
      return trip.map((c, i) => Math.round(c * a + bg[i] * (1 - a))) as [number, number, number];
    };

    const navy: [number, number, number] = [5, 11, 22];
    const paper: [number, number, number] = [238, 242, 246];
    const base = vars(block('html.app-native'));
    // Тёмная тема: текст 7+, остальное 4.5+.
    expect(ratio(paint(base, 'text', navy), navy)).toBeGreaterThanOrEqual(7);
    expect(ratio(paint(base, 'text-dim', navy), navy)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(paint(base, 'text-faint', navy), navy)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(paint(base, 'accent-contrast', navy), paint(base, 'accent', navy))).toBeGreaterThanOrEqual(4.5);
    // Все акценты читаются на navy и несут свой контраст.
    for (const id of ['mint', 'sky', 'violet', 'amber']) {
      const a = { ...base, ...vars(block(`html.app-native[data-apk-accent='${id}']`)) };
      expect(ratio(paint(a, 'accent', navy), navy), id).toBeGreaterThanOrEqual(4.5);
      expect(ratio(paint(a, 'accent-contrast', navy), paint(a, 'accent', navy)), id).toBeGreaterThanOrEqual(4.5);
    }
    // Светлая тема: текст 7+, dim/акценты 4.5+.
    const light = { ...base, ...vars(block("html.app-native[data-apk-theme='light']")) };
    expect(ratio(paint(light, 'text', paper), paper)).toBeGreaterThanOrEqual(7);
    expect(ratio(paint(light, 'text-dim', paper), paper)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(paint(light, 'accent', paper), paper)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(paint(light, 'accent-2', paper), paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('EN: FAB, офлайн-пилюля и системный чип по-английски', async () => {
    const { setLocale } = await import('../../data/interactions-labels');
    const { act } = await import('@testing-library/react');
    setLocale('en');
    try {
      const fab = render(<NativeFab />);
      fireEvent.click(fab.container.querySelector('.native-fab')!);
      expect(
        fab.container.querySelector('.native-fab')?.getAttribute('aria-label'),
      ).toBe('Quick actions');
      expect(
        fab.container.querySelectorAll('.native-fab-mini')[0]?.getAttribute('aria-label'),
      ).toBe('Log 250 ml of water');
      fab.unmount();
      let cb: ((online: boolean) => void) | null = null;
      (watchOnline as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
        (c: (online: boolean) => void) => {
          cb = c;
          return () => {};
        },
      );
      const pill = render(<NativeOfflinePill />);
      await act(async () => {
        cb?.(false);
      });
      expect(pill.container.querySelector('.native-offline')?.textContent).toContain('Offline');
      pill.unmount();
    } finally {
      setLocale('ru');
    }
  });

  it('NativeFab: Escape закрывает меню', () => {
    const { container } = render(<NativeFab />);
    fireEvent.click(container.querySelector('.native-fab')!);
    expect(container.querySelector('.native-fab-mini')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('.native-fab-mini')).toBeNull();
  });

  it('NativeOfflinePill: показывает размер очереди', async () => {
    const { act } = await import('@testing-library/react');
    try {
      localStorage.setItem(
        'he_widget_fallback_queue',
        JSON.stringify([
          { type: 'water', ml: 250, ts: 1 },
          { type: 'water', ml: 250, ts: 2 },
        ]),
      );
    } catch {}
    let cb: ((online: boolean) => void) | null = null;
    (watchOnline as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      (c: (online: boolean) => void) => {
        cb = c;
        return () => {};
      },
    );
    const { container, unmount } = render(<NativeOfflinePill />);
    await act(async () => {
      cb?.(false);
    });
    expect(container.querySelector('.native-offline')?.textContent).toContain('2');
    unmount();
  });

  it('nav-badges: пусто без данных, highCount → бейдж, кап 99+', () => {
    // Дефолтный профиль уже даёт ≥ 50% — дот не горит без повода.
    expect(getNavBadges()).toEqual({ support: '', profile: '' });
    try {
      localStorage.setItem('he_drug_warnings', JSON.stringify({ count: 2, highCount: 3, warnings: [] }));
    } catch {}
    expect(getNavBadges()).toEqual({ support: '3', profile: '' });
    try {
      localStorage.setItem('he_drug_warnings', JSON.stringify({ count: 1, highCount: 150, warnings: [] }));
    } catch {}
    expect(getNavBadges()).toEqual({ support: '99+', profile: '' });
    try {
      localStorage.setItem('he_drug_warnings', 'not-json{{{');
    } catch {}
    expect(getNavBadges()).toEqual({ support: '', profile: '' });
  });

  it('nav-badges: дот профиля гаснет на заполненности ≥ 50%', () => {
    expect(profileCompleteness(null)).toBe(0);
    expect(profileCompleteness({})).toBe(0);
    const full = {
      personal: { age: 30, sex: 'male', height: 180, weight: 80 },
      training: { primaryGoal: 'bulk', level: 'intermediate', daysPerWeek: 4 },
      lifestyle: { sleepHours: 8, stressLevel: 3 },
      health: { bpStage: 'normal' },
      nutrition: { dietType: 'omni', proteinPerKg: 2 },
      goals: { primaryGoal: 'bulk' },
    };
    expect(profileCompleteness(full)).toBe(100);
    // 7/13 = 54%: граница гаснущего дота.
    const half = {
      personal: { age: 30, sex: 'male', height: 180, weight: 80 },
      training: { primaryGoal: 'bulk', level: 'intermediate', daysPerWeek: 4 },
    };
    expect(profileCompleteness(half)).toBeGreaterThanOrEqual(50);
  });

  it('nav-badges: разреженный профиль зажигает дот, полный — гасит', () => {
    try {
      localStorage.setItem(
        'he_profile_v2',
        JSON.stringify({ settings: { personal: { age: 30 } } }),
      );
    } catch {}
    expect(getNavBadges().profile).toBe('!');
    try {
      localStorage.setItem(
        'he_profile_v2',
        JSON.stringify({
          settings: {
            personal: { age: 30, sex: 'male', height: 180, weight: 80 },
            training: { primaryGoal: 'bulk', level: 'intermediate', daysPerWeek: 4 },
            lifestyle: { sleepHours: 8, stressLevel: 3 },
            health: { bpStage: 'normal' },
            nutrition: { dietType: 'omni', proteinPerKg: 2 },
            goals: { primaryGoal: 'bulk' },
          },
        }),
      );
    } catch {}
    expect(getNavBadges().profile).toBe('');
  });
});
