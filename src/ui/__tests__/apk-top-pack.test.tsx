/**
 * apk-top-pack.test.tsx — TOP-оформление APK: темы, FAB, TG-изоляция CSS.
 * Hero-картинки не меняются — здесь проверяется только подача поверх.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';

// native-bridge тянет TG/Web-цепочку с CSS — для FAB мокаем только haptics.
vi.mock('../../core/native-bridge', () => ({ haptics: vi.fn() }));
import { NativeFab } from '../native/NativeFab';
// ВНИМАНИЕ: CSS читаем через process.cwd(), а НЕ через new URL(*.css,
// import.meta.url) — Vite считает такую конструкцию ассетом и падает
// на CSS-модулях (?url is not supported with CSS modules).
import {
  getApkTheme,
  setApkTheme,
  applyApkTheme,
  initApkAppearance,
} from '../native/appearance';

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
    } catch {}
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
    try {
      document.documentElement.removeAttribute('data-apk-theme');
    } catch {}
  });

  it('appearance: дефолт пустой, set/apply персистят, вне native DOM не трогается', () => {
    expect(getApkTheme()).toBe('');
    // В jsdom нет Capacitor → applyApkTheme обязан быть no-op для DOM…
    applyApkTheme('amoled');
    // …но персист через setApkTheme работает везде (для будущего native-запуска).
    setApkTheme('light');
    expect(getApkTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-apk-theme')).toBeNull();
    setApkTheme('');
    expect(getApkTheme()).toBe('');
    expect(initApkAppearance()).toBe('');
  });

  it('NativeFab: рендер, hidden, клик ведёт в дневник', () => {
    let called = 0;
    const { container, rerender } = render(<NativeFab onQuickLog={() => { called += 1; }} />);
    const btn = container.querySelector('.native-fab');
    expect(btn, 'fab').not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toContain('Быстрая запись');
    fireEvent.click(btn!);
    expect(called).toBe(1);
    rerender(<NativeFab hidden onQuickLog={() => { called += 1; }} />);
    expect(container.querySelector('.native-fab'), 'hidden').toBeNull();
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
});
