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
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';
import { ensureArmApkStyles, resetArmApkStylesForTest } from '../arm-apk-loader';
import { resetAppPlatformCache } from '../../../../core/app-platform';

function readArmCss(): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native-arm.css'), 'utf-8');
}

function readBaseCss(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-design.css'),
    'utf-8',
  );
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

  it('базовый CSS не утекает: каждый селектор — :is(.train-arm…)', () => {
    const css = readBaseCss();
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
        if (p.startsWith('@')) continue;
        if (/^:is\(\.train-arm/.test(p)) continue;
        bad.push(p);
      }
    }
    expect(bad).toEqual([]);
  });

  it('без hex-литералов: только var()/rgb (темы и акцент — бесплатно)', () => {
    const css = readArmCss();
    const hexHits = css.split('\n').filter((l) => /#[0-9a-fA-F]{3}\b/.test(l));
    expect(hexHits).toEqual([]);
  });

  it('хуки слоя на месте: корни, шаги, карточки, CTA, чипы', () => {    const css = readArmCss();
    for (const hook of [
      '.train-arm.arm-apk',
      '.train-armdiag.arm-apk',
      '.ad-steps',
      '.ad-step-group',
      '.ad-card',
      "[data-arm='quality-card']",
      "[data-arm='week-pills']",
      "[data-arm='export-actions']",
      'content-visibility',
      ".ad-btn[data-variant='primary']",
      ".ad-btn[data-variant='amber']",
      ".ad-chip[data-active='true']",
      '.ad-pill',
      '.ad-step',
      'armApkIn',
      'prefers-reduced-motion',
      // PRO-3: кнопки диаг-хаба 44px+ и новые хуки
      ".train-armdiag.arm-apk .ad-chip",
      ".train-armdiag.arm-apk .ad-btn",
      ".train-armdiag.arm-apk .ad-chip:focus-visible",
      "[data-arm='lift-verdict']",
      "[data-arm='lift-table']",
      "[data-arm='lift-export']",
      "[data-arm='waf-class']",
      "[data-arm='humerus-checks']",
      "[data-arm='humerus-stop']",
      "[data-arm='asym-verdict']",
      "[data-arm='norms-table']",
      "[data-arm='scenario']",
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
    expect(root?.classList.contains('ad-wrap'), 'design root').toBe(true);
    expect(container.querySelector("[data-arm='steps']"), 'steps hook').not.toBeNull();
    expect(container.querySelector("[data-arm='split-list']")).toBeNull();
  });

  it('дизайн-система: карточки и контролы на классах', () => {
    const { container } = render(<ArmAutoConstructor />);
    expect(container.querySelectorAll('.ad-card').length, 'ad cards').toBeGreaterThan(0);
    expect(container.querySelectorAll('.ad-chip').length, 'ad chips').toBeGreaterThan(0);
    expect(container.querySelectorAll('.ad-field').length, 'ad fields').toBeGreaterThan(0);
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
    expect(root?.classList.contains('arm-apk'), 'no hub apk class in TG').toBe(false);
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

  it('PRO-3 армлифтинг-хаб: TG 1-в-1 без arm-apk, в native — с arm-apk', () => {
    const tg = render(<ArmliftingDiagnosticsHub />);
    const tgRoot = tg.container.querySelector('.train-armdiag');
    expect(tgRoot, 'lift hub root').not.toBeNull();
    expect(tgRoot?.classList.contains('arm-apk'), 'no lift apk class in TG').toBe(false);
    expect(tg.container.querySelector("[data-arm='lift-verdict']"), 'verdict hook').not.toBeNull();
    expect(tg.container.querySelector("[data-arm='lift-table']"), 'table hook').toBeNull(); // пусто без замеров
    tg.unmount();
    cleanup();
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    resetAppPlatformCache();
    const nat = render(<ArmliftingDiagnosticsHub />);
    expect(nat.container.querySelector('.train-armdiag')?.classList.contains('arm-apk'), 'lift apk class in native').toBe(true);
    expect(nat.container.querySelector("[data-arm='lift-export']"), 'export hook').not.toBeNull();
  });

  it('весь конструктор: 8 шагов рендерятся без падений (TG)', () => {
    render(<ArmAutoConstructor />);
    const steps: Array<[string, RegExp]> = [
      ['🎛 Параметры', /Дисциплина/],
      ['🎯 Атлет', /Рабочие максимумы/],
      ['✊ Стол и хват', /Хват — диагностика/],
      ['📚 Сплит и цикл', /Выбор сплита/],
      ['📋 План', /План не собран/],
      ['🏋️ Веса и качество', /План не собран/],
      ['📤 Экспорт', /План не собран/],
      ['🗓 Год', /Год по блокам/],
    ];
    for (const [tab, marker] of steps) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      expect(document.body.textContent, tab).toMatch(marker);
    }
    expect(document.querySelector('.train-arm')?.classList.contains('arm-apk'), 'no apk in TG walk').toBe(false);
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
    for (const tab of ['🎛 Параметры', '🎯 Атлет', '✊ Стол и хват', '📚 Сплит и цикл', '📋 План', '🏋️ Веса и качество', '📤 Экспорт', '🗓 Год']) {
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

  it('аккордеоны: PRO свернут с саммари, раскрывается по тапу', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '🎯 Атлет' }));
    const head = screen.getByRole('button', { name: /PRO: старт WAF/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.textContent).toContain('без даты');
    // поля доступны и в свёрнутом виде — скрытие только визуальное
    expect(screen.getByLabelText('Дата старта')).toBeTruthy();
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
  });

  it('выдача: дашборд плана на шаге План, обоснование — на шаге Экспорт', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    for (const marker of ['Недель', 'Сессий', 'Стол', 'Делод/пик']) {
      expect(document.body.textContent, marker).toContain(marker);
    }
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    expect(document.body.textContent).toContain('📖 Обоснование');
  });

  it('хаб: Table-IQ свернут, журнал работает без раскрытия', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    const head = screen.getByRole('button', { name: /Table-IQ/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.change(screen.getByLabelText('Фолы за схватку'), { target: { value: '2' } });
    fireEvent.click(screen.getByText(/＋ Схватка/));
    expect(document.body.textContent).toContain('Table-IQ 1 схваток');
    expect(head.textContent).toContain('Схваток: 1');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
  });

  it('выбор chips: дисциплина/техника переключаются без селектов', () => {
    render(<ArmAutoConstructor />);
    expect(document.body.textContent).not.toContain('Хват-фокус');
    fireEvent.click(screen.getByRole('button', { name: 'Армлифтинг' }));
    expect(document.body.textContent).toContain('Хват-фокус');
    // 'Хук' есть и в технике, и в оппоненте — техника идёт первой в DOM
    const hookBtns = screen.getAllByRole('button', { name: 'Хук' });
    fireEvent.click(hookBtns[0]);
    expect(hookBtns[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('выдача: полоса объёма — 8 недель с фазами, клик переключает', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '📋 План' }));
    const strip = container.querySelector("[data-arm='week-pills']");
    expect(strip, 'vol strip').not.toBeNull();
    const btns = Array.from(strip!.querySelectorAll('.ad-wpill'));
    expect(btns.length).toBe(8);
    for (const b of btns) {
      expect(b.getAttribute('data-phase')).toBeTruthy();
      const fill = b.querySelector('.ad-wpill-fill') as HTMLElement | null;
      expect(fill, 'bar').not.toBeNull();
      expect(Number.parseFloat(fill!.style.height)).toBeGreaterThan(0);
    }
    fireEvent.click(btns[2]);
    expect(document.body.textContent).toContain('Неделя 3 —');
  });
});
