/**
 * apk-arm-pack.test.tsx — APK PRO-оформление арм-планировщика.
 *
 * Инварианты (паритет с apk-top-pack):
 *  - каждый селектор styles-native-arm.css начинается с html.app-native
 *    (TG Mini App и web не затрагиваются вообще);
 *  - hex-литералов нет (только var()/rgb — акцент и темы подхватываются);
 *  - hero не прячется;
 *  - в TG/web рендер Байт-в-байт прежний (корень train-arm без arm-apk,
 *    загрузчик CSS — no-op), в native — класс arm-apk + загрузка стилей.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';
import { ensureArmApkStyles, resetArmApkStylesForTest } from '../arm-apk-loader';
import { resetAppPlatformCache } from '../../../../core/app-platform';

function readArmCss(): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native-arm.css'), 'utf-8');
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

describe('APK arm pack', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    resetAppPlatformCache();
    resetArmApkStylesForTest();
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
    resetArmApkStylesForTest();
  });

  it('CSS-изоляция: каждый селектор — только html.app-native', () => {
    expect(selectorProblems(readArmCss())).toEqual([]);
  });

  it('без hex-литералов: только var()/rgb (темы и акцент — бесплатно)', () => {
    const css = readArmCss();
    const hexHits = css.split('\n').filter((l) => /#[0-9a-fA-F]{3}\b/.test(l));
    expect(hexHits).toEqual([]);
  });

  it('хуки слоя на месте: корень, шаги, сплит, недели, попапы', () => {
    const css = readArmCss();
    for (const hook of [
      '.train-arm.arm-apk',
      "[data-arm='steps']",
      "[data-arm='msg']",
      "[data-arm='split-list']",
      "[data-arm='week-pills']",
      '.train-armtech',
      '.train-armgrip',
      '.train-armheatmap',
      '.train-armdiag.arm-apk',
      "[data-arm='hub-head']",
      "[data-arm='hub-tabs']",
      '.arm-apk-backdrop',
      '.arm-apk-sheet',
      '.arm-apk-toast',
      'armApkSheetUp',
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

  it('TG/web 1-в-1: корень без arm-apk, загрузчик — no-op', () => {
    expect(ensureArmApkStyles()).toBe(false);
    const { container } = render(<ArmAutoConstructor />);
    const root = container.querySelector('.train-arm');
    expect(root, 'root').not.toBeNull();
    expect(root?.classList.contains('arm-apk'), 'no apk class in TG').toBe(false);
    expect(root?.getAttribute('class')).toBe('train-arm');
    expect(container.querySelector("[data-arm='steps']"), 'steps hook').not.toBeNull();
    expect(container.querySelector("[data-arm='split-list']")).toBeNull();
  });

  it('legacy-navy боксы сериализуются в rgb — CSS-хук их накрывает', () => {
    const { container } = render(<ArmAutoConstructor />);
    const boxes = Array.from(container.querySelectorAll('div[style]')).filter((d) =>
      (d.getAttribute('style') || '').includes('rgb(10, 22, 41)'),
    );
    expect(boxes.length, 'navy boxes matched by CSS hook').toBeGreaterThan(0);
  });

  it('native: корень arm-apk, загрузчик запускает импорт', () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    resetAppPlatformCache();
    expect(ensureArmApkStyles()).toBe(true);
    const { container } = render(<ArmAutoConstructor />);
    const root = container.querySelector('.train-arm');
    expect(root?.classList.contains('arm-apk'), 'apk class in native').toBe(true);
  });

  it('хаб TG 1-в-1: корень без arm-apk, табы-хук на месте', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    const root = container.querySelector('.train-armdiag');
    expect(root, 'hub root').not.toBeNull();
    expect(root?.getAttribute('class')).toBe('train-armdiag');
    expect(container.querySelector("[data-arm='hub-head']"), 'hub head').not.toBeNull();
    expect(container.querySelector("[data-arm='hub-tabs']"), 'hub tabs').not.toBeNull();
  });

  it('хаб native: корень arm-apk', () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    resetAppPlatformCache();
    const { container } = render(<ArmDiagnosticsHub />);
    const root = container.querySelector('.train-armdiag');
    expect(root?.classList.contains('arm-apk'), 'hub apk class in native').toBe(true);
  });

  it('весь конструктор: 6 шагов рендерятся без падений (TG)', () => {
    render(<ArmAutoConstructor />);
    const steps: Array<[string, RegExp]> = [
      ['🎛 Параметры', /Рабочие максимумы/],
      ['✊ Хват', /Хват — диагностика/],
      ['🗓 Сплит', /Выбор сплита/],
      ['📋 План', /План не собран/],
      ['📊 Качество', /Сначала собери план/],
      ['🏋️ Веса', /Веса — детали/],
    ];
    for (const [tab, marker] of steps) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      expect(document.body.textContent, tab).toMatch(marker);
    }
    expect(document.querySelector('.train-arm')?.getAttribute('class')).toBe('train-arm');
  });

  it('весь хаб: 5 табов переключаются без падений (TG)', () => {
    render(<ArmDiagnosticsHub />);
    for (const name of [/✊ Хват/, /Кисть\/Ротация/, /Давление/, /⚡ Сила/, /Сухожилие/]) {
      const btn = screen.getByRole('button', { name });
      fireEvent.click(btn);
      expect(btn.getAttribute('aria-pressed'), String(name)).toBe('true');
    }
    expect(document.querySelector("[data-arm='hub-head']"), 'hub head alive').not.toBeNull();
  });

  it('весь планировщик в native: класс arm-apk держится на всех шагах и табах', () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    resetAppPlatformCache();
    const c = render(<ArmAutoConstructor />);
    for (const tab of ['🎛 Параметры', '✊ Хват', '🗓 Сплит', '📋 План', '📊 Качество', '🏋️ Веса']) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      expect(c.container.querySelector('.train-arm')?.classList.contains('arm-apk'), tab).toBe(true);
    }
    c.unmount();
    cleanup();
    const h = render(<ArmDiagnosticsHub />);
    for (const name of [/✊ Хват/, /Кисть\/Ротация/, /Давление/, /⚡ Сила/, /Сухожилие/]) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(h.container.querySelector('.train-armdiag')?.classList.contains('arm-apk'), String(name)).toBe(true);
    }
  });
});
