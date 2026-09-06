/**
 * profile-accent.test.tsx — акцент темы в Профиле (colors.primary → var(--profile-accent)).
 * Hex-поведение 1-в-1 (TG/web), в APK primary идёт за системным --accent.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { BoolChip, colors, withAlpha, PROFILE_ACCENT_VAR } from '../ui';

describe('profile accent bridge', () => {
  it('colors.primary — var() с зелёным фолбэком', () => {
    expect(colors.primary).toBe('var(--profile-accent, #34d399)');
    expect(colors.primary).toBe(PROFILE_ACCENT_VAR);
  });

  it('colors.primaryDim — rgba через rgb-триплет', () => {
    expect(colors.primaryDim).toContain('--profile-accent-rgb');
    expect(colors.primaryDim).toContain('52, 211, 153');
  });

  it('colors.green — семантический, НЕ за акцентом', () => {
    expect(colors.green).toBe('#34d399');
  });

  it('withAlpha: hex — байт-в-байт как раньше', () => {
    expect(withAlpha('#34d399', '44')).toBe('#34d39944');
    expect(withAlpha('#ef4444', '22')).toBe('#ef444422');
    expect(withAlpha('rgba(255,255,255,0.04)', '22')).toBe('rgba(255,255,255,0.04)22');
  });

  it('withAlpha: акцент — валидный rgba через триплет', () => {
    expect(withAlpha(colors.primary, '44')).toBe(
      'rgba(var(--profile-accent-rgb, 52, 211, 153), 0.267)',
    );
    expect(withAlpha(colors.primary, '22')).toBe(
      'rgba(var(--profile-accent-rgb, 52, 211, 153), 0.133)',
    );
  });

  it('BoolChip по умолчанию красится акцентом (валидный CSS)', () => {
    const { container } = render(<BoolChip checked label="Тест" onChange={() => {}} />);
    const btn = container.querySelector('button');
    // Сырой style-атрибут: var()/rgba() хранятся как есть (jsdom не чистит).
    const raw = btn?.getAttribute('style') ?? '';
    expect(raw).toContain('rgba(var(--profile-accent-rgb');
    expect(raw).toContain('var(--profile-accent, #34d399)');
    // Невалидных склеек вида "var(...)44" быть не должно.
    expect(raw).not.toMatch(/var\(--profile-accent[^)]*\)[0-9a-f]{2}/);
  });
});

describe('profile accent CSS bridge (§62)', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native.css'), 'utf-8');

  it('мост --profile-accent → --accent под html.app-native', () => {
    expect(css).toContain('--profile-accent: var(--accent)');
    expect(css).toContain('--profile-accent-rgb: var(--accent-rgb)');
  });

  it('hero Главной: contain + верх, дрифт выключен', () => {
    expect(css).toMatch(/\.native-home-bg img\s*\{[^}]*object-fit:\s*contain/);
    expect(css).toMatch(/\.native-home-bg img\s*\{[^}]*object-position:\s*center top/);
  });

  it('иконки трио: SVG-правила в акценте, без hex в блоке', () => {
    expect(css).toContain('.native-home-tile-icon svg');
    const block = css.slice(css.indexOf('62. HOME HERO'), css.indexOf('59. APK DYNAMIC COLOR'));
    expect(block).not.toMatch(/#c9f73a|#00e68a/i);
  });
});
