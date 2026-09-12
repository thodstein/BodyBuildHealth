/**
 * arm-pro5-ui.test.tsx — PRO-5 P7 поверхность: consent-превью + фикс сплита в 1 клик.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
});

function goSplit(container: Element) {
  fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
  const head = screen.getAllByRole('button', { name: /Именной цикл/ }).find((b) => b.getAttribute('aria-expanded') != null);
  expect(head).toBeTruthy();
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
  return container;
}

describe('Arm PRO-5 UI (P7)', () => {
  it('выбор цикла показывает consent-превью и кнопку-фикс сплита', () => {
    const { container } = render(<ArmAutoConstructor />);
    goSplit(container);
    fireEvent.click(screen.getByRole('button', { name: 'Цикл StrengthLog 8-week (стол + база)' }));
    const previews = container.querySelectorAll('[data-arm="consent-preview"]');
    expect(previews.length).toBeGreaterThan(0);
    expect(previews[0].textContent).toContain('StrengthLog 8-week');
    const fix = container.querySelector('[data-arm="split-fix"]');
    expect(fix).not.toBeNull();
    expect(fix!.textContent).toContain('Подходит сплит');
  });

  it('клик по фиксу применяет сплит и гасит кнопку', () => {
    const { container } = render(<ArmAutoConstructor />);
    goSplit(container);
    fireEvent.click(screen.getByRole('button', { name: 'Цикл StrengthLog 8-week (стол + база)' }));
    const fix = container.querySelector('[data-arm="split-fix"]');
    expect(fix).not.toBeNull();
    fireEvent.click(fix!);
    expect(container.querySelector('[data-arm="split-fix"]')).toBeNull();
  });

  it('без цикла — ни превью, ни фикса', () => {
    const { container } = render(<ArmAutoConstructor />);
    goSplit(container);
    expect(container.querySelector('[data-arm="consent-preview"]')).toBeNull();
    expect(container.querySelector('[data-arm="split-fix"]')).toBeNull();
  });
});

describe('Arm PRO-5 UI (P2 hub rules)', () => {  it('помост: правило снаряда + LMS-канон', () => {
    const { container } = render(<ArmliftingDiagnosticsHub />);
    const rule = container.querySelector('[data-arm="lift-rule-2026"]');
    expect(rule).not.toBeNull();
    expect(rule!.textContent).toContain('Rolling Thunder');
    const lms = container.querySelector('[data-arm="lift-lms-rules"]');
    expect(lms).not.toBeNull();
    expect(lms!.textContent).toContain('60с');
  });

  it('все 9 правил 2026 в списке (Raptor/FatGripz честно без %)', () => {
    const { container } = render(<ArmliftingDiagnosticsHub />);
    const list = container.querySelector('[data-arm="lift-rules-2026"]');
    expect(list).not.toBeNull();
    expect(list!.textContent).toContain('Raptor 1.75');
    expect(list!.textContent).toContain('Fat Gripz');
    expect(list!.textContent).toContain('Ориентира нет');
  });
});

describe('Arm PRO-5 UI (controls + blocked)', () => {
  it('контролы PRO-5 видны в именном цикле', () => {
    const { container } = render(<ArmAutoConstructor />);
    goSplit(container);
    expect(screen.getByRole('switch', { name: 'PRO-5: RIR по StrengthLog' })).toBeTruthy();
    expect(screen.getByLabelText('Цикл процентов в неделю')).toBeTruthy();
    expect(screen.getByLabelText('Мезо-ставка процентов')).toBeTruthy();
    expect(screen.getByLabelText('Hook-кап сетов в неделю')).toBeTruthy();
  });

  it('RPE-паритет сквозит в сборку', () => {
    const { container } = render(<ArmAutoConstructor />);
    goSplit(container);
    fireEvent.click(screen.getByRole('switch', { name: 'PRO-5: RIR по StrengthLog' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    expect(container.querySelector("[data-arm='rationale']")?.textContent).toContain('StrengthLog');
  });

  it('ось high: blocked виден в гейтах качества', () => {
    const { container } = render(<ArmAutoConstructor />);
    goSplit(container);
    fireEvent.click(screen.getByRole('switch', { name: 'Ось humerus-2026' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Скрут корпуса в атаку' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Запястье позади плеча' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Кисть разогнута назад' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: /Веса и качество/ }));
    const blocked = container.querySelector('[data-arm="gates-blocked"]');
    expect(blocked).not.toBeNull();
    expect(blocked!.textContent).toContain('Ось high');
  });
});
