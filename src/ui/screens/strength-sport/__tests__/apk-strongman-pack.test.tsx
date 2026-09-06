/**
 * apk-strongman-pack.test.tsx — APK PRO-оформление стронг-планировщика.
 *
 * Инварианты (паритет с apk-arm-pack):
 *  - каждый селектор styles-native-strongman.css начинается с html.app-native
 *    (TG Mini App и web не затрагиваются вообще);
 *  - hex-литералов нет (только var()/rgb — акцент и темы подхватываются);
 *  - hero не прячется;
 *  - в TG/web рендер Байт-в-байт прежний (корень train-strong без ss-apk,
 *    загрузчик CSS — no-op), в native — класс ss-apk + загрузка стилей.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';
import { ensureStrongmanApkStyles, resetStrongmanApkStylesForTest } from '../strongman-apk-loader';
import { resetAppPlatformCache } from '../../../../core/app-platform';

function readStrongmanCss(): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native-strongman.css'), 'utf-8');
}

function splitTopLevel(sel: string): string[] {
  // Делим только по запятым верхнего уровня: rgb(10, 22, 41) внутри
  // селектора делить нельзя (иначе ложные срабатывания изоляции).
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

describe('APK strongman pack', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    resetAppPlatformCache();
    resetStrongmanApkStylesForTest();
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
    resetStrongmanApkStylesForTest();
  });

  it('CSS-изоляция: каждый селектор — только html.app-native', () => {
    expect(selectorProblems(readStrongmanCss())).toEqual([]);
  });

  it('без hex-литералов: только var()/rgb (темы и акцент — бесплатно)', () => {
    const css = readStrongmanCss();
    const hexHits = css.split('\n').filter((l) => /#[0-9a-fA-F]{3}\b/.test(l));
    expect(hexHits).toEqual([]);
  });

  it('хуки слоя на месте: корень, hero, шаги, сплит, попапы', () => {
    const css = readStrongmanCss();
    for (const hook of [
      '.train-strong.ss-apk',
      "[data-ss='hero']",
      "[data-ss='steps']",
      "[data-ss='msg']",
      "[data-ss='section']",
      "[data-ss='split-list']",
      "[data-ss='presets']",
      "[data-ss='contest']",
      "[data-ss='attempts']",
      "[data-ss='exports']",
      "[data-ss='week']",
      "[data-ss='exercise']",
      "[data-ss='set-row']",
      "[data-ss='gantt']",
      "[data-ss='heatmap']",
      "[data-ss='medley']",
      '.ss-apk-backdrop',
      '.ss-apk-sheet',
      '.ss-apk-done',
      'ssApkSheetUp',
      'prefers-reduced-motion',
    ]) {
      expect(css, hook).toContain(hook);
    }
    const heroHides = css
      .split('\n')
      .filter(
        (l) =>
          (l.includes('hero-fullscreen-img') || l.includes('native-home-bg')) &&
          l.replace(/\s/g, '').includes('display:none'),
      );
    expect(heroHides).toEqual([]);
  });

  it('TG/web 1-в-1: корень без ss-apk, загрузчик — no-op', () => {
    expect(ensureStrongmanApkStyles()).toBe(false);
    const { container } = render(<StrengthSportConstructor />);
    const root = container.querySelector('.train-strong');
    expect(root, 'root').not.toBeNull();
    expect(root?.classList.contains('ss-apk'), 'no apk class in TG').toBe(false);
    expect(root?.getAttribute('class')).toBe('train-strong');
    expect(container.querySelector("[data-ss='hero']"), 'hero hook').not.toBeNull();
    expect(container.querySelector("[data-ss='steps']"), 'steps hook').not.toBeNull();
    expect(container.querySelector("[data-ss='split-list']")).toBeNull();
  });

  it('native: корень ss-apk, загрузчик запускает импорт', () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    resetAppPlatformCache();
    expect(ensureStrongmanApkStyles()).toBe(true);
    const { container } = render(<StrengthSportConstructor />);
    const root = container.querySelector('.train-strong');
    expect(root?.classList.contains('ss-apk'), 'apk class in native').toBe(true);
  });
});
