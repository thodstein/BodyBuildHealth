/**
 * shared-contrast.test.tsx — WCAG-контрасты ОБЩЕГО слоя (styles.css):
 * тёмная база + светлая тема. TG и APK делят эти токены, поэтому пороги
 * держат обе платформы сразу. Методика 1-в-1 с APK-аудитом (волна 17).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readCss(): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', 'styles.css'), 'utf-8');
}

function block(css: string, sel: string): string {
  const i = css.indexOf(sel);
  if (i < 0) throw new Error(`no block ${sel}`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function vars(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const chan = (c: number) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = (c: RGB) => 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function paint(v: Record<string, string>, name: string, bg: RGB): RGB {
  const raw = v[name];
  const mHex = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (mHex) return hex(raw);
  const mRgba = /^rgba\(\s*(.+?)\s*,\s*([0-9.]+)\s*\)$/.exec(raw);
  if (!mRgba) throw new Error(`unparsed ${name} = ${raw}`);
  const trip = mRgba[1].split(',').map((s) => Number(s.trim())) as RGB;
  const a = Number(mRgba[2]);
  return trip.map((c, i) => Math.round(c * a + bg[i] * (1 - a))) as RGB;
}

describe('shared layer WCAG', () => {
  const css = readCss();
  const base = vars(block(css, ':root'));
  const navy: RGB = [10, 10, 10];
  const paper: RGB = [245, 245, 247];

  it('тёмная база: текст 7+, faint/акцент 4.5+', () => {
    expect(ratio(paint(base, 'text', navy), navy)).toBeGreaterThanOrEqual(7);
    expect(ratio(paint(base, 'text-faint', navy), navy)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(paint(base, 'accent', navy), navy)).toBeGreaterThanOrEqual(4.5);
    expect(
      ratio(paint(base, 'accent-contrast', navy), paint(base, 'accent', navy)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('светлая тема: текст 7+, dim/акцент 4.5+, faint декоративный 3.0+ (Apple parity)', () => {
    const light = { ...base, ...vars(block(css, '[data-theme="light"]')) };
    expect(ratio(paint(light, 'text', paper), paper)).toBeGreaterThanOrEqual(7);
    expect(ratio(paint(light, 'text-dim', paper), paper)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(paint(light, 'text-faint', paper), paper)).toBeGreaterThanOrEqual(3.0);
    expect(ratio(paint(light, 'accent', paper), paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('::selection задан в обеих темах (не системный синий)', () => {
    expect(css).toContain('::selection');
    expect(css).toContain('[data-theme="light"] ::selection');
  });

  it('табличные цифры в статистике (без прыжков при обновлении)', () => {
    expect(css.replace(/\s+/g, ' ')).toContain('td, .stat-value, [data-stat]');
  });
});

describe('document lang', () => {
  it('setLocale синхронизирует <html lang> для скринридеров', async () => {
    const { setLocale, getLocale } = await import('../../data/interactions-labels');
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    setLocale('ru');
    expect(document.documentElement.getAttribute('lang')).toBe('ru');
  });
});

describe('below-fold images', () => {
  const src = (p: string) =>
    fs.readFileSync(path.join(process.cwd(), 'src', p), 'utf-8');
  it('списки/отчёты грузят фото лениво (hero — eager, не трогаем)', () => {
    for (const f of [
      'ui/screens/ReportsScreen.tsx',
      'ui/screens/ProfileScreen_v2/diaries/WeightDiary/PhotoTimeline.tsx',
    ]) {
      expect(src(f), f).toContain('loading="lazy"');
    }
  });
});
