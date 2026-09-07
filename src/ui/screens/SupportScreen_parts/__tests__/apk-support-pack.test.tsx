/**
 * apk-support-pack.test.tsx — APK PRO-оформление вкладки «БАДы».
 *
 * Инварианты (паритет с apk-arm-pack / apk-strongman-pack):
 *  - каждый селектор styles-native-support.css начинается с html.app-native
 *    (TG Mini App и web не затрагиваются вообще);
 *  - hex-литералов нет (только var()/rgb — акцент и темы подхватываются);
 *  - hero не прячется и не перестилируется;
 *  - в TG/web загрузчик CSS — no-op, корень без sup-apk;
 *    в native — класс sup-apk + загрузка стилей.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { SupportScreen } from '../../SupportScreen';
import { ensureSupportApkStyles, resetSupportApkStylesForTest } from '../support-apk-loader';
import { resetAppPlatformCache } from '../../../../core/app-platform';

function readSupportCss(): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native-support.css'), 'utf-8');
}

function readSupportDesignCss(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src', 'ui', 'screens', 'SupportScreen_parts', 'support-design.css'),
    'utf-8',
  );
}

function splitTopLevel(sel: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (const ch of sel) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function selectorProblems(css: string): string[] {
  const bad: string[] = [];
  for (const rawLine of css.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) continue;
    if (!line.endsWith('{')) continue;
    const sel = line.slice(0, -1).trim();
    if (!sel) continue;
    if (sel.startsWith('@')) continue;
    if (sel.startsWith('from') || sel.startsWith('to')) continue;
    for (const p of splitTopLevel(sel).map((s) => s.trim()).filter(Boolean)) {
      if (p.startsWith('html.app-native')) continue;
      if (p.startsWith('@')) continue;
      bad.push(p);
    }
  }
  return bad;
}

describe('APK support pack', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    resetAppPlatformCache();
    resetSupportApkStylesForTest();
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
    try {
      delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    } catch {}
    resetAppPlatformCache();
    resetSupportApkStylesForTest();
  });

  it('CSS-изоляция: каждый селектор — только html.app-native', () => {
    expect(selectorProblems(readSupportCss())).toEqual([]);
  });

  it('без hex-литералов: только var()/rgb (темы и акцент — бесплатно)', () => {
    const css = readSupportCss();
    const hexHits = css.split('\n').filter((l) => /#[0-9a-fA-F]{3}\b/.test(l));
    expect(hexHits).toEqual([]);
  });

  it('хуки слоя на месте: корень, нав, топбар, контент, попапы', () => {
    const css = readSupportCss();
    for (const hook of [
      '.train-sup.sup-apk',
      "[data-sup='nav']",
      "[data-sup='topbar']",
      "[data-sup='pills']",
      "[data-sup='content']",
      "[data-sup='catalog']",
      "[data-sup='protocols']",
      "[data-sup='calc']",
      "[data-sup='stacks']",
      "[data-sup='diary']",
      "[data-sup='research']",
      '.sup-apk-backdrop',
      '.sup-apk-sheet',
      '.sup-apk-done',
      'supApkSheetUp',
      'prefers-reduced-motion',
    ]) {
      expect(css, hook).toContain(hook);
    }
    const heroHides = css
      .split('\n')
      .filter(
        (l) =>
          (l.includes('support-hero') || l.includes('native-home-bg')) &&
          l.replace(/\s/g, '').includes('display:none'),
      );
    expect(heroHides).toEqual([]);
  });

  it('дизайн-кит не трогает hero и scoped на support-screen', () => {
    const css = readSupportDesignCss();
    expect(css).not.toMatch(/\.support-hero\s*\{/);
    expect(css).not.toMatch(/\.support-hero-[a-z]+\s*\{/);
    for (const rawLine of css.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) continue;
      if (!line.endsWith('{')) continue;
      const sel = line.slice(0, -1).trim();
      if (!sel || sel.startsWith('@')) continue;
      if (sel.startsWith('from') || sel.startsWith('to')) continue;
      for (const p of splitTopLevel(sel).map((s) => s.trim()).filter(Boolean)) {
        expect(p.startsWith('.support-screen'), p).toBe(true);
      }
    }
  });

  it('TG/web 1-в-1: загрузчик — no-op, корень без sup-apk, хуки по навигации', () => {
    expect(ensureSupportApkStyles()).toBe(false);
    const { container } = render(<SupportScreen />);
    const root = container.querySelector('.support-screen');
    expect(root, 'root').not.toBeNull();
    expect(root?.classList.contains('sup-apk'), 'no apk class in TG').toBe(false);
    expect(root?.classList.contains('train-sup'), 'design hook').toBe(true);
    expect(root?.getAttribute('data-sup'), 'root hook').toBe('root');
    // hero цел — навигация стартует с него
    expect(container.querySelector('.support-hero'), 'hero intact').not.toBeNull();
    // переход в протоколы — топбар и контент-хуки на месте
    const proto = container.querySelector('.support-hero-card[data-key="protocols"]') as HTMLElement;
    expect(proto, 'protocols hero card').not.toBeNull();
    fireEvent.click(proto);
    expect(container.querySelector("[data-sup='protocols']"), 'protocols hook').not.toBeNull();
    expect(container.querySelector("[data-sup='topbar']"), 'topbar hook').not.toBeNull();
  });

  it('native: корень sup-apk, загрузчик запускает импорт', () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    resetAppPlatformCache();
    expect(ensureSupportApkStyles()).toBe(true);
    const { container } = render(<SupportScreen />);
    const root = container.querySelector('.support-screen');
    expect(root?.classList.contains('sup-apk'), 'apk class in native').toBe(true);
  });

  it('Гормоны: таб fertility-pct рендерит раздел, а не пустой экран', () => {
    const { container } = render(<SupportScreen initialTab="fertility-pct" />);
    expect(container.querySelector("[data-sup='hormones']"), 'hormones hook').not.toBeNull();
    expect(
      container.querySelector("[data-sup='hormones'] .screen.fertility-pct"),
      'fertility screen',
    ).not.toBeNull();
  });
});
