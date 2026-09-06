/**
 * labs-risk-visual.test.tsx — волны E/F: акцент-мост лабов, SVG систем,
 * иконки рисков. Hex-поведение 1-в-1 (TG/web), в APK — за темой.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import {
  LABS_ACCENT,
  labsWithAlpha,
  LABS_SYS_ICON,
  LabsEmpty,
  LabsSectionHeader,
} from '../screens/LabsScreen_parts/LabsUI';
import { NativeIcon, NATIVE_ICON_NAMES } from '../native/NativeIcons';

describe('labs accent bridge', () => {
  it('LABS_ACCENT — var() с минт-фолбэком', () => {
    expect(LABS_ACCENT).toBe('var(--labs-accent, #00e68a)');
  });

  it('labsWithAlpha: hex — байт-в-байт, акцент — rgba', () => {
    expect(labsWithAlpha('#ef4444', '18')).toBe('#ef444418');
    expect(labsWithAlpha(LABS_ACCENT, '18')).toBe('rgba(var(--labs-accent-rgb, 0,230,138), 0.094)');
  });

  it('все системные иконки — из SVG-набора', () => {
    for (const [sys, icon] of Object.entries(LABS_SYS_ICON)) {
      expect(NATIVE_ICON_NAMES, sys).toContain(icon);
    }
  });

  it('LabsEmpty рендерит svg-иконку', () => {
    const { container } = render(
      <LabsEmpty icon={<NativeIcon name="flask" size={26} />} title="Нет" desc="пусто" />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('LabsSectionHeader принимает SVG-иконку', () => {
    const { container } = render(
      <LabsSectionHeader icon={<NativeIcon name="layers" size={15} />} title="Системы" />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('labs/risk CSS bridge (§65)', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles-native.css'), 'utf-8');

  it('мост --labs-accent → --accent под html.app-native', () => {
    expect(css).toContain('--labs-accent: var(--accent)');
    expect(css).toContain('--labs-accent-rgb: var(--accent-rgb)');
  });
});
