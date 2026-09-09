/**
 * arm-hub-tabpanel.test.tsx — enter-переход контента табов хаба.
 *
 * Панель-обёртка с key={tab} (remount → анимация), контент меняется,
 * шапка/табы/CTA живы; keyframes + reduced-motion в слое.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
});

function readBaseCss(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-design.css'),
    'utf-8',
  );
}

describe('Arm hub tabpanel', () => {
  it('панель на месте, стартовый контент — хват', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    const panel = container.querySelector("[data-arm='hub-tabpanel']");
    expect(panel, 'panel').not.toBeNull();
    expect(panel!.classList.contains('ad-tabpanel')).toBe(true);
    expect(document.body.textContent).toContain('Force Vector');
  });

  it('переключение табов меняет контент, панель одна', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    expect(document.body.textContent).toContain('TOP: матчап + Table-IQ журнал');
    expect(container.querySelectorAll("[data-arm='hub-tabpanel']").length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('Return-to-pull');
    expect(container.querySelector("[data-arm='hub-head']"), 'head alive').not.toBeNull();
    expect(container.querySelector("[data-arm='hub-tabs']"), 'tabs alive').not.toBeNull();
  });

  it('слой: keyframes перехода + reduced-motion', () => {
    const css = readBaseCss();
    expect(css).toContain('@keyframes adTabIn');
    expect(css).toContain('.ad-tabpanel');
    const rmIdx = css.indexOf('prefers-reduced-motion');
    expect(rmIdx).toBeGreaterThan(-1);
    expect(css.slice(rmIdx)).toContain('.ad-tabpanel');
  });
});
